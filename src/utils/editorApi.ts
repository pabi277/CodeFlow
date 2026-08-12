import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { undo, redo, addCursorBelow, selectParentSyntax } from '@codemirror/commands'
import { openSearchPanel, selectNextOccurrence } from '@codemirror/search'
import { startCompletion } from '@codemirror/autocomplete'
import { expandEmmetInEditor } from '../editor/emmetExpand'
import { wordAt } from './symbolNav'

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

export function getCursorPosition(): { line: number; col: number } {
  if (!view) return { line: 1, col: 1 }
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  return { line: line.number, col: pos - line.from + 1 }
}

export function goToPosition(line: number, col = 1) {
  if (!view) return
  const doc = view.state.doc
  const clampedLine = Math.min(Math.max(1, line), doc.lines)
  const ln = doc.line(clampedLine)
  const pos = Math.min(ln.from + Math.max(0, col - 1), ln.to)
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    scrollIntoView: true,
  })
  view.focus()
}

export function replaceDocument(text: string) {
  if (!view) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  })
  view.focus()
}

export function selectNextMatch() {
  if (!view) return
  selectNextOccurrence(view)
  view.focus()
}

export function addCursorDown() {
  if (!view) return
  addCursorBelow(view)
  view.focus()
}

export function expandEmmet(language = 'html') {
  if (!view) return false
  return expandEmmetInEditor(view, language)
}

export function expandSmartSelection() {
  if (!view) return
  selectParentSyntax(view)
  view.focus()
}

export function getWordAtCursor(): string | null {
  if (!view) return null
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  return wordAt(view.state.doc.toString(), line.number, pos - line.from + 1)
}

export function parseLineCol(input: string): { line: number; col: number } | null {
  const m = input.trim().match(/^(\d+)\s*[: ,]\s*(\d+)$/) || input.trim().match(/^(\d+)$/)
  if (!m) return null
  const line = Number(m[1])
  const col = m[2] ? Number(m[2]) : 1
  if (!Number.isFinite(line) || line < 1) return null
  return { line, col: Number.isFinite(col) && col > 0 ? col : 1 }
}
