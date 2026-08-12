/* Tests for the enhanced autocomplete (templates, symbols, local symbols).
 * Run with: npx tsx scripts/completions.test.ts
 */
import { extractLocalSymbols } from '../src/editor/completions/localSymbols'
import { KEYWORDS_BY_LANG } from '../src/editor/completions/keywords'
import {
  PYTHON_COMPLETIONS, JS_COMPLETIONS, CPP_COMPLETIONS, JAVA_COMPLETIONS,
  symbolPairCompletion, templateCompletion,
} from '../src/editor/completions/keywordCompletions'
import type { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}
function labels(list: { label?: string; name?: string }[]) { return list.map((c) => c.label ?? c.name ?? '') }
function has(list: { label: string }[], name: string) { return list.some((c) => c.label === name) }
// apply signature: (view, completion, from, to). Inspect the apply closure by calling it.
function applyOf(c: any) { return c.apply }

const py = `def calculateSum(a, b):
    return a + b

class MyClass:
    pass

myVariable = 42
`
const js = `const myVariable = 5;
function calculateSum(x, y) { return x + y; }
class User { }
`

async function main() {
  console.log('\n[local symbols]')
  const pySyms = extractLocalSymbols(py, 'python')
  ok(labels(pySyms).includes('calculateSum'), 'python finds def calculateSum')
  ok(labels(pySyms).includes('MyClass'), 'python finds class MyClass')
  ok(labels(pySyms).includes('myVariable'), 'python finds myVariable')
  const jsSyms = extractLocalSymbols(js, 'javascript')
  ok(labels(jsSyms).includes('calculateSum'), 'js finds calculateSum')
  ok(labels(jsSyms).includes('User'), 'js finds class User')
  ok(labels(jsSyms).includes('myVariable'), 'js finds myVariable')

  console.log('\n[python quick-fill templates]')
  const printC = PYTHON_COMPLETIONS.find((c) => c.label === 'print')
  ok(!!printC, 'python has print template')
  ok(typeof printC!.apply === 'function', 'print template has apply')
  const ifC = PYTHON_COMPLETIONS.find((c) => c.label === 'if')
  ok(!!ifC, 'python has if template')
  const defC = PYTHON_COMPLETIONS.find((c) => c.label === 'def')
  ok(!!defC, 'python has def template')
  ok(labels(PYTHON_COMPLETIONS).includes('for'), 'python has for')
  ok(labels(PYTHON_COMPLETIONS).includes('class'), 'python has class')

  console.log('\n[javascript quick-fill templates]')
  ok(has(JS_COMPLETIONS, 'console.log'), 'js has console.log')
  ok(has(JS_COMPLETIONS, 'arrow'), 'js has arrow function')
  ok(has(JS_COMPLETIONS, 'Math.floor'), 'js has Math.floor')
  ok(has(JS_COMPLETIONS, 'fetch'), 'js has fetch')
  const constC = JS_COMPLETIONS.find((c) => c.label === 'const')
  ok(!!constC && typeof constC.apply === 'function', 'js const is a template')

  console.log('\n[c/c++ quick-fill templates]')
  ok(has(CPP_COMPLETIONS, 'printf'), 'cpp has printf')
  ok(has(CPP_COMPLETIONS, 'main'), 'cpp has main template')
  ok(has(CPP_COMPLETIONS, 'include'), 'cpp has #include')
  const includeC = CPP_COMPLETIONS.find((c) => c.label === 'include')
  ok(!!includeC && typeof includeC.apply === 'function', 'include is a template')

  console.log('\n[java quick-fill templates]')
  ok(has(JAVA_COMPLETIONS, 'System.out.println'), 'java has System.out.println')
  ok(has(JAVA_COMPLETIONS, 'main method'), 'java has main method template')
  ok(has(JAVA_COMPLETIONS, 'Scanner'), 'java has Scanner')
  ok(has(JAVA_COMPLETIONS, 'override'), 'java has @Override')

  console.log('\n[template cursor placement]')
  // apply should position cursor at $0. Verify via the resulting EditorState.
  const state = EditorState.create({ doc: 'pri', selection: { anchor: 3 } })
  let applied = ''
  const tpl = templateCompletion('printf', 'printf("$0");')
  const view: any = {
    state,
    dispatch: (tr: any) => {
      applied = tr.changes.insert || ''
    },
    focus: () => {},
  }
  applyOf(tpl)(view, tpl, 0, 3)
  ok(applied === 'printf("");', `template inserts 'printf("");' (got '${applied}')`)

  console.log('\n[keyword lists sanity]')
  ok(KEYWORDS_BY_LANG.python.some((k) => k.label === 'print'), 'python keyword list has print')
  ok(KEYWORDS_BY_LANG.javascript.some((k) => k.label === 'console'), 'js keyword list has console')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
