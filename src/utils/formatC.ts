// Brace-aware C / C++ reindent. Does not rewrite tokens — only leading spaces
// so `int y;` and `y=6;` sit on the same column inside a block.

export function formatCIndent(content: string, tabSize = 2): string {
  const width = Math.max(1, Math.min(8, tabSize || 2))
  const raw = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n')
  const out: string[] = []
  let depth = 0
  let blockComment = false

  for (const original of lines) {
    const scan = scanLine(original, blockComment)
    blockComment = scan.blockComment
    const trimmed = original.replace(/[ \t]+$/g, '').trimStart()

    if (!trimmed) {
      out.push('')
      continue
    }

    if (!scan.wasCommentOnly && trimmed.startsWith('#')) {
      out.push(trimmed)
      depth = Math.max(0, depth + scan.delta)
      continue
    }

    let level = depth
    if (/^[}\])]/.test(trimmed)) level = Math.max(0, depth - 1)
    else if (/^(case|default)\b/.test(trimmed)) level = Math.max(0, depth - 1)

    out.push(' '.repeat(level * width) + trimmed)
    depth = Math.max(0, depth + scan.delta)
  }

  while (out.length > 1 && out[out.length - 1] === '') out.pop()
  const text = out.join('\n')
  return text.endsWith('\n') || text === '' ? text : text + '\n'
}

function scanLine(line: string, blockComment: boolean): { delta: number; blockComment: boolean; wasCommentOnly: boolean } {
  let delta = 0
  let i = 0
  let quote: '"' | "'" | null = null
  let lineComment = false
  let code = false
  const len = line.length

  while (i < len) {
    const ch = line[i]
    const next = line[i + 1]
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i += 2
        continue
      }
      i++
      continue
    }
    if (lineComment) break
    if (quote) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i++
      continue
    }
    if (ch === '/' && next === '/') {
      lineComment = true
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      code = true
      i++
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      delta++
      code = true
    } else if (ch === '}' || ch === ')' || ch === ']') {
      delta--
      code = true
    } else if (!/\s/.test(ch)) {
      code = true
    }
    i++
  }

  return { delta, blockComment, wasCommentOnly: !code }
}

/** Indent (in columns) for a new line after `prev`. */
export function cIndentAfterLine(prev: string, tabSize: number, nextStartsWithClose = false): number {
  return cIndentAfterLines(prev, '', tabSize, nextStartsWithClose)
}

/**
 * Context-aware Enter indentation for C/C++. In particular, leave a one-line
 * `if`/`for` body after its first statement instead of carrying that temporary
 * indent onto every following line.
 */
export function cIndentAfterLines(prev: string, beforePrev: string, tabSize: number, nextStartsWithClose = false): number {
  const width = Math.max(1, Math.min(8, tabSize || 4))
  const scan = scanLine(prev, false)
  const trimmed = prev.trim()
  const base = (prev.match(/^[ \t]*/)?.[0] || '').replace(/\t/g, ' '.repeat(width)).length
  const beforeTrimmed = beforePrev.trim()
  const beforeBase = (beforePrev.match(/^[ \t]*/)?.[0] || '').replace(/\t/g, ' '.repeat(width)).length
  const oneLineControl = /^(?:if|for|while)\s*\([^{}]*\)\s*$|^else\s*$/.test(beforeTrimmed)

  if (nextStartsWithClose) return trimmed.endsWith('{') || trimmed.endsWith('(') ? base : Math.max(0, base - width)
  if (/^#/.test(trimmed)) return 0
  if (oneLineControl && base > beforeBase) return beforeBase
  if (trimmed.endsWith('{') || trimmed.endsWith('(') || scan.delta > 0) return base + width
  if (/^(?:if|for|while|switch)\s*\([^{}]*\)\s*$|^else\s*$/.test(trimmed)) return base + width
  return base
}
