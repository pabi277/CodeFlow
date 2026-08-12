import { indentService, indentUnit } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { cIndentAfterLine } from '../utils/formatC'

/** Brace-based indent so C statements in the same block share one column. */
export function cIndent(): Extension {
  return indentService.of((context, pos) => {
    const line = context.lineAt(pos)
    const lineNo = context.state.doc.lineAt(line.from).number
    let prevText = ''
    for (let n = lineNo - 1; n >= 1; n--) {
      const t = context.state.doc.line(n).text
      if (t.trim()) {
        prevText = t
        break
      }
    }
    const unit = context.state.facet(indentUnit)
    const tabSize = unit.startsWith('\t') ? 4 : Math.max(1, unit.length)
    const nextClose = /^\s*[}\])]/.test(line.text)
    return cIndentAfterLine(prevText, tabSize, nextClose)
  })
}
