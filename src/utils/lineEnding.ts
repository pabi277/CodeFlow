export type LineEnding = 'lf' | 'crlf' | 'cr'

export function detectLineEnding(text: string): LineEnding {
  let crlf = 0
  let lf = 0
  let cr = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r' && text[i + 1] === '\n') {
      crlf++
      i++
    } else if (text[i] === '\n') lf++
    else if (text[i] === '\r') cr++
  }
  if (crlf >= lf && crlf >= cr && crlf > 0) return 'crlf'
  if (cr > lf && cr > crlf) return 'cr'
  return 'lf'
}

export function convertLineEnding(text: string, to: LineEnding): string {
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (to === 'crlf') return norm.replace(/\n/g, '\r\n')
  if (to === 'cr') return norm.replace(/\n/g, '\r')
  return norm
}

export function lineEndingLabel(ending: LineEnding): string {
  return ending === 'crlf' ? 'CRLF' : ending === 'cr' ? 'CR' : 'LF'
}
