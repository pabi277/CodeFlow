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
} from '../types'

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
    else if (n.isGitModified || (n.originalPath && n.originalPath !== n.path)) items.push({ id: n.id, path: n.path, status: 'modified' })
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
  const treeRes = await gh.getTree(token, owner, repo.name, branch)
  if (treeRes.truncated) {
    throw new Error('GitHub returned an incomplete repository tree. Clone a smaller repository or use GitHub locally.')
  }
  const blobs = treeRes.tree.filter((t) => t.type === 'blob')
  onProgress?.({ label: 'Creating project…', done: 0, total: blobs.length })

  // If a blob request fails, remove the partial local project instead of
  // leaving an unusable half-clone in the project list.
  const project = await projectsDb.createProject(projectName, '')
  try {
    const root = await fsDb.createNode(project.id, null, projectName, 'folder', '', { isNew: false })
    await db.projects.update(project.id, { rootFolderId: root.id })
    await db.files.update(root.id, { path: '/' })

    const pathToId: Record<string, string> = { '/': root.id }

    // Folders first, shallowest first, so every blob has a valid parent.
    const trees = treeRes.tree
      .filter((t) => t.type === 'tree' && t.path)
      .sort((x, y) => x.path.split('/').length - y.path.split('/').length)
    for (const t of trees) {
      const parent = pathToId['/' + dirnameRepo(t.path)] ?? root.id
      const folder = await fsDb.createNode(project.id, parent, basenameRepo(t.path), 'folder', '', { isNew: false })
      pathToId['/' + t.path] = folder.id
    }

    // Blobs in batches of 10.
    let done = 0
    for (let i = 0; i < blobs.length; i += 10) {
      const batch = blobs.slice(i, i + 10)
      await Promise.all(
        batch.map(async (blob) => {
          const parent = pathToId['/' + dirnameRepo(blob.path)] ?? root.id
          const content = await gh.getFileContent(token, blob.url || '', blob.path)
          await fsDb.createNode(project.id, parent, basenameRepo(blob.path), 'file', content, {
            isNew: false,
            gitSha: blob.sha,
            originalContent: content,
            originalPath: '/' + blob.path,
          })
        }),
      )
      done += batch.length
      onProgress?.({ label: `Fetched ${Math.min(done, blobs.length)} of ${blobs.length} files…`, done, total: blobs.length })
    }

    await projectsDb.updateProjectGithub(project.id, { owner, repo: repo.name, branch, lastSyncAt: Date.now(), connected: true })
    const fresh = await projectsDb.getProject(project.id)
    if (!fresh) throw new Error('Cloned project could not be loaded.')
    return fresh
  } catch (error) {
    await projectsDb.deleteProject(project.id).catch(() => undefined)
    throw error
  }
}

export interface CommitOptions {
  message: string
  includeIds: string[]
  push: boolean
}

/** Commit staged files. Returns the new commit SHA. */
export async function commitChanges(projectId: string, opts: CommitOptions): Promise<string> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  if (!opts.push) {
    throw new Error('CodeFlow commits directly to GitHub. Use Commit & Push to publish these changes.')
  }
  if (!opts.includeIds.length) throw new Error('Select at least one file to commit.')
  const { owner, repo, branch } = project.github

  // 1. create blobs for each included file, collect entries
  const entries: { path: string; mode: string; type: string; sha: string | null }[] = []
  const blobShas: Record<string, string> = {}
  for (const id of opts.includeIds) {
    const node = await fsDb.getNode(id)
    if (!node) continue
    if (node.isDeleted) {
      entries.push({ path: toRepoPath(node.originalPath || node.path), mode: '100644', type: 'blob', sha: null })
    } else {
      const oldPath = node.originalPath && node.originalPath !== node.path ? node.originalPath : null
      if (oldPath) entries.push({ path: toRepoPath(oldPath), mode: '100644', type: 'blob', sha: null })
      const blobSha = await gh.createBlob(token, owner, repo, node.content)
      blobShas[id] = blobSha
      entries.push({ path: toRepoPath(node.path), mode: '100644', type: 'blob', sha: blobSha })
    }
  }

  // 2-6. ref -> commit -> tree -> new tree -> commit -> update ref
  const ref = await gh.getRef(token, owner, repo, branch)
  const baseSha = ref.object.sha
  const baseCommit = await gh.getCommit(token, owner, repo, baseSha)
  const treeSha = await gh.createTree(token, owner, repo, baseCommit.tree.sha, entries)
  const newCommit = await gh.createCommit(token, owner, repo, opts.message, treeSha, [baseSha])
  if (opts.push) {
    await gh.updateRef(token, owner, repo, branch, newCommit.sha)
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
  /** Tracked files deleted remotely but kept because they have local changes. */
  deletedRemote: string[]
  /** Tracked files removed locally because they were unchanged and deleted remotely. */
  removedRemote: string[]
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
  const treeRes = await gh.getTree(token, owner, repo, branch)
  if (treeRes.truncated) {
    throw new Error('GitHub returned an incomplete remote tree. Pull cannot safely continue.')
  }
  const blobs = treeRes.tree.filter((t) => t.type === 'blob')

  const allProjectFiles = (await fsDb.listAllInProject(projectId)).filter((n) => n.type === 'file')
  const localNodes = allProjectFiles.filter((n) => !n.isDeleted)
  const deletedByPath: Record<string, FileNode> = {}
  for (const n of allProjectFiles) {
    if (n.isDeleted) deletedByPath[n.originalPath || n.path] = n
  }
  const localByPath: Record<string, FileNode> = {}
  for (const n of localNodes) {
    localByPath[n.path] = n
    if (n.originalPath && n.originalPath !== n.path) localByPath[n.originalPath] = n
  }

  const result: PullResult = { updated: 0, created: 0, conflicts: [], conflictDetails: [], deletedRemote: [], removedRemote: [] }
  const createPathToId: Record<string, string> = { '/': project.rootFolderId }
  const folderPromises: Record<string, Promise<string>> = {}

  // Ensure folders exist for remote blobs. A pull fetches files concurrently;
  // cache each path promise so two files under /src cannot create duplicate
  // /src folders at the same time.
  const ensureFolders = async (repoPath: string) => {
    const dirs = dirnameRepo(repoPath).split('/').filter(Boolean)
    let parentId: string = project.rootFolderId
    let cur = ''
    for (const d of dirs) {
      cur = cur ? `${cur}/${d}` : d
      const full = '/' + cur
      if (createPathToId[full]) {
        parentId = createPathToId[full]
        continue
      }
      if (!folderPromises[full]) {
        const parentForFolder = parentId
        folderPromises[full] = (async () => {
          const existing = await findChildFolder(parentForFolder, d)
          if (existing) return existing
          const folder = await fsDb.createNode(projectId, parentForFolder, d, 'folder', '', { isNew: false })
          return folder.id
        })()
      }
      parentId = await folderPromises[full]
      createPathToId[full] = parentId
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
        const deletedLocal = deletedByPath[nodePath]
        if (!local && deletedLocal) {
          // A locally deleted file must not be recreated when the remote blob
          // is unchanged. If the remote also changed, surface a real conflict.
          if (deletedLocal.gitSha !== blob.sha) {
            const remoteContent = await gh.getFileContent(token, blob.url || '', blob.path)
            result.conflicts.push(nodePath)
            result.conflictDetails.push({
              fileId: deletedLocal.id,
              path: nodePath,
              local: deletedLocal.originalContent || deletedLocal.content,
              remote: remoteContent,
              remoteSha: blob.sha,
            })
          }
        } else if (!local) {
          // new remote file
          const parent = await ensureFolders(blob.path)
          const content = await gh.getFileContent(token, blob.url || '', blob.path)
          await fsDb.createNode(projectId, parent, basenameRepo(blob.path), 'file', content, {
            isNew: false,
            gitSha: blob.sha,
            originalContent: content,
            originalPath: nodePath,
          })
          result.created++
        } else {
          const remoteChanged = local.gitSha !== blob.sha
          const locallyChanged = local.isNew || local.isGitModified || (local.originalPath != null && local.originalPath !== local.path)
          if (remoteChanged && locallyChanged) {
            const remoteContent = await gh.getFileContent(token, blob.url || '', blob.path)
            result.conflicts.push(nodePath)
            result.conflictDetails.push({
              fileId: local.id,
              path: nodePath,
              local: local.content,
              remote: remoteContent,
              remoteSha: blob.sha,
            })
          } else if (remoteChanged) {
            const content = await gh.getFileContent(token, blob.url || '', blob.path)
            await fsDb.syncGitFile(local.id, content, blob.sha)
            result.updated++
          }
        }
      }),
    )
    done += batch.length
    onProgress?.({ label: `Pulled ${Math.min(done, blobs.length)} of ${blobs.length}…`, done, total: blobs.length })
  }

  // Local files not on remote were deleted remotely. Remove unchanged tracked
  // files so the local tree matches the branch; preserve files with local
  // edits/new files and report them for a deliberate user decision.
  const remoteSet = new Set(blobs.map((b) => '/' + b.path))
  for (const n of localNodes) {
    if (remoteSet.has(n.path) || n.isNew) continue
    const locallyChanged = n.isGitModified || (n.originalPath != null && n.originalPath !== n.path)
    if (locallyChanged) {
      result.deletedRemote.push(n.path)
    } else {
      await fsDb.hardDelete(n.id)
      result.removedRemote.push(n.path)
    }
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
  if (!project?.github.connected || !project.github.owner || !project.github.repo) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  return gh.listBranches(token, project.github.owner, project.github.repo)
}

export async function switchBranch(projectId: string, branch: string): Promise<void> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
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
  const hasControlCharacter = [...branch].some((character) => character.charCodeAt(0) < 32)
  const invalidBranch = !branch
    || /[\s~^:?*[\\]/.test(branch)
    || hasControlCharacter
    || branch.includes('..')
    || branch.includes('@{')
    || branch.includes('//')
    || branch.startsWith('/')
    || branch.endsWith('/')
    || branch.startsWith('.')
    || branch.endsWith('.')
    || branch.endsWith('.lock')
  if (invalidBranch) throw new Error('Invalid branch name.')
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
  const branch = name.trim().replace(/^refs\/heads\//, '')
  if (!branch) throw new Error('Branch name is required.')
  if (project.github.branch === branch) throw new Error('Cannot delete the branch you are on.')
  await gh.deleteRef(token, project.github.owner, project.github.repo, branch)
}

/** Get the commit history (read-only) for the connected project. */
export async function getCommitLog(projectId: string, count = 30): Promise<GitHubCommit[]> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo || !project.github.branch) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  return gh.listCommits(token, project.github.owner, project.github.repo, project.github.branch, count)
}

/** List open pull requests (read-only) for the connected project. */
export async function getPullRequests(projectId: string): Promise<GitHubPullRequest[]> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project?.github.connected || !project.github.owner || !project.github.repo) {
    throw new Error('This project is not connected to a GitHub repository.')
  }
  return gh.listPullRequests(token, project.github.owner, project.github.repo)
}
