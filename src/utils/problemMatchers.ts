// Turn compiler / interpreter output into clickable problem locations.

export interface MatchedProblem {
  path: string
  line: number
  col: number
  message: string
  severity: 'error' | 'warning'
}

const PATTERNS: { re: RegExp; severity: 'error' | 'warning' }[] = [
  // Python: File "foo.py", line 12
  { re: /File "([^"]+)", line (\d+)/g, severity: 'error' },
  // JS / TS / Node: foo.ts:12:4
  { re: /(?:^|\s)([\w./\\-]+\.[A-Za-z][\w]*):(\d+):(\d+)/g, severity: 'error' },
  // GCC / Clang: foo.c:12:4: error: ...
  { re: /([\w./\\-]+\.[A-Za-z][\w]*):(\d+):(\d+):\s*(error|warning|note):/gi, severity: 'error' },
  // ESLint stylish: /src/a.ts  12:4  error
  { re: /([\w./\\-]+\.[A-Za-z][\w]*)\s+(\d+):(\d+)\s+(error|warning)/gi, severity: 'error' },
]

export function matchProblems(text: string): MatchedProblem[] {
  const src = text.length > 12_000 ? text.slice(0, 12_000) : text
  const out: MatchedProblem[] = []
  const seen = new Set<string>()
  for (const { re } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const path = m[1].replace(/\\/g, '/')
      const line = Number(m[2])
      const col = m[3] && /^\d+$/.test(m[3]) ? Number(m[3]) : 1
      const kind = (m[4] || '').toLowerCase()
      const severity: 'error' | 'warning' = kind === 'warning' || kind === 'note' ? 'warning' : 'error'
      if (!line || line < 1) continue
      const key = `${path}:${line}:${col}:${severity}`
      if (seen.has(key)) continue
      seen.add(key)
      const after = src.slice(m.index, m.index + 220).split('\n')[0]
      out.push({ path, line, col: col > 0 ? col : 1, message: after.trim(), severity })
    }
  }
  return out.slice(0, 80)
}

/** Paths / URLs inside a terminal line that the UI can turn into buttons. */
export function extractTerminalLinks(text: string): { kind: 'path' | 'url'; value: string; start: number; end: number }[] {
  const hits: { kind: 'path' | 'url'; value: string; start: number; end: number }[] = []
  const urlRe = /https?:\/\/[^\s)\]>'"]+/g
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text))) {
    hits.push({ kind: 'url', value: m[0], start: m.index, end: m.index + m[0].length })
  }
  const pathRe = /(?<![A-Za-z0-9_])((?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)+\.[A-Za-z][\w]*)(?::(\d+))?(?::(\d+))?/g
  while ((m = pathRe.exec(text))) {
    const start = m.index
    const end = start + m[0].length
    if (hits.some((h) => start >= h.start && start < h.end)) continue
    hits.push({ kind: 'path', value: m[0], start, end })
  }
  return hits.sort((a, b) => a.start - b.start)
}
