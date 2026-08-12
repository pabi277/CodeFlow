import { Annotation, EditorState } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

interface TagPair {
  name: string
  openFrom: number
  openTo: number
  closeFrom: number
  closeTo: number
}

const TAG = /<\/?([A-Za-z][\w:-]*)/
const TransactionSync = Annotation.define<boolean>()
const highlight = Decoration.mark({ class: 'cm-linked-tag' })

function findPair(doc: string, pos: number): TagPair | null {
  let start = pos
  while (start > 0 && doc[start] !== '<') start--
  if (doc[start] !== '<') {
    const from = Math.max(0, pos - 40)
    const look = doc.slice(from, pos + 40)
    const rel = look.lastIndexOf('<')
    if (rel < 0) return null
    start = from + rel
  }
  const slice = doc.slice(start, Math.min(doc.length, start + 80))
  const m = slice.match(TAG)
  if (!m || m.index !== 0) return null
  const name = m[1]
  const isClose = slice.startsWith('</')
  const nameFrom = start + (isClose ? 2 : 1)
  const nameTo = nameFrom + name.length

  if (isClose) {
    const open = findOpen(doc, start, name)
    if (!open) return null
    return { name, openFrom: open.from, openTo: open.to, closeFrom: nameFrom, closeTo: nameTo }
  }
  const close = findClose(doc, nameTo, name)
  if (!close) return null
  return { name, openFrom: nameFrom, openTo: nameTo, closeFrom: close.from, closeTo: close.to }
}

function findClose(doc: string, from: number, name: string): { from: number; to: number } | null {
  const re = new RegExp(`</?${name}\\b`, 'gi')
  re.lastIndex = from
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = re.exec(doc))) {
    const close = doc[m.index + 1] === '/'
    if (close) {
      depth--
      if (depth === 0) return { from: m.index + 2, to: m.index + 2 + name.length }
    } else {
      const end = doc.indexOf('>', m.index)
      if (end > 0 && doc[end - 1] === '/') continue
      depth++
    }
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return null
}

function findOpen(doc: string, closeStart: number, name: string): { from: number; to: number } | null {
  const re = new RegExp(`</?${name}\\b`, 'gi')
  const chunk = doc.slice(0, closeStart)
  const matches = [...chunk.matchAll(re)]
  let depth = 0
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const idx = m.index ?? 0
    const close = chunk[idx + 1] === '/'
    if (close) depth++
    else {
      const end = chunk.indexOf('>', idx)
      if (end > 0 && chunk[end - 1] === '/') continue
      if (depth === 0) return { from: idx + 1, to: idx + 1 + name.length }
      depth--
    }
  }
  return null
}

function decorate(view: EditorView): DecorationSet {
  const pair = findPair(view.state.doc.toString(), view.state.selection.main.head)
  if (!pair) return Decoration.none
  return Decoration.set([
    highlight.range(pair.openFrom, pair.openTo),
    highlight.range(pair.closeFrom, pair.closeTo),
  ])
}

export function linkedEditing(): Extension {
  return [
    EditorState.transactionExtender.of((tr) => {
      if (!tr.docChanged || tr.annotation(TransactionSync)) return null
      const pair = findPair(tr.startState.doc.toString(), tr.startState.selection.main.head)
      if (!pair) return null
      const extra: { from: number; to: number; insert: string }[] = []
      tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        const inOpen = fromA >= pair.openFrom && toA <= pair.openTo
        const inClose = fromA >= pair.closeFrom && toA <= pair.closeTo
        if (inOpen) {
          const from = tr.changes.mapPos(pair.closeFrom + (fromA - pair.openFrom), 1)
          const to = tr.changes.mapPos(pair.closeFrom + (toA - pair.openFrom), 1)
          extra.push({ from, to, insert: inserted.toString() })
        } else if (inClose) {
          const from = tr.changes.mapPos(pair.openFrom + (fromA - pair.closeFrom), 1)
          const to = tr.changes.mapPos(pair.openFrom + (toA - pair.closeFrom), 1)
          extra.push({ from, to, insert: inserted.toString() })
        }
      })
      if (!extra.length) return null
      return { changes: extra, annotations: TransactionSync.of(true) }
    }),
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = decorate(view)
        }
        update(u: ViewUpdate) {
          if (u.docChanged || u.selectionSet) this.decorations = decorate(u.view)
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.baseTheme({
      '.cm-linked-tag': {
        outline: '1px dashed color-mix(in srgb, var(--accent, #89b4fa) 70%, transparent)',
        borderRadius: '2px',
      },
    }),
  ]
}
