import { EditorSelection, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { undo, redo, addCursorBelow, selectParentSyntax, indentWithTab } from '@codemirror/commands'
import { openSearchPanel, selectNextOccurrence } from '@codemirror/search'
import { insertBracket, snippet, startCompletion } from '@codemirror/autocomplete'
import { expandEmmetInEditor } from '../editor/emmetExpand'
import { wordAt } from './symbolNav'
import { toCmSnippet } from './snippets'

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
  // Toolbar input bypasses CodeMirror's normal DOM typing path. Route single
  // brackets through the close-bracket helper so `(` inserts `()` and tapping
  // `)` in front of an auto-closed bracket moves over it instead of duplicating.
  const bracket = text.length === 1 && `()[]{}'"\``.includes(text)
    ? insertBracket(view.state, text)
    : null
  if (bracket) view.dispatch(bracket)
  else view.dispatch(view.state.replaceSelection(text))
  view.focus()
}

/** Insert a snippet with tab-stops (`$1`, `${name}`, `${cursor}` / `$0`). */
export function insertSnippet(body: string) {
  if (!view) return
  const tpl = toCmSnippet(body)
  const { from, to } = view.state.selection.main
  snippet(tpl)(view, { label: 'snippet' }, from, to)
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
  if (!view) return
  // Use the active indentUnit (2/4/8 spaces or a tab), including .editorconfig
  // and auto-detected indentation, rather than the old hard-coded two spaces.
  indentWithTab.run?.(view)
  view.focus()
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
    // Programmatic loads (revert, format, rename, tab switch) must not pollute
    // the undo history — otherwise tapping Undo after switching tabs would
    // write one file's text into another.
    annotations: Transaction.addToHistory.of(false),
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
