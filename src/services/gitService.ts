// Git orchestration — combines the GitHub REST API (githubService) with
// local IndexedDB storage to provide clone / commit / push / pull / branch ops.

import { github as gh } from './githubApi'
import * as fsDb from '../db/files'
import * as projectsDb from '../db/projects'
import { getAuth } from '../db/gitHub'
import { db } from '../db/db'
import { entriesToSeed } from '../utils/zip'
import type {
  CloneProgress,
  FileNode,
  GitConflict,
  GitHubRepo,
  GitHubTreeResponse,
  Project,
  GitHubBranch,
  GitHubCommit,
  GitHubPullRequest,
  UploadToGitHubOptions,
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

/** List a repo's branches, treating a brand-new (empty) repo as having none. */
async function listBranchesOrEmpty(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  try {
    return await gh.listBranches(token, owner, repo)
  } catch (err) {
    if (isEmptyRepoError(err)) return []
    throw err
  }
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

/** Clone a GitHub repo into a new local project, fetching blobs in batches of 10.
 *  Empty repositories (no commits yet) clone as an empty connected project so
 *  the user can fill it and push an initial commit. */
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

/** A file to add in the very first commit of a brand-new (empty) repository. */
interface InitialFile {
  id: string
  path: string
  content: string
}

/**
 * Push the very first commit into an EMPTY repository (one with no commits yet).
 *
 * GitHub's git database API (blobs / trees / commits / refs) answers every call
 * with 409 "Git Repository is empty" until the repository has its first commit,
 * so the repository is initialized by creating the first file through the
 * contents API; any remaining files are then committed on top with the normal
 * git database flow. Returns the final commit SHA and every file's blob SHA.
 */
async function pushInitialCommitToEmptyRepo(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: InitialFile[],
): Promise<{ sha: string; blobShas: Record<string, string> }> {
  if (!files.length) {
    throw new Error('This repository is empty — add a file before committing.')
  }

  const blobShas: Record<string, string> = {}
  const [first, ...rest] = files

  // 1. initialize the repository and create the first file (this makes the
  //    default branch exist, so the git database API works afterwards).
  const init = await gh.createOrUpdateFile(token, owner, repo, toRepoPath(first.path), first.content, message, branch)
  blobShas[first.id] = init.blobSha
  let sha = init.commitSha

  // 2. commit the remaining files on top of the brand-new branch.
  if (rest.length) {
    const ref = await gh.getRef(token, owner, repo, branch)
    const baseCommit = await gh.getCommit(token, owner, repo, ref.object.sha)
    const entries: { path: string; mode: string; type: string; sha: string | null }[] = []
    for (const f of rest) {
      const blobSha = await gh.createBlob(token, owner, repo, f.content)
      blobShas[f.id] = blobSha
      entries.push({ path: toRepoPath(f.path), mode: '100644', type: 'blob', sha: blobSha })
    }
    const treeSha = await gh.createTree(token, owner, repo, baseCommit.tree.sha, entries)
    const commit = await gh.createCommit(token, owner, repo, message, treeSha, [ref.object.sha])
    await gh.updateRef(token, owner, repo, branch, commit.sha)
    sha = commit.sha
  }

  return { sha, blobShas }
}

/** Commit staged files and push them to the connected GitHub branch. Returns the new commit SHA.
 *  Works on both existing branches and freshly-cloned EMPTY repositories — in the empty case
 *  the repository is initialized through the contents API and the files are committed on top. */
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

  // 0. split the staged files into additions and deletions
  const additions: InitialFile[] = []
  const deletions: { id: string; path: string }[] = []
  for (const id of opts.includeIds) {
    const node = await fsDb.getNode(id)
    if (!node) continue
    if (node.isDeleted) deletions.push({ id: node.id, path: node.path })
    else additions.push({ id: node.id, path: node.path, content: node.content })
  }

  // 1. detect whether the remote branch exists yet (empty repo → initial commit)
  let baseSha: string | null = null
  try {
    baseSha = (await gh.getRef(token, owner, repo, branch)).object.sha
  } catch (err) {
    if (!isEmptyRepoError(err)) throw err
    baseSha = null // brand-new repository with no commits yet
  }

  let newSha: string
  const blobShas: Record<string, string> = {}

  if (baseSha === null) {
    // Empty repository — the git database API would 409, so initialize it first.
    const result = await pushInitialCommitToEmptyRepo(token, owner, repo, branch, opts.message, additions)
    newSha = result.sha
    Object.assign(blobShas, result.blobShas)
  } else {
    // Existing branch — standard blob → tree → commit → update ref flow.
    const baseCommit = await gh.getCommit(token, owner, repo, baseSha)
    const entries: { path: string; mode: string; type: string; sha: string | null }[] = []
    for (const d of deletions) {
      entries.push({ path: toRepoPath(d.path), mode: '100644', type: 'blob', sha: null })
    }
    for (const a of additions) {
      const blobSha = await gh.createBlob(token, owner, repo, a.content)
      blobShas[a.id] = blobSha
      entries.push({ path: toRepoPath(a.path), mode: '100644', type: 'blob', sha: blobSha })
    }
    const treeSha = await gh.createTree(token, owner, repo, baseCommit.tree.sha, entries)
    const commit = await gh.createCommit(token, owner, repo, opts.message, treeSha, [baseSha])
    await gh.updateRef(token, owner, repo, branch, commit.sha)
    newSha = commit.sha
  }

  // update local bookkeeping
  for (const a of additions) {
    await fsDb.syncGitFile(a.id, a.content, blobShas[a.id] || '')
  }
  for (const d of deletions) {
    await fsDb.hardDelete(d.id)
  }
  await projectsDb.updateProjectGithub(projectId, { lastSyncAt: Date.now() })
  return newSha
}

export interface UploadResult {
  owner: string
  repo: string
  branch: string
}

/**
 * "Shameless upload": push ALL files of a local (not-yet-connected) project to
 * GitHub in one go. Either creates a brand-new repository or pushes into an
 * existing EMPTY one, then makes the initial commit and connects the project.
 */
export async function uploadProjectToGitHub(
  projectId: string,
  opts: UploadToGitHubOptions,
  onProgress?: (p: CloneProgress) => void,
): Promise<UploadResult> {
  const token = await requireToken()
  const project = await projectsDb.getProject(projectId)
  if (!project) throw new Error('Project not found.')
  if (project.github.connected) {
    throw new Error('This project is already connected to GitHub — use Commit & Push instead.')
  }

  // 1. collect local files (before touching the remote)
  const files = (await fsDb.listAllInProject(projectId)).filter((n) => n.type === 'file' && !n.isDeleted)
  onProgress?.({ label: `Uploading ${files.length} file(s)…`, done: 0, total: Math.max(files.length, 1) })

  // 2. decide the target repo
  let owner: string
  let repo: string
  let branch: string
  if (opts.owner && opts.repo) {
    const existing = await gh.getRepo(token, opts.owner, opts.repo)
    owner = existing.full_name.split('/')[0]
    repo = existing.name
    branch = existing.default_branch || 'main'
    const branches = await listBranchesOrEmpty(token, owner, repo)
    if (branches.length > 0) {
      throw new Error(`"${owner}/${repo}" is not empty — clone it and commit from there instead.`)
    }
  } else {
    const name = (opts.repoName || project.name).trim()
    if (!name) throw new Error('Repository name is required.')
    const created = await gh.createRepo(token, {
      name,
      description: opts.description,
      private: opts.private,
    })
    owner = created.full_name.split('/')[0]
    repo = created.name
    branch = created.default_branch || 'main'
  }

  // 3. create the initial commit. An empty repo can't be written with the git
  //    database API (409 "Git Repository is empty"), so the repository is
  //    initialized via the contents API and the files are committed on top.
  const message = (opts.message || 'Initial commit').trim() || 'Initial commit'
  const blobShas: Record<string, string> = {}
  if (files.length) {
    onProgress?.({ label: 'Creating initial commit…', done: 0, total: files.length })
    const result = await pushInitialCommitToEmptyRepo(
      token,
      owner,
      repo,
      branch,
      message,
      files.map((n) => ({ id: n.id, path: n.path, content: n.content })),
    )
    Object.assign(blobShas, result.blobShas)
  }

  // 4. local bookkeeping — every uploaded file is now tracked
  for (const n of files) {
    await fsDb.syncGitFile(n.id, n.content, blobShas[n.id] || '')
  }
  await projectsDb.updateProjectGithub(projectId, { owner, repo, branch, lastSyncAt: Date.now(), connected: true })
  return { owner, repo, branch }
}

/**
 * Merge flat {path, content} entries (e.g. from a parsed ZIP) into an existing
 * project's file tree — creating folders/files as needed and overwriting files
 * that already exist. Returns how many files were created/updated.
 */
export async function mergeEntriesIntoProject(
  projectId: string,
  entries: { path: string; content: string }[],
): Promise<{ created: number; updated: number }> {
  const project = await projectsDb.getProject(projectId)
  if (!project) throw new Error('Project not found.')
  const rootId = project.rootFolderId

  // strip a common top-level folder (most zips wrap the project) + junk entries
  const seed = entriesToSeed(entries.filter((e) => !/^__MACOSX\//.test(e.path) && !/\.DS_Store$/.test(e.path)))

  let created = 0
  let updated = 0
  for (const e of seed) {
    const parts = e.path.split('/').filter(Boolean)
    if (!parts.length) continue
    const name = parts.pop()!
    let parentId: string | null = rootId
    let skip = false
    for (const d of parts) {
      const children = await fsDb.getChildren(parentId, projectId)
      // a file with this segment's name blocks creating a folder here (git
      // trees cannot have the same path as both file and folder)
      if (children.some((c) => c.type === 'file' && c.name.toLowerCase() === d.toLowerCase())) { skip = true; break }
      const existing = children.find((c) => c.type === 'folder' && c.name.toLowerCase() === d.toLowerCase())
      if (existing) { parentId = existing.id; continue }
      const folder = await fsDb.createNode(projectId, parentId, d, 'folder', '', { isNew: false })
      parentId = folder.id
    }
    if (skip) continue

    const children = await fsDb.getChildren(parentId, projectId)
    const existing = children.find((c) => c.type === 'file' && c.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (existing.content !== e.content) {
        const tracked = !existing.isNew && existing.gitSha != null
        await db.files.update(existing.id, {
          content: e.content,
          modifiedAt: Date.now(),
          // tracked files become "modified"; untracked files stay new
          isGitModified: tracked ? true : existing.isGitModified,
        })
        updated++
      }
    } else {
      // a folder with the file's name blocks creating the file
      if (children.some((c) => c.type === 'folder' && c.name.toLowerCase() === name.toLowerCase())) continue
      try {
        await fsDb.createNode(projectId, parentId, name, 'file', e.content)
        created++
      } catch {
        // skip entries that collide for any other reason
      }
    }
  }
  return { created, updated }
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
