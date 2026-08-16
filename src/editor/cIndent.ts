import { indentService, indentUnit } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { cIndentAfterLines } from '../utils/formatC'

/** Brace-based indent so C statements in the same block share one column. */
export function cIndent(): Extension {
  return indentService.of((context, pos) => {
    const line = context.lineAt(pos)
    const lineNo = context.state.doc.lineAt(line.from).number
    let prevText = ''
    let beforePrev = ''
    for (let n = lineNo - 1; n >= 1; n--) {
      const text = context.state.doc.line(n).text
      if (!text.trim()) continue
      if (!prevText) prevText = text
      else { beforePrev = text; break }
    }
    const unit = context.state.facet(indentUnit)
    const tabSize = unit.startsWith('\t') ? context.state.tabSize : Math.max(1, unit.length)
    const nextClose = /^\s*[}\])]/.test(line.text)
    return cIndentAfterLines(prevText, beforePrev, tabSize, nextClose)
  })
}
