export interface SearchOptions {
  matchCase?: boolean
  regex?: boolean
  wholeWord?: boolean
}

export interface SearchHit {
  id: string
  path: string
  lineNo: number
  line: string
}

function compile(query: string, opts: SearchOptions): RegExp | null {
  const q = query
  if (!q) return null
  try {
    let source = opts.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (opts.wholeWord && !opts.regex) source = `\\b${source}\\b`
    const flags = opts.matchCase ? 'g' : 'gi'
    return new RegExp(source, flags)
  } catch {
    return null
  }
}

export function searchInFiles(
  files: { id: string; path: string; content: string; type: string }[],
  query: string,
  opts: SearchOptions = {},
  limit = 200,
): SearchHit[] {
  const re = compile(query, opts)
  if (!re) return []
  const out: SearchHit[] = []
  for (const n of files) {
    if (n.type !== 'file') continue
    const lines = n.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0
      if (re.test(lines[i])) {
        out.push({ id: n.id, path: n.path, lineNo: i + 1, line: lines[i].trim() })
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

export function replaceInText(text: string, query: string, replacement: string, opts: SearchOptions = {}): { text: string; count: number } {
  const re = compile(query, opts)
  if (!re) return { text, count: 0 }
  let count = 0
  const next = text.replace(re, () => {
    count++
    return replacement
  })
  return { text: next, count }
}
