// Local symbol extraction — finds variables / functions / classes defined in
// the current file so they can be suggested. Uses lightweight regex (kept fast
// for large files). Skipped for files > 10k lines for performance.

import type { CompletionEntry } from './keywords'

export interface LocalSymbol {
  name: string
  type: 'function' | 'class' | 'variable'
  line: number
}

const MAX_LINES = 10000

export function extractLocalSymbols(code: string, language: string): LocalSymbol[] {
  const lines = code.split('\n')
  if (lines.length > MAX_LINES) return []
  const symbols: LocalSymbol[] = []
  const seen = new Set<string>()

  const push = (name: string, type: LocalSymbol['type'], line: number) => {
    const key = `${type}:${name}`
    if (!name || name.length > 80 || seen.has(key)) return
    seen.add(key)
    symbols.push({ name, type, line })
  }

  // JS/TS variables
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const v = line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/)
    if (v) push(v[1], 'variable', i + 1)
  }

  if (['python'].includes(language)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/)
      if (fn) { push(fn[1], 'function', i + 1); continue }
      const cls = line.match(/^\s*class\s+([A-Za-z_]\w*)/)
      if (cls) { push(cls[1], 'class', i + 1); continue }
      const imp = line.match(/^\s*(?:from\s+(\w+)\s+import|import\s+(\w+))/)
      if (imp) { const m = imp[1] || imp[2]; if (m) push(m, 'variable', i + 1) }
    }
    // python assignment variables (conservative: name = ... not starting with common keywords)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const m = line.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(?!==)/)
      if (m) push(m[1], 'variable', i + 1)
    }
  } else if (['javascript', 'typescript'].includes(language)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(|class\s+([A-Za-z_$][\w$]*))/)
      if (fn) {
        if (fn[1]) push(fn[1], 'function', i + 1)
        else if (fn[2]) push(fn[2], 'function', i + 1)
        else if (fn[3]) push(fn[3], 'class', i + 1)
      }
    }
  } else if (['c', 'cpp', 'java'].includes(language)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/(?:void|int|float|double|char|bool|long|auto|String|boolean)\s+([A-Za-z_]\w*)\s*\(/)
      if (fn) push(fn[1], 'function', i + 1)
      const cls = line.match(/(?:class|struct)\s+([A-Za-z_]\w*)/)
      if (cls) push(cls[1], 'class', i + 1)
    }
  }

  return symbols
}

/** Convert local symbols into completion entries (ranked above keywords). */
export function localSymbolsToEntries(symbols: LocalSymbol[]): CompletionEntry[] {
  return symbols.map((s) => ({
    label: s.name,
    type: s.type === 'class' ? 'type' : s.type === 'function' ? 'function' : 'variable',
  }))
}
