import expand, { extract } from 'emmet'
import type { EditorView } from '@codemirror/view'

export function expandEmmetAbbreviation(abbr: string, language: string): string | null {
  const trimmed = abbr.trim()
  if (!trimmed || trimmed.length > 200) return null
  const type = language === 'css' || language === 'scss' || language === 'less' || language === 'sass'
    ? 'stylesheet'
    : 'markup'
  try {
    const out = expand(trimmed, { type })
    return typeof out === 'string' && out.length ? out : null
  } catch {
    return null
  }
}

export function expandEmmetInEditor(view: EditorView, language: string): boolean {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const before = line.text.slice(0, pos - line.from)
  const extracted = extract(before)
  if (!extracted?.abbreviation) return false
  const expanded = expandEmmetAbbreviation(extracted.abbreviation, language)
  if (!expanded) return false
  const from = line.from + extracted.start
  const to = line.from + extracted.end
  view.dispatch({
    changes: { from, to, insert: expanded },
    selection: { anchor: from + expanded.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}
