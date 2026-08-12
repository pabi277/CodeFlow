import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const OPEN = new Set(Object.keys(PAIRS))
const CLOSE = new Set(Object.values(PAIRS))
const COLORS = ['#e06c75', '#e5c07b', '#98c379', '#61afef', '#c678dd', '#56b6c2']
const MARKS = COLORS.map((c, i) =>
  Decoration.mark({ class: `cm-rb cm-rb-${i}`, attributes: { style: `color:${c}` } }),
)

function scan(doc: string): { from: number; to: number; depth: number }[] {
  const hits: { from: number; to: number; depth: number }[] = []
  const stack: { ch: string; pos: number; depth: number }[] = []
  let depth = 0
  let quote: string | null = null
  let escape = false
  let lineComment = false
  let blockComment = false

  for (let i = 0; i < doc.length; i++) {
    const ch = doc[i]
    const next = doc[i + 1]
    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (OPEN.has(ch)) {
      stack.push({ ch, pos: i, depth })
      hits.push({ from: i, to: i + 1, depth })
      depth++
    } else if (CLOSE.has(ch)) {
      const open = stack.pop()
      if (open && PAIRS[open.ch] === ch) {
        depth = open.depth
        hits.push({ from: i, to: i + 1, depth })
      }
    }
  }
  return hits
}

function build(doc: string): DecorationSet {
  if (doc.length > 200_000) return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  const hits = scan(doc).sort((a, b) => a.from - b.from)
  for (const h of hits) {
    builder.add(h.from, h.to, MARKS[h.depth % MARKS.length])
  }
  return builder.finish()
}

export function rainbowBrackets(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = build(view.state.doc.toString())
        }
        update(u: ViewUpdate) {
          if (u.docChanged) this.decorations = build(u.state.doc.toString())
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.baseTheme({
      '.cm-rb': { fontWeight: '600' },
    }),
  ]
}
