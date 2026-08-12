// Termux live-preview + multi-file workspace helpers.
import { filesFromNodeMap, type ProjectFiles } from '../utils/htmlPreview'

export const TERMUX_ORIGIN = 'http://127.0.0.1:8080'

export function previewUrlFor(projectPath: string): string {
  const rel = projectPath.replace(/^\/+/, '')
  return `${TERMUX_ORIGIN}/preview/${rel}`
}

export async function syncTermuxWorkspace(files: ProjectFiles): Promise<boolean> {
  try {
    const res = await fetch(`${TERMUX_ORIGIN}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return !!(data && data.ok)
  } catch {
    return false
  }
}

export async function termuxSupportsPreview(): Promise<boolean> {
  try {
    const res = await fetch(`${TERMUX_ORIGIN}/health`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return !!(data && data.status === 'ok' && (data.preview === true || Number.parseFloat(data.version) >= 2))
  } catch {
    return false
  }
}

export function collectProjectFiles(nodeMap: Record<string, { type: string; path: string; content: string; isDeleted?: boolean }>): ProjectFiles {
  return filesFromNodeMap(nodeMap)
}
