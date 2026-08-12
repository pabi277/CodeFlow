// Lightweight document formatter. JSON is pretty-printed; everything else
// gets trailing-whitespace stripped and a single trailing newline.

export type FormatResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export function formatDocument(content: string, language: string, tabSize = 2): FormatResult {
  if (language === 'json') {
    const trimmed = content.trim()
    if (!trimmed) return { ok: true, text: content }
    try {
      const parsed = JSON.parse(content)
      return { ok: true, text: JSON.stringify(parsed, null, tabSize) + '\n' }
    } catch (err) {
      return { ok: false, error: (err as Error).message || 'Invalid JSON' }
    }
  }

  const lines = content.split('\n').map((l) => l.replace(/[ \t]+$/g, ''))
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const text = lines.join('\n')
  return { ok: true, text: text.endsWith('\n') || text === '' ? text : text + '\n' }
}
