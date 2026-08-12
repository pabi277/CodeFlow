// Git orchestration — combines the GitHub REST API (githubService) with
// local IndexedDB storage to provide clone / commit / push / pull / branch ops.

import { github as gh } from './githubApi'
import * as fsDb from '../db/files'
import * as projectsDb from '../db/projects'
import { getAuth } from '../db/gitHub'
import { db } from '../db/db'
import type {
  CloneProgress,
  FileNode,
  GitConflict,
  GitHubRepo,
  Project,
  GitHubBranch,
  GitHubCommit,
  GitHubPullRequest,
  GitHubTreeResponse,
} from '../types'

/** True when the GitHub API says the repository has no commits yet (a brand-new repo). */
function isEmptyRepoError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { response?: { status?: number; data?: { message?: string } } }
  return (
    e.response?.status === 409 &&
    typeof e.response?.data?.message === 'string' &&
    e.response.data.message.toLowerCase().includes('git repository is empty')
  )
}

async function requireToken(): Promise<string> {
  const auth = await getAuth()
  if (!auth?.token) throw new Error('Not connected to GitHub. Tap Connect GitHub first.')
  return auth.token
}

const dirnameRepo = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const basenameRepo = (p: string) => (p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p)
/** "/src/main.py" -> "src/main.py" */
const toRepoPath = (nodePath: string) => nodePath.replace(/^\//, '')

export type GitStatusKind = 'modified' | 'new' | 'deleted'
export interface GitStatusItem {
  id: string
  path: string
  status: GitStatusKind
}

export async function computeGitStatus(projectId: string, nodeMap: Record<string, FileNode>): Promise<GitStatusItem[]> {
  const items: GitStatusItem[] = []
  const deleted = await fsDb.listDeletedInProject(projectId)
  for (const n of deleted) items.push({ id: n.id, path: n.path, status: 'deleted' })
  for (const n of Object.values(nodeMap)) {
    if (n.type !== 'file') continue
    if (n.isNew) items.push({ id: n.id, path: n.path, status: 'new' })
    else if (n.isGitModified) items.push({ id: n.id, path: n.path, status: 'modified' })
  }
  return items.sort((a, b) => a.path.localeCompare(b.path))
}

/** Clone a GitHub repo into a new local project, fetching blobs in batches of 10. */
export async function cloneRepository(
  repo: GitHubRepo,
  projectName: string,
  onProgress?: (p: CloneProgress) => void,
): Promise<Project> {
  const token = await requireToken()
  const owner = repo.full_name.split('/')[0]
  const branch = repo.default_branch

  onProgress?.({ label: 'Fetching repository structure…', done: 0, total: 0 })
  let treeRes: GitHubTreeResponse | null = null
  try {
    treeRes = await gh.getTree(token, owner, repo.name, branch)
  } catch (err) {
    if (!isEmptyRepoError(err)) throw err
    // Brand-new repository with no commits — clone it as an empty project.
    onProgress?.({ label: 'Repository is empty — creating empty project…', done: 0, total: 0 })
  }
  const blobs = (treeRes?.tree ?? []).filter((t) => t.type === 'blob')
  onProgress?.({ label: 'Creating project…', done: 0, total: blobs.length })

  // create project + root folder
  const project = await projectsDb.createProject(projectName, '')
  const root = await fsDb.createNode(project.id, null, projectName, 'folder', '', { isNew: false })
  await db.projects.update(project.id, { rootFolderId: root.id })
  await db.files.update(root.id, { path: '/' })

  const pathToId: Record<string, string> = { '/': root.id }

  // folders first, shallowest first
  const trees = (treeRes?.tree ?? [])
    .filter((t) => t.type === 'tree' && t.path)
    .sort((x, y) => x.path.split('/').length - y.path.split('/').length)
  for (const t of trees) {
    const parent = pathToId['/' + dirnameRepo(t.path)] ?? root.id
    const folder = await fsDb.createNode(project.id, parent, basenameRepo(t.path), 'folder', '', { isNew: false })
    pathToId['/' + t.path] = folder.id
  }

  // blobs in batches of 10
  let done = 0
  for (let i = 0; i < blobs.length; i += 10) {
    const batch = blobs.slice(i, i + 10)
    await Promise.all(
      batch.map(async (blob) => {
        const parent = pathToId['/' + dirnameRepo(blob.path)] ?? root.id
        const content = await gh.getFileContent(token, blob.url || '')
        await fsDb.createNode(project.id, parent, basenameRepo(blob.path), 'file', content, {
          isNew: false,
          gitSha: blob.sha,
          originalContent: content,
        })
      }),
    )
    done += batch.length
    onProgress?.({ label: `Fetched ${Math.min(done, blobs.length)} of ${blobs.length} files…`, done, total: blobs.length })
  }

  await projectsDb.updateProjectGithub(project.id, { owner, repo: repo.name, branch, lastSyncAt: Date.now(), connected: true })
  const fresh = await projectsDb.getProject(project.id)
  return fresh!
}

export interface CommitOptions {
  message: string
  includeIds: string[]
  push: boolean
}

/** Commit staged files and push them to the connected GitHub branch. Returns the new commit SHA. */
export async function commitChanges(projectId: string, opts: CommitOptions): Promise<string> {
  // CodeFlow has no local Git object database or pending-commit queue. Creating a
  // commit without moving the remote ref would leave it unreachable and then
  // incorrectly mark the local files clean, so fail before performing any work.
  if (!opts.push) {
    throw new Error('Commit Only is not supported yet. Use Commit & Push to keep your changes safe.')
  }

  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  const { owner, repo, branch } = project.github

  // 1. create blobs for each included file, collect entries
  const entries: { path: string; mode: string; type: string; sha: string | null }[] = []
  const blobShas: Record<string, string> = {}
  for (const id of opts.includeIds) {
    const node = await fsDb.getNode(id)
    if (!node) continue
    if (node.isDeleted) {
      entries.push({ path: toRepoPath(node.path), mode: '100644', type: 'blob', sha: null })
    } else {
      const blobSha = await gh.createBlob(token, owner, repo, node.content)
      blobShas[id] = blobSha
      entries.push({ path: toRepoPath(node.path), mode: '100644', type: 'blob', sha: blobSha })
    }
  }

  // 2-6. ref -> commit -> tree -> new tree -> commit -> update/create ref
  let baseSha: string | null = null
  let baseTree: string | null = null
  try {
    const ref = await gh.getRef(token, owner, repo, branch)
    baseSha = ref.object.sha
    const baseCommit = await gh.getCommit(token, owner, repo, baseSha)
    baseTree = baseCommit.tree.sha
  } catch (err) {
    if (!isEmptyRepoError(err)) throw err
    // Brand-new repository with no commits — this push creates the first commit,
    // so there is no base ref/tree and the branch ref must be created, not updated.
  }
  const treeSha = await gh.createTree(token, owner, repo, baseTree, entries)
  const newCommit = await gh.createCommit(token, owner, repo, opts.message, treeSha, baseSha ? [baseSha] : [])
  if (opts.push) {
    if (baseSha) {
      await gh.updateRef(token, owner, repo, branch, newCommit.sha)
    } else {
      await gh.createRef(token, owner, repo, branch, newCommit.sha)
    }
  }

  // update local bookkeeping
  for (const id of opts.includeIds) {
    const node = await fsDb.getNode(id)
    if (!node) continue
    if (node.isDeleted) {
      await fsDb.hardDelete(id)
    } else {
      await fsDb.syncGitFile(id, node.content, blobShas[id] || node.gitSha || '')
    }
  }
  await projectsDb.updateProjectGithub(projectId, { lastSyncAt: Date.now() })
  return newCommit.sha
}

export interface PullResult {
  updated: number
  created: number
  conflicts: string[]
  conflictDetails: GitConflict[]
  deletedRemote: string[]
}

/** Pull remote changes into the local project. Handles conflicts without auto-resolving. */
export async function pullChanges(projectId: string, onProgress?: (p: CloneProgress) => void): Promise<PullResult> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  const { owner, repo, branch } = project.github

  onProgress?.({ label: 'Fetching remote changes…', done: 0, total: 0 })
  let treeRes: GitHubTreeResponse | null = null
  try {
    treeRes = await gh.getTree(token, owner, repo, branch)
  } catch (err) {
    if (!isEmptyRepoError(err)) throw err
    // Brand-new repository with no commits — nothing to pull yet.
    await projectsDb.updateProjectGithub(projectId, { lastSyncAt: Date.now() })
    return { updated: 0, created: 0, conflicts: [], conflictDetails: [], deletedRemote: [] }
  }
  const blobs = treeRes.tree.filter((t) => t.type === 'blob')

  const localNodes = (await fsDb.listAllInProject(projectId)).filter((n) => n.type === 'file' && !n.isDeleted)
  const localByPath: Record<string, FileNode> = {}
  for (const n of localNodes) localByPath[n.path] = n

  const result: PullResult = { updated: 0, created: 0, conflicts: [], conflictDetails: [], deletedRemote: [] }
  const createPathToId: Record<string, string> = { '/': project.rootFolderId }

  // ensure folders exist for remote blobs
  const ensureFolders = async (repoPath: string) => {
    const dirs = dirnameRepo(repoPath).split('/').filter(Boolean)
    let parentId: string = project.rootFolderId
    let cur = ''
    for (const d of dirs) {
      cur = cur ? `${cur}/${d}` : d
      const full = '/' + cur
      if (createPathToId[full]) { parentId = createPathToId[full]; continue }
      const existing = await findChildFolder(parentId, d)
      if (existing) { createPathToId[full] = existing; parentId = existing; continue }
      const folder = await fsDb.createNode(projectId, parentId, d, 'folder', '', { isNew: false })
      createPathToId[full] = folder.id
      parentId = folder.id
    }
    return parentId
  }

  let done = 0
  for (let i = 0; i < blobs.length; i += 10) {
    const batch = blobs.slice(i, i + 10)
    await Promise.all(
      batch.map(async (blob) => {
        const nodePath = '/' + blob.path
        const local = localByPath[nodePath]
        if (!local) {
          // new remote file
          const parent = await ensureFolders(blob.path)
          const content = await gh.getFileContent(token, blob.url || '')
          await fsDb.createNode(projectId, parent, basenameRepo(blob.path), 'file', content, {
            isNew: false,
            gitSha: blob.sha,
            originalContent: content,
          })
          result.created++
        } else {
          const remoteChanged = local.gitSha !== blob.sha
          const locallyChanged = local.isNew || local.isGitModified
          if (remoteChanged && locallyChanged) {
            const remoteContent = await gh.getFileContent(token, blob.url || '')
            result.conflicts.push(nodePath)
            result.conflictDetails.push({
              fileId: local.id,
              path: nodePath,
              local: local.content,
              remote: remoteContent,
              remoteSha: blob.sha,
            })
          } else if (remoteChanged) {
            const content = await gh.getFileContent(token, blob.url || '')
            await fsDb.syncGitFile(local.id, content, blob.sha)
            result.updated++
          }
        }
      }),
    )
    done += batch.length
    onProgress?.({ label: `Pulled ${Math.min(done, blobs.length)} of ${blobs.length}…`, done, total: blobs.length })
  }

  // local files not on remote -> deleted remotely
  const remoteSet = new Set(blobs.map((b) => '/' + b.path))
  for (const n of localNodes) {
    if (!remoteSet.has(n.path)) result.deletedRemote.push(n.path)
  }

  await projectsDb.updateProjectGithub(projectId, { lastSyncAt: Date.now() })
  return result
}

async function findChildFolder(parentId: string, name: string): Promise<string | null> {
  const parent = await db.files.get(parentId)
  if (!parent) return null
  for (const cid of parent.childIds) {
    const c = await db.files.get(cid)
    if (c && c.type === 'folder' && c.name === name) return c.id
  }
  return null
}

/** Revert a locally-modified file back to its last-synced content. */
export async function discardChanges(fileId: string): Promise<void> {
  const node = await fsDb.getNode(fileId)
  if (!node || node.type !== 'file') return
  await fsDb.syncGitFile(fileId, node.originalContent, node.gitSha || '')
}

export async function listBranches(projectId: string): Promise<GitHubBranch[]> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) return []
  return gh.listBranches(token, project.github.owner, project.github.repo)
}

export async function switchBranch(projectId: string, branch: string): Promise<void> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) return
  // Verify branch exists
  const branches = await gh.listBranches(token, project.github.owner, project.github.repo)
  if (!branches.some((b) => b.name === branch)) throw new Error(`Branch "${branch}" does not exist.`)
  await projectsDb.updateProjectGithub(projectId, { branch })
}

export async function createBranch(projectId: string, name: string): Promise<void> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  const branch = name.trim().replace(/^refs\/heads\//, '')
  if (!branch || /[\s~^:?*[\\]/.test(branch)) throw new Error('Invalid branch name.')
  const { owner, repo } = project.github
  const ref = await gh.getRef(token, owner, repo, project.github.branch)
  await gh.createRef(token, owner, repo, branch, ref.object.sha)
  await projectsDb.updateProjectGithub(projectId, { branch })
}

export async function deleteBranch(projectId: string, name: string): Promise<void> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  if (project.github.branch === name) throw new Error('Cannot delete the branch you are on.')
  await gh.deleteRef(token, project.github.owner, project.github.repo, name)
}

/** Get the commit history (read-only) for the connected project. */
export async function getCommitLog(projectId: string, count = 30): Promise<GitHubCommit[]> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) return []
  try {
    return await gh.listCommits(token, project.github.owner, project.github.repo, project.github.branch, count)
  } catch (err) {
    if (isEmptyRepoError(err)) return []
    throw err
  }
}

/** List open pull requests (read-only) for the connected project. */
export async function getPullRequests(projectId: string): Promise<GitHubPullRequest[]> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) return []
  return gh.listPullRequests(token, project.github.owner, project.github.repo)
}
