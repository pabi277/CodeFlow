// Fast, best-effort symbol extraction for completion, outline, and navigation.
// It intentionally avoids a language server so it remains responsive on phones.

import type { CompletionEntry } from './keywords'
import { extractCSymbols } from '../cLanguage'

export interface LocalSymbol {
  name: string
  type: 'function' | 'class' | 'variable'
  line: number
  kind?: 'import' | 'parameter'
}

const MAX_LINES = 10_000
const IDENT = '[A-Za-z_$][\\w$]*'

export function extractLocalSymbols(code: string, language: string): LocalSymbol[] {
  const lines = code.split('\n')
  if (lines.length > MAX_LINES) return []
  const symbols: LocalSymbol[] = []
  const seen = new Set<string>()

  const push = (name: string, type: LocalSymbol['type'], line: number, kind?: LocalSymbol['kind']) => {
    const key = `${type}:${name}`
    if (!name || name.length > 80 || seen.has(key)) return
    seen.add(key)
    symbols.push({ name, type, line, kind })
  }
  const pushParams = (params: string, line: number) => {
    for (const part of params.split(',')) {
      const clean = part.replace(/=[\s\S]*$/, '').trim()
      const names = clean.match(new RegExp(IDENT, 'g'))
      const name = names?.at(-1)
      if (name && !['const', 'let', 'var', 'this', 'self'].includes(name)) push(name, 'variable', line, 'parameter')
    }
  }

  if (language === 'python') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)/)
      if (fn) { push(fn[1], 'function', i + 1); pushParams(fn[2], i + 1); continue }
      const cls = line.match(/^\s*class\s+([A-Za-z_]\w*)/)
      if (cls) { push(cls[1], 'class', i + 1); continue }
      const from = line.match(/^\s*from\s+[\w.]+\s+import\s+(.+)/)
      if (from) {
        for (const item of from[1].split(',')) push((item.match(/\bas\s+(\w+)/)?.[1] || item.trim().split(/\s+/)[0]), 'variable', i + 1, 'import')
      }
      const imp = line.match(/^\s*import\s+(.+)/)
      if (imp) {
        for (const item of imp[1].split(',')) push((item.match(/\bas\s+(\w+)/)?.[1] || item.trim().split('.')[0]), 'variable', i + 1, 'import')
      }
      const assignment = line.match(/^\s*([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?!=)/)
      if (assignment) push(assignment[1], 'variable', i + 1)
      const loop = line.match(/^\s*for\s+([A-Za-z_]\w*)\s+in\b/)
      if (loop) push(loop[1], 'variable', i + 1)
    }
  } else if (language === 'javascript' || language === 'typescript') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const match of line.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})`, 'g'))) push(match[1], 'variable', i + 1)
      const fn = line.match(new RegExp(`\\b(?:async\\s+)?function\\s+(${IDENT})\\s*\\(([^)]*)`))
      if (fn) { push(fn[1], 'function', i + 1); pushParams(fn[2], i + 1) }
      const arrow = line.match(new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENT}))\\s*=>`))
      if (arrow) { push(arrow[1], 'function', i + 1); pushParams(arrow[2] || arrow[3] || '', i + 1) }
      const cls = line.match(new RegExp(`\\b(?:class|interface|type|enum)\\s+(${IDENT})`))
      if (cls) push(cls[1], 'class', i + 1)
      const imported = line.match(/\bimport\s+(?:type\s+)?\{([^}]+)\}/)
      if (imported) for (const item of imported[1].split(',')) push(item.match(/\bas\s+(\w+)/)?.[1] || item.trim(), 'variable', i + 1, 'import')
    }
  } else if (language === 'c') {
    for (const symbol of extractCSymbols(code)) push(symbol.name, symbol.type, symbol.line)
  } else if (language === 'cpp' || language === 'java') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const cls = line.match(/\b(?:class|struct|interface|enum)\s+([A-Za-z_]\w*)/)
      if (cls) push(cls[1], 'class', i + 1)
      const fn = line.match(/(?:[A-Za-z_]\w*(?:<[^>]+>)?[\s*&]+)+([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*(?:\{|throws\b|$)/)
      if (fn && !['if', 'for', 'while', 'switch', 'catch'].includes(fn[1])) {
        push(fn[1], 'function', i + 1)
        pushParams(fn[2], i + 1)
      }
      const variable = line.match(/(?:^|[;{])\s*(?:const\s+|static\s+|final\s+)?[A-Za-z_]\w*(?:<[^>]+>)?[\s*&]+([A-Za-z_]\w*)\s*(?:=|;|,|\[)/)
      if (variable) push(variable[1], 'variable', i + 1)
    }
  } else if (language === 'go') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)/)
      if (fn) { push(fn[1], 'function', i + 1); pushParams(fn[2], i + 1) }
      const type = line.match(/^\s*type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/)
      if (type) push(type[1], 'class', i + 1)
      for (const match of line.matchAll(/\b([A-Za-z_]\w*)\s*(?::=|\bvar\b[^=]*=)/g)) push(match[1], 'variable', i + 1)
    }
  } else if (language === 'rust') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/\bfn\s+([A-Za-z_]\w*)\s*\(([^)]*)/)
      if (fn) { push(fn[1], 'function', i + 1); pushParams(fn[2], i + 1) }
      const type = line.match(/\b(?:struct|enum|trait|type)\s+([A-Za-z_]\w*)/)
      if (type) push(type[1], 'class', i + 1)
      const variable = line.match(/\blet\s+(?:mut\s+)?([A-Za-z_]\w*)/)
      if (variable) push(variable[1], 'variable', i + 1)
    }
  } else if (language === 'php') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fn = line.match(/\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)/)
      if (fn) { push(fn[1], 'function', i + 1); pushParams(fn[2], i + 1) }
      const cls = line.match(/\b(?:class|interface|trait|enum)\s+([A-Za-z_]\w*)/)
      if (cls) push(cls[1], 'class', i + 1)
      for (const match of line.matchAll(/\$([A-Za-z_]\w*)/g)) push(match[1], 'variable', i + 1)
    }
  }

  return symbols
}

/** Convert local symbols into completion entries (ranked above keywords). */
export function localSymbolsToEntries(symbols: LocalSymbol[]): CompletionEntry[] {
  return symbols.map((symbol) => ({
    label: symbol.name,
    type: symbol.type === 'class' ? 'type' : symbol.type === 'function' ? 'function' : 'variable',
    detail: `line ${symbol.line}`,
    info: `${symbol.type} ${symbol.name} — defined on line ${symbol.line}`,
    origin: 'local',
  }))
}
