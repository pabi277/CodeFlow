// Path manipulation utilities. Paths use POSIX-style forward slashes,
// project-relative, always starting with '/'.
export const ROOT_PATH = '/'

export function join(...parts: (string | null | undefined)[]): string {
  return (
    '/' +
    parts
      .filter((p): p is string => !!p)
      .join('/')
      .split('/')
      .filter(Boolean)
      .join('/')
  )
}

export function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx <= 0) return ROOT_PATH
  return path.slice(0, idx)
}

export function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

export function extname(path: string): string {
  const base = basename(path)
  const idx = base.lastIndexOf('.')
  return idx > 0 ? base.slice(idx) : ''
}

/** Depth of a path (number of segments). Root = 0 */
export function depth(path: string): number {
  return path.split('/').filter(Boolean).length
}

export function getExtension(path: string): string {
  return extname(path).toLowerCase().replace('.', '')
}

/** Invalid characters for file/folder names (portable-safe) */
const INVALID_NAME_CHARS = /[\/\\:*?"<>|]/

export function validateName(name: string): string | null {
  if (!name || name.trim() === '') return 'Name cannot be empty'
  if (name.length > 255) return 'Name must be 255 characters or fewer'
  if (INVALID_NAME_CHARS.test(name)) return 'Name contains invalid characters'
  if (name === '.' || name === '..') return 'Invalid name'
  return null
}
