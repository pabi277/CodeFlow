// Guess tab size / spaces-vs-tabs from the first chunk of a file.

export interface IndentGuess {
  tabSize: number
  indentWithSpaces: boolean
}

const SAMPLE = 80

export function detectIndent(content: string): IndentGuess | null {
  if (!content) return null
  const lines = content.split('\n')
  let tabIndented = 0
  const spaceCounts: Record<number, number> = {}
  let sampled = 0

  for (const line of lines) {
    if (sampled >= SAMPLE) break
    if (!line || !line.trim()) continue
    if (line.startsWith('\t')) {
      tabIndented++
      sampled++
      continue
    }
    const m = line.match(/^( +)/)
    if (!m) continue
    const n = m[1].length
    if (n < 1 || n > 16) continue
    spaceCounts[n] = (spaceCounts[n] || 0) + 1
    sampled++
  }

  if (sampled < 2) return null
  const spaceIndented = Object.values(spaceCounts).reduce((a, b) => a + b, 0)
  if (tabIndented > spaceIndented && tabIndented >= 2) {
    return { tabSize: 4, indentWithSpaces: false }
  }
  if (spaceIndented < 2) return null

  const sizes = Object.keys(spaceCounts).map(Number).sort((a, b) => a - b)
  const min = sizes[0]
  if (min === 2 || min === 3 || min === 4 || min === 8) {
    return { tabSize: min, indentWithSpaces: true }
  }
  // Fall back to the most common indent that divides every sample.
  for (const cand of [4, 2, 8, 3]) {
    if (sizes.every((n) => n % cand === 0)) return { tabSize: cand, indentWithSpaces: true }
  }
  return { tabSize: 4, indentWithSpaces: true }
}
