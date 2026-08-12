import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { getIndentUnit } from '@codemirror/language'

function buildGuides(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const unit = Math.max(1, getIndentUnit(view.state) || 2)
  const mark = Decoration.mark({ class: 'cm-indent-guide' })
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      const text = line.text
      let ws = 0
      while (ws < text.length && (text[ws] === ' ' || text[ws] === '\t')) ws++
      if (ws >= unit) {
        for (let col = 0; col < ws; col += unit) {
          const start = line.from + col
          const end = Math.min(line.from + col + 1, line.from + ws)
          if (end > start) builder.add(start, end, mark)
        }
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

export function indentGuides(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = buildGuides(view)
        }
        update(u: ViewUpdate) {
          if (u.docChanged || u.viewportChanged) this.decorations = buildGuides(u.view)
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.baseTheme({
      '.cm-indent-guide': {
        borderLeft: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
      },
    }),
  ]
}
