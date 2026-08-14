import { db } from './db'
import type { FileNode } from '../types'
import { uuid } from '../utils/id'
import { basename, join, validateName } from '../utils/path'

// ---- Hard limits ----
export const LIMITS = {
  maxNodesPerProject: 10_000,
  maxBytesPerFile: 10 * 1024 * 1024, // 10 MB
  maxDepth: 50,
  maxProjectBytes: 100 * 1024 * 1024, // 100 MB
}

export class FileSystemError extends Error {}

/** Compute the full path of a node by walking its ancestors. */
export async function computePath(_projectId: string, parentId: string | null, name: string): Promise<string> {
  if (!parentId) return join('/', name)
  const chain: string[] = []
  let current = await db.files.get(parentId)
  while (current) {
    if (current.path === '/') break // project root is path-transparent
    chain.unshift(current.name)
    current = current.parentId ? await db.files.get(current.parentId) : undefined
  }
  return join(...chain, name)
}

export async function computeDepth(_projectId: string, parentId: string | null): Promise<number> {
  if (!parentId) return 0
  let d = 0
  let current = await db.files.get(parentId)
  while (current) {
    d++
    current = current.parentId ? await db.files.get(current.parentId) : undefined
  }
  return d
}

export async function countNodesInProject(projectId: string): Promise<number> {
  return db.files.where('projectId').equals(projectId).count()
}

export async function totalBytesInProject(projectId: string): Promise<number> {
  const all = await db.files.where('projectId').equals(projectId).toArray()
  return all.reduce((sum, n) => sum + (n.type === 'file' ? (n.content?.length || 0) : 0), 0)
}

export interface CreateNodeOptions {
  content?: string
  /** Created locally vs. present in a git clone */
  isNew?: boolean
  gitSha?: string | null
  originalContent?: string
}

export async function createNode(
  projectId: string,
  parentId: string | null,
  name: string,
  type: 'file' | 'folder',
  content = '',
  options: CreateNodeOptions = {},
): Promise<FileNode> {
  const nameErr = validateName(name)
  if (nameErr) throw new FileSystemError(nameErr)

  // duplicate check within same folder (ignore git tombstones — those are waiting to be committed)
  const siblings = parentId ? (await db.files.get(parentId))?.childIds || [] : await childrenOfRoot(projectId)
  for (const sid of siblings) {
    const s = await db.files.get(sid)
    if (s && !s.isDeleted && s.name.toLowerCase() === name.toLowerCase() && s.type === type) {
      throw new FileSystemError(`A ${type} named "${name}" already exists here`)
    }
  }

  const nodeCount = await countNodesInProject(projectId)
  if (nodeCount >= LIMITS.maxNodesPerProject) {
    throw new FileSystemError(`Project limit reached (${LIMITS.maxNodesPerProject} items)`)
  }
  if (type === 'folder') {
    const d = await computeDepth(projectId, parentId)
    if (d >= LIMITS.maxDepth) throw new FileSystemError(`Maximum folder depth (${LIMITS.maxDepth}) exceeded`)
  }

  const path = await computePath(projectId, parentId, name)
  const now = Date.now()
  const node: FileNode = {
    id: uuid(),
    name,
    type,
    path,
    content: type === 'file' ? content : '',
    parentId,
    childIds: [],
    createdAt: now,
    modifiedAt: now,
    isGitModified: false,
    gitSha: options.gitSha ?? null,
    originalContent: options.originalContent ?? (type === 'file' ? content : ''),
    isNew: options.isNew ?? (type === 'file'),
    isDeleted: false,
    projectId,
  }
  await db.files.add(node)
  if (parentId) {
    const parent = await db.files.get(parentId)
    if (parent) {
      parent.childIds.push(node.id)
      parent.modifiedAt = now
      await db.files.put(parent)
    }
  }
  return node
}

async function childrenOfRoot(projectId: string): Promise<string[]> {
  const all = await db.files.where('projectId').equals(projectId).toArray()
  return all.filter((n) => n.parentId === null).map((n) => n.id)
}

export async function getChildren(parentId: string | null, projectId: string): Promise<FileNode[]> {
  const ids = parentId
    ? (await db.files.get(parentId))?.childIds || []
    : await childrenOfRoot(projectId)
  const nodes = (await db.files.bulkGet(ids)).filter((n): n is FileNode => !!n && !n.isDeleted)
  // sort folders first, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function updateContent(id: string, content: string, isGitModified?: boolean): Promise<void> {
  const node = await db.files.get(id)
  if (!node || node.type !== 'file') return
  if (content.length > LIMITS.maxBytesPerFile) {
    throw new FileSystemError('File exceeds 10 MB — it is too large to save')
  }
  const patch: Partial<FileNode> = { content, modifiedAt: Date.now() }
  if (isGitModified !== undefined) patch.isGitModified = isGitModified
  await db.files.update(id, patch)
}

export async function renameNode(id: string, newName: string): Promise<void> {
  const node = await db.files.get(id)
  if (!node) throw new FileSystemError('Item not found')
  const err = validateName(newName)
  if (err) throw new FileSystemError(err)
  if (node.name === newName) return
  // Project root is path-transparent — only the display name changes.
  if (node.path === '/') {
    await db.files.update(id, { name: newName, modifiedAt: Date.now() })
    return
  }
  const tracked = await collectTrackedFileSnapshots(id)
  const path = await computePath(node.projectId, node.parentId, newName)
  await db.files.update(id, { name: newName, path, modifiedAt: Date.now() })
  if (node.type === 'folder') {
    await rewriteDescendantPaths(node.id, path)
  }
  await applyGitRenames(tracked)
}

async function rewriteDescendantPaths(folderId: string, newFolderPath: string): Promise<void> {
  const folder = await db.files.get(folderId)
  if (!folder) return
  for (const cid of folder.childIds) {
    const child = await db.files.get(cid)
    if (!child) continue
    const newChildPath = join(newFolderPath, child.name)
    await db.files.update(child.id, { path: newChildPath })
    if (child.type === 'folder') await rewriteDescendantPaths(child.id, newChildPath)
  }
}

/** Recursively collect all descendant ids of a node. */
export async function collectSubtreeIds(id: string): Promise<string[]> {
  const ids: string[] = [id]
  const node = await db.files.get(id)
  if (node && node.type === 'folder') {
    for (const cid of node.childIds) {
      ids.push(...(await collectSubtreeIds(cid)))
    }
  }
  return ids
}

export async function deleteNode(id: string): Promise<void> {
  const node = await db.files.get(id)
  if (!node) return
  const ids = await collectSubtreeIds(id)
  await db.files.bulkDelete(ids)
  if (node.parentId) {
    const parent = await db.files.get(node.parentId)
    if (parent) {
      parent.childIds = parent.childIds.filter((c) => c !== id)
      await db.files.put(parent)
    }
  }
}

export async function duplicateNode(id: string): Promise<FileNode> {
  const node = await db.files.get(id)
  if (!node || node.type !== 'file') throw new FileSystemError('Only files can be duplicated')
  return createNode(node.projectId, node.parentId, `copy_${node.name}`, 'file', node.content)
}

/** Move a file or folder into another folder in the same project. */
export async function moveNode(id: string, newParentId: string): Promise<void> {
  const node = await db.files.get(id)
  if (!node) throw new FileSystemError('Item not found')
  if (node.path === '/') throw new FileSystemError('Cannot move the project root')
  if (node.parentId === newParentId) return
  const dest = await db.files.get(newParentId)
  if (!dest || dest.type !== 'folder') throw new FileSystemError('Destination must be a folder')
  if (dest.projectId !== node.projectId) throw new FileSystemError('Cannot move across projects')
  const subtree = await collectSubtreeIds(id)
  if (subtree.includes(newParentId)) throw new FileSystemError('Cannot move a folder into itself')
  for (const sid of dest.childIds) {
    const s = await db.files.get(sid)
    if (s && s.name.toLowerCase() === node.name.toLowerCase() && s.type === node.type && !s.isDeleted) {
      throw new FileSystemError(`A ${node.type} named "${node.name}" already exists there`)
    }
  }
  const tracked = await collectTrackedFileSnapshots(id)
  if (node.parentId) {
    const old = await db.files.get(node.parentId)
    if (old) {
      old.childIds = old.childIds.filter((c) => c !== id)
      await db.files.put(old)
    }
  }
  dest.childIds = [...dest.childIds, id]
  dest.modifiedAt = Date.now()
  await db.files.put(dest)
  const path = await computePath(node.projectId, newParentId, node.name)
  await db.files.update(id, { parentId: newParentId, path, modifiedAt: Date.now() })
  if (node.type === 'folder') await rewriteDescendantPaths(id, path)
  await applyGitRenames(tracked)
}

interface TrackedSnapshot {
  id: string
  oldPath: string
  gitSha: string | null
  originalContent: string
}

/** Snapshot every tracked (already-on-GitHub) file under a node before a rename/move. */
async function collectTrackedFileSnapshots(id: string): Promise<TrackedSnapshot[]> {
  const ids = await collectSubtreeIds(id)
  const out: TrackedSnapshot[] = []
  for (const nid of ids) {
    const n = await db.files.get(nid)
    if (!n || n.type !== 'file' || n.isNew || n.isDeleted) continue
    out.push({ id: n.id, oldPath: n.path, gitSha: n.gitSha, originalContent: n.originalContent })
  }
  return out
}

/**
 * After a rename/move, GitHub still has the files at their old paths. Record a
 * detached tombstone for each old path and mark the live file as new so the
 * next commit deletes the old path and adds the new one.
 */
async function applyGitRenames(tracked: TrackedSnapshot[]): Promise<void> {
  for (const t of tracked) {
    const live = await db.files.get(t.id)
    if (!live || live.path === t.oldPath) continue
    const now = Date.now()
    const tomb: FileNode = {
      id: uuid(),
      name: basename(t.oldPath) || live.name,
      type: 'file',
      path: t.oldPath,
      content: t.originalContent || live.content,
      // Keep a parent id for bookkeeping but do NOT attach to any folder's
      // childIds — otherwise a folder rename would show struck-through files
      // inside the new folder.
      parentId: live.parentId,
      childIds: [],
      createdAt: now,
      modifiedAt: now,
      isGitModified: false,
      gitSha: t.gitSha,
      originalContent: t.originalContent,
      isNew: false,
      isDeleted: true,
      projectId: live.projectId,
    }
    await db.files.add(tomb)
    await db.files.update(t.id, { isNew: true, gitSha: null, isGitModified: false })
  }
}

export async function getNode(id: string): Promise<FileNode | undefined> {
  return db.files.get(id)
}

/** Update a file's content as part of a git operation (clone/pull/commit). */
export async function syncGitFile(id: string, content: string, sha: string): Promise<void> {
  await db.files.update(id, {
    content,
    originalContent: content,
    gitSha: sha,
    isGitModified: false,
    isNew: false,
    modifiedAt: Date.now(),
  })
}

/** Mark a tracked file as deleted locally (tombstone) so it can be committed as a deletion. */
export async function markTrackedDeleted(id: string): Promise<void> {
  const node = await db.files.get(id)
  if (!node) return
  await db.files.update(id, { isDeleted: true })
  if (node.parentId) {
    const parent = await db.files.get(node.parentId)
    if (parent) {
      parent.childIds = parent.childIds.filter((c) => c !== id)
      await db.files.put(parent)
    }
  }
}

/** Fully remove a file (used for untracked deletions or after committing a deletion). */
export async function hardDelete(id: string): Promise<void> {
  const node = await db.files.get(id)
  await db.files.delete(id)
  if (node?.parentId) {
    const parent = await db.files.get(node.parentId)
    if (parent) {
      parent.childIds = parent.childIds.filter((c) => c !== id)
      await db.files.put(parent)
    }
  }
}

/**
 * Delete a file or folder in a git-aware way:
 *   - tracked files become tombstones (so the next commit deletes them on GitHub)
 *   - untracked files and folders are removed immediately
 */
export async function deleteNodeGitAware(id: string): Promise<{ tombstoned: string[]; removed: string[] }> {
  const ids = await collectSubtreeIds(id)
  const tombstoned: string[] = []
  const removed: string[] = []
  const nodes = (await db.files.bulkGet(ids)).filter((n): n is FileNode => !!n)
  const files = nodes.filter((n) => n.type === 'file')
  const folders = nodes
    .filter((n) => n.type === 'folder')
    .sort((a, b) => b.path.split('/').length - a.path.split('/').length)

  for (const n of files) {
    if (!n.isNew) {
      await markTrackedDeleted(n.id)
      tombstoned.push(n.id)
    } else {
      await hardDelete(n.id)
      removed.push(n.id)
    }
  }
  for (const n of folders) {
    if (n.path === '/') continue
    await hardDelete(n.id)
    removed.push(n.id)
  }
  return { tombstoned, removed }
}

/** Fetch all tracked+deleted tombstones in a project. */
export async function listDeletedInProject(projectId: string): Promise<FileNode[]> {
  const all = await db.files.where('projectId').equals(projectId).toArray()
  return all.filter((n) => n.isDeleted)
}

export async function listAllInProject(projectId: string): Promise<FileNode[]> {
  return db.files.where('projectId').equals(projectId).toArray()
}
