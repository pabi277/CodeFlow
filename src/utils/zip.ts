// ZIP import/export helpers. jszip & file-saver are loaded lazily so they only
// add to the bundle when the user actually exports or imports a project.

import { listAllInProject } from '../db/files'
import type { FileNode } from '../types'
import { fileToStoredContent, isBinaryPath, isDataUrl, isImagePath, mimeForPath } from './binary'

/**
 * Export a project's files as a downloadable .zip archive.
 * Preserves the folder structure. Returns a Blob (caller can save or share).
 */
export async function buildProjectZip(projectId: string): Promise<Blob> {
  const [{ default: JSZip }, files] = await Promise.all([
    import('jszip'),
    listAllInProject(projectId),
  ])
  const zip = new JSZip()
  for (const f of files) {
    if (f.type !== 'file') continue
    const rel = f.path.replace(/^\//, '')
    if (rel) zip.file(rel, f.content || '')
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export async function downloadProjectZip(projectId: string, projectName: string) {
  const [blob, { saveAs }] = await Promise.all([buildProjectZip(projectId), import('file-saver')])
  const safe = (projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_')
  saveAs(blob, `${safe}.zip`)
}

/** Build a ZIP containing a folder and all of its descendants. */
export async function buildFolderZip(folderId: string, nodeMap: Record<string, FileNode>): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const folder = nodeMap[folderId]
  if (!folder || folder.type !== 'folder') throw new Error('Folder not found')

  const zip = new JSZip()
  const addNode = (node: FileNode, prefix: string) => {
    if (node.type === 'file') {
      const path = `${prefix}${node.name}`
      if (isDataUrl(node.content)) {
        const comma = node.content.indexOf(',')
        if (comma >= 0) {
          zip.file(path, node.content.slice(comma + 1), { base64: true })
          return
        }
      }
      zip.file(path, node.content || '')
      return
    }
    const childPrefix = `${prefix}${node.name}/`
    for (const childId of node.childIds) {
      const child = nodeMap[childId]
      if (child) addNode(child, childPrefix)
    }
  }

  addNode(folder, '')
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export async function downloadFolderZip(folderId: string, nodeMap: Record<string, FileNode>, folderName: string) {
  const [blob, { saveAs }] = await Promise.all([buildFolderZip(folderId, nodeMap), import('file-saver')])
  const safe = (folderName || 'folder').replace(/[^a-zA-Z0-9-_]/g, '_')
  saveAs(blob, `${safe}.zip`)
}

/**
 * Parse a .zip File and return a flat list of {path, content}.
 * Used for the "Import from ZIP" flow.
 */
export async function parseZipFile(file: File | Blob | ArrayBuffer): Promise<{ path: string; content: string }[]> {
  const { default: JSZip } = await import('jszip')
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const zip = await JSZip.loadAsync(data)
  const out: { path: string; content: string }[] = []
  const entries = Object.values(zip.files).filter((e) => !e.dir)
  for (const e of entries) {
    if (isImagePath(e.name) || isBinaryPath(e.name)) {
      const b64 = await e.async('base64')
      out.push({ path: e.name, content: `data:${mimeForPath(e.name)};base64,${b64}` })
    } else {
      const content = await e.async('string')
      out.push({ path: e.name, content })
    }
  }
  return out
}

/**
 * Read a set of File objects (from a multi-file or webkitdirectory input) into
 * flat {path, content} entries, preserving relative folder paths.
 */
export async function filesToEntries(files: FileList | File[]): Promise<{ path: string; content: string }[]> {
  const out: { path: string; content: string }[] = []
  const list = Array.from(files)
  for (const f of list) {
    // webkitRelativePath gives e.g. "myproj/src/main.py"
    let rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (!rel) rel = f.name
    rel = rel.replace(/\\/g, '/')
    const content = await fileToStoredContent(f)
    out.push({ path: rel, content })
  }
  return out
}

/**
 * Convert flat {path, content} entries into a seed structure usable by the
 * project creator (which walks paths and creates folders + files).
 */
export function entriesToSeed(entries: { path: string; content: string }[]): { path: string; content: string }[] {
  // Strip a common top-level folder if present (e.g. from webkitdirectory) so
  // the project root is the folder itself.
  const paths = entries.map((e) => e.path)
  const firstSegments = new Set(paths.map((p) => p.split('/')[0]))
  if (paths.length > 1 && firstSegments.size === 1) {
    return entries.map((e) => {
      const idx = e.path.indexOf('/')
      return { path: idx >= 0 ? e.path.slice(idx + 1) : e.path, content: e.content }
    })
  }
  return entries
}
