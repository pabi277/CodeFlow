import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/** Re-indent a multi-line paste so it matches the current line's indent. */
export function indentPasted(text: string, baseIndent: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return text
  let min = Infinity
  for (const line of lines) {
    if (!line.trim()) continue
    const ws = (line.match(/^[ \t]*/)?.[0] || '').length
    if (ws < min) min = ws
  }
  if (!Number.isFinite(min)) min = 0
  return lines
    .map((line, i) => {
      if (i === 0) return line.replace(/^[ \t]*/, '')
      if (!line.trim()) return ''
      return baseIndent + line.slice(min)
    })
    .join('\n')
}

export function formatOnPaste(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const clip = event.clipboardData?.getData('text/plain')
      if (!clip || !clip.includes('\n')) return false
      event.preventDefault()
      const pos = view.state.selection.main.from
      const line = view.state.doc.lineAt(pos)
      const base = (line.text.match(/^[ \t]*/)?.[0] || '')
      const insert = indentPasted(clip, base)
      view.dispatch(view.state.replaceSelection(insert))
      return true
    },
  })
}
