import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { startCompletion } from '@codemirror/autocomplete'

// Registry so non-editor components (KeyboardToolbar, CommandPalette) can
// drive the single mounted CodeMirror instance.
let view: EditorView | null = null

export function registerEditor(v: EditorView | null) {
  view = v
}
export function getEditor(): EditorView | null {
  return view
}

export function insertText(text: string) {
  if (!view) return
  view.dispatch(view.state.replaceSelection(text))
  view.focus()
}

export function moveCursorLeft() {
  if (!view) return
  const pos = view.state.selection.main.head
  view.dispatch({ selection: { anchor: Math.max(0, pos - 1) }, scrollIntoView: true })
  view.focus()
}

export function moveCursorRight() {
  if (!view) return
  const pos = view.state.selection.main.head
  view.dispatch({ selection: { anchor: Math.min(view.state.doc.length, pos + 1) }, scrollIntoView: true })
  view.focus()
}

export function undoAction() {
  if (!view) return
  undo(view)
  view.focus()
}

export function redoAction() {
  if (!view) return
  redo(view)
  view.focus()
}

export function indentAtCursor() {
  insertText('  ')
}

export function openFind() {
  if (!view) return
  openSearchPanel(view)
  view.focus()
}

export function triggerCompletion() {
  if (!view) return
  view.focus()
  startCompletion(view)
}

