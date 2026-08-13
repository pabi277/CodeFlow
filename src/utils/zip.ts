// ZIP import/export helpers. jszip & file-saver are loaded lazily so they only
// add to the bundle when the user actually exports or imports a project.

import { listAllInProject } from '../db/files'
import { dataUrlBase64, fileToStoredContent, isBinaryPath, isDataUrl, isImagePath, mimeForPath } from './binary'

/**
 * Convert a stored file content (text, or a data: URL for binary files) into
 * a real Blob suitable for downloading or sharing.
 */
export function storedContentToBlob(content: string, path: string): Blob {
  if (isDataUrl(content)) {
    try {
      const [meta, b64] = content.slice(5).split(',')
      const bin = atob(b64.replace(/\s/g, ''))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new Blob([bytes], { type: meta.split(';')[0] || mimeForPath(path) })
    } catch {
      // fall through to text blob
    }
  }
  return new Blob([content], { type: mimeForPath(path) })
}

type ZipLike = { file: (name: string, data: string, opts?: { base64?: boolean; binary?: boolean }) => unknown }

/**
 * Write one stored file into a zip archive. Binary content is stored either
 * as a data URL (imported via ZIP / file picker) or as raw latin1 bytes
 * (cloned from GitHub); write it back as bytes so it round-trips exactly,
 * while text files are written as UTF-8 text. The data-URL branch only
 * applies to binary paths so a text file that merely contains
 * data-URL-looking text exports as text.
 */
function addStoredFile(zip: ZipLike, name: string, content: string, path: string): void {
  const binaryPath = isBinaryPath(path) || isImagePath(path)
  const dataUrl = binaryPath ? dataUrlBase64(content || '') : null
  if (dataUrl) zip.file(name, dataUrl.data, { base64: true })
  else if (binaryPath) zip.file(name, content || '', { binary: true })
  else zip.file(name, content || '')
}

/**
 * Build a .zip archive of a folder's subtree (or a single file). File paths
 * inside the archive are relative to the given folder so unzipping yields a
 * clean folder. Returns a Blob (caller can save or share).
 */
export async function buildSubtreeZip(projectId: string, folderPath: string): Promise<Blob> {
  const [{ default: JSZip }, files] = await Promise.all([
    import('jszip'),
    listAllInProject(projectId),
  ])
  const zip = new JSZip()
  const prefix = folderPath === '/' ? '' : folderPath.replace(/^\//, '') + '/'
  for (const f of files) {
    if (f.type !== 'file' || f.isDeleted) continue
    const rel = f.path.replace(/^\//, '')
    if (prefix && !rel.startsWith(prefix)) continue
    addStoredFile(zip, rel.slice(prefix.length) || f.name, f.content, f.path)
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

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
    if (f.type !== 'file' || f.isDeleted) continue
    const rel = f.path.replace(/^\//, '')
    if (!rel) continue
    addStoredFile(zip, rel, f.content, f.path)
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export async function downloadProjectZip(projectId: string, projectName: string) {
  const [blob, { saveAs }] = await Promise.all([buildProjectZip(projectId), import('file-saver')])
  const safe = (projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_')
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
