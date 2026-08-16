/**
 * Replace comments and quoted content with spaces while preserving line/column
 * positions. Regex symbol extraction can then avoid indexing examples, prose,
 * URLs, and disabled code as real declarations.
 */
export function maskNonCode(source: string, language: string): string {
  const hashComments = ['python', 'ruby', 'shell', 'perl', 'r'].includes(language)
  const out = source.split('')
  let quote = ''
  let blockComment = false
  let lineComment = false

  const blank = (index: number) => {
    if (out[index] !== '\n' && out[index] !== '\r') out[index] = ' '
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      else blank(i)
      continue
    }
    if (blockComment) {
      blank(i)
      if (char === '*' && next === '/') { blank(i + 1); blockComment = false; i++ }
      continue
    }
    if (quote) {
      blank(i)
      if (char === '\\') { blank(i + 1); i++; continue }
      if (char === quote) quote = ''
      continue
    }
    if (char === '/' && next === '*') {
      blank(i); blank(i + 1); blockComment = true; i++; continue
    }
    if (char === '/' && next === '/') {
      blank(i); blank(i + 1); lineComment = true; i++; continue
    }
    if (hashComments && char === '#') {
      blank(i); lineComment = true; continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      blank(i)
    }
  }
  return out.join('')
}
