// Strip / render a subset of ANSI SGR sequences used by compilers and CLIs.

export interface AnsiSpan {
  text: string
  className: string
}

const SGR: Record<number, string> = {
  0: '',
  1: 'font-bold',
  2: 'opacity-70',
  3: 'italic',
  4: 'underline',
  30: 'text-zinc-400',
  31: 'text-red-400',
  32: 'text-emerald-400',
  33: 'text-amber-300',
  34: 'text-sky-400',
  35: 'text-fuchsia-400',
  36: 'text-cyan-400',
  37: 'text-ink',
  90: 'text-ink-muted',
  91: 'text-red-300',
  92: 'text-emerald-300',
  93: 'text-yellow-300',
  94: 'text-blue-300',
  95: 'text-pink-300',
  96: 'text-cyan-300',
  97: 'text-white',
}

const ESC = '\x1b'
const CSI = new RegExp(`${ESC}\\[([0-9;]*)m`, 'g')
const ANSI_SEQUENCE = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g')

export function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE, '')
}

export function parseAnsi(text: string): AnsiSpan[] {
  if (!text.includes('\x1b[')) return [{ text, className: '' }]
  const spans: AnsiSpan[] = []
  let last = 0
  let cls: string[] = []
  CSI.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CSI.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index), className: cls.join(' ') })
    const codes = (m[1] || '0').split(';').map((n) => Number(n || '0'))
    for (const code of codes) {
      if (code === 0) cls = []
      else if (SGR[code] !== undefined) {
        const next = SGR[code]
        if (!next) cls = []
        else if (!cls.includes(next)) cls.push(next)
      }
    }
    last = m.index + m[0].length
  }
  if (last < text.length) spans.push({ text: text.slice(last), className: cls.join(' ') })
  return spans.filter((s) => s.text.length > 0)
}
