/* Regression test for the "undo after switching tabs overwrites the other file"
 * bug: programmatic document loads (tab switches / replaceDocument) must not be
 * recorded in CodeMirror's undo history, while real user edits must be.
 * Run with: npx tsx scripts/editorHistory.test.ts */
import { EditorState, Transaction } from '@codemirror/state'
import { history, historyField } from '@codemirror/commands'
import { registerEditor, replaceDocument } from '../src/utils/editorApi'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  console.log('\n[1] replaceDocument dispatches with addToHistory:false')
  const dispatched: any[] = []
  registerEditor({
    state: { doc: { length: 5 } },
    dispatch: (tr: any) => dispatched.push(tr),
    focus: () => {},
  } as any)
  replaceDocument('hello')
  ok(dispatched.length === 1, 'replaceDocument dispatched one transaction')
  const spec = dispatched[0]
  ok(
    spec?.annotations?.type === Transaction.addToHistory && spec?.annotations?.value === false,
    'programmatic replace is marked addToHistory:false',
  )
  registerEditor(null)

  console.log('\n[2] programmatic loads stay out of history; user edits are recorded')
  let state = EditorState.create({ doc: '', extensions: [history()] })
  const dispatch = (spec: any) => { state = state.update(spec).state }
  const doneCount = () => (state.field(historyField, false) as any).done.length

  // Load file A programmatically — must not create an undo step.
  dispatch({ changes: { from: 0, to: state.doc.length, insert: 'print(1)' }, annotations: Transaction.addToHistory.of(false) })
  ok(state.doc.toString() === 'print(1)' && doneCount() === 0, 'programmatic load leaves history empty')

  // A real edit IS recorded and undoable within the file.
  dispatch({ changes: { from: state.doc.length, insert: 'X' } })
  ok(state.doc.toString() === 'print(1)X' && doneCount() === 1, 'user edit recorded in history')

  // Switch to file B programmatically — previous file's history must not leak.
  dispatch({ changes: { from: 0, to: state.doc.length, insert: 'def util()' }, annotations: Transaction.addToHistory.of(false) })
  ok(state.doc.toString() === 'def util()' && doneCount() === 0, 'tab switch clears the previous file\'s undo history')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main()
