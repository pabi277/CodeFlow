// Same-file + project-wide symbol navigation without an LSP.
// Uses the same lightweight extractors as the outline / completions.

import { extractLocalSymbols, type LocalSymbol } from '../editor/completions/localSymbols'
import { detectLanguage } from './language'

export interface SymbolHit {
  fileId: string
  path: string
  name: string
  type: LocalSymbol['type']
  line: number
  col: number
}

export interface ProjectFile {
  id: string
  path: string
  content: string
}

const IDENT = /[A-Za-z_$][\w$]*/

export function wordAt(content: string, line: number, col: number): string | null {
  const lines = content.split('\n')
  const text = lines[Math.max(0, line - 1)] || ''
  const idx = Math.max(0, Math.min(col - 1, text.length))
  if (!text) return null
  let start = idx
  let end = idx
  while (start > 0 && /[\w$]/.test(text[start - 1])) start--
  while (end < text.length && /[\w$]/.test(text[end])) end++
  const word = text.slice(start, end)
  return IDENT.test(word) ? word : null
}

export function collectFileSymbols(file: ProjectFile): SymbolHit[] {
  const lang = detectLanguage(file.path)
  return extractLocalSymbols(file.content, lang).map((s) => ({
    fileId: file.id,
    path: file.path,
    name: s.name,
    type: s.type,
    line: s.line,
    col: 1,
  }))
}

export function collectWorkspaceSymbols(files: ProjectFile[]): SymbolHit[] {
  const out: SymbolHit[] = []
  for (const f of files) {
    if (f.content.length > 400_000) continue
    out.push(...collectFileSymbols(f))
  }
  return out
}

export function findDefinitions(name: string, files: ProjectFile[], preferredFileId?: string): SymbolHit[] {
  if (!name) return []
  const hits = collectWorkspaceSymbols(files).filter((s) => s.name === name)
  hits.sort((a, b) => {
    const ap = a.fileId === preferredFileId ? 0 : 1
    const bp = b.fileId === preferredFileId ? 0 : 1
    if (ap !== bp) return ap - bp
    const rank = (t: LocalSymbol['type']) => (t === 'function' ? 0 : t === 'class' ? 1 : 2)
    return rank(a.type) - rank(b.type) || a.line - b.line
  })
  return hits
}

export function findReferences(name: string, files: ProjectFile[]): SymbolHit[] {
  if (!name) return []
  const re = wordBoundary(name)
  const hits: SymbolHit[] = []
  for (const f of files) {
    if (f.content.length > 400_000) continue
    const lines = f.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(lines[i]))) {
        hits.push({
          fileId: f.id,
          path: f.path,
          name,
          type: 'variable',
          line: i + 1,
          col: m.index + 1,
        })
        if (hits.length >= 200) return hits
      }
    }
  }
  return hits
}

export function renameInText(content: string, name: string, next: string): { text: string; count: number } {
  if (!name || !next || name === next) return { text: content, count: 0 }
  const re = wordBoundary(name)
  let count = 0
  const text = content.replace(re, () => {
    count++
    return next
  })
  return { text, count }
}

function wordBoundary(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`, 'g')
}

export function filterSymbols(symbols: SymbolHit[], query: string): SymbolHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return symbols.slice(0, 80)
  return symbols
    .map((s) => {
      const n = s.name.toLowerCase()
      const p = s.path.toLowerCase()
      let score = 0
      if (n === q) score = 100
      else if (n.startsWith(q)) score = 80
      else if (n.includes(q)) score = 50
      else if (p.includes(q)) score = 20
      return { s, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    .slice(0, 80)
    .map((x) => x.s)
}
