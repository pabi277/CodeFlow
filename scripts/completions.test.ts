/* Tests for the enhanced autocomplete (templates, symbols, local symbols).
 * Run with: npx tsx scripts/completions.test.ts
 */
import { extractLocalSymbols } from '../src/editor/completions/localSymbols'
import { KEYWORDS_BY_LANG } from '../src/editor/completions/keywords'
import {
  PYTHON_COMPLETIONS, JS_COMPLETIONS, CPP_COMPLETIONS, C_COMPLETIONS, JAVA_COMPLETIONS,
  templateCompletion,
} from '../src/editor/completions/keywordCompletions'
import { EditorState } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'
import { CompletionContext } from '@codemirror/autocomplete'
import { getCompletionSourceForLanguage } from '../src/editor/completions'
import { setProjectIndex } from '../src/editor/completions/projectIndex'

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

  console.log('\n[c indexing]')
  const cSrc = `#include <stdio.h>
#define MAX 10
struct Node { int value; struct Node *next; };
typedef struct Node Node;
int add(int a, int b) { return a + b; }
static int count = 0;
`
  const cSyms = extractLocalSymbols(cSrc, 'c')
  ok(labels(cSyms).includes('add'), 'C finds function add')
  ok(labels(cSyms).includes('Node'), 'C finds struct Node')
  ok(labels(cSyms).includes('MAX'), 'C finds #define MAX')
  ok(labels(cSyms).includes('count'), 'C finds static variable count')
  ok(!labels(cSyms).includes('if'), 'C does not index control keywords')

  console.log('\n[c/c++ quick-fill templates]')
  ok(has(C_COMPLETIONS, 'printf'), 'C has printf (not C++ cout)')
  ok(has(C_COMPLETIONS, 'main'), 'C has main template')
  ok(has(C_COMPLETIONS, 'include'), 'C has #include')
  ok(!has(C_COMPLETIONS, 'cout'), 'C snippets do not include C++ cout')
  ok(!has(C_COMPLETIONS, 'class'), 'C snippets do not include class')
  ok(has(CPP_COMPLETIONS, 'cout'), 'C++ still has cout')
  const includeC = C_COMPLETIONS.find((c) => c.label === 'include')
  ok(!!includeC && typeof includeC.apply === 'function', 'include is a template')
  ok(KEYWORDS_BY_LANG.c.some((k) => k.label === 'restrict'), 'C keyword list has restrict')
  ok(KEYWORDS_BY_LANG.c.some((k) => k.label === 'snprintf'), 'C libc list has snprintf')
  ok(!KEYWORDS_BY_LANG.c.some((k) => k.label === 'gets'), 'C11 autocomplete does not suggest unsafe removed gets()')

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
  const nestedState = EditorState.create({ doc: '    iff', extensions: [indentUnit.of('    ')] })
  let nested = ''
  const block = templateCompletion('if', 'if ($0) {\n  \n}')
  applyOf(block)({
    state: nestedState,
    dispatch: (tr: any) => { nested = tr.changes.insert || '' },
    focus: () => {},
  }, block, 4, 7)
  ok(nested === 'if () {\n        \n    }', `nested snippets preserve base and configured indentation (got ${JSON.stringify(nested)})`)

  console.log('\n[workspace IntelliSense]')
  setProjectIndex('/src/main.ts', [
    { path: '/src/main.ts', name: 'main.ts', content: 'cons' },
    { path: '/src/math.ts', name: 'math.ts', content: 'export function calculateTotal(value: number) { return value }' },
  ])
  const source = getCompletionSourceForLanguage('typescript')
  const completionState = EditorState.create({ doc: 'calc' })
  const completionResult = source(new CompletionContext(completionState, 4, false))
  ok(!!completionResult?.options.some((entry) => entry.label === 'calculateTotal'), 'suggests symbols from sibling project files')
  const explicitState = EditorState.create({ doc: '' })
  const explicitResult = source(new CompletionContext(explicitState, 0, true))
  ok(!!explicitResult?.options.some((entry) => entry.label === 'console'), 'Ctrl+Space works at an empty cursor')
  const memberState = EditorState.create({ doc: 'items.' })
  const memberResult = source(new CompletionContext(memberState, 6, false))
  ok(!!memberResult?.options.some((entry) => entry.label === 'map'), 'member completion opens immediately after a dot')
  const typedArray = EditorState.create({ doc: 'const values = [];\nvalues.' })
  const arrayResult = source(new CompletionContext(typedArray, typedArray.doc.length, false))
  ok(!!arrayResult?.options.some((entry) => entry.label === 'push' && entry.detail === 'Array'), 'infers JavaScript array members')
  const commentState = EditorState.create({ doc: '// cons' })
  ok(source(new CompletionContext(commentState, commentState.doc.length, false)) === null, 'does not interrupt comments with suggestions')
  const wordState = EditorState.create({ doc: 'const customerReference = 1;\ncust' })
  const wordResult = source(new CompletionContext(wordState, wordState.doc.length, false))
  ok(!!wordResult?.options.some((entry) => entry.label === 'customerReference'), 'suggests useful words already used in the document')

  const pySource = getCompletionSourceForLanguage('python')
  const pyDict = EditorState.create({ doc: 'user = {}\nuser.' })
  const pyMembers = pySource(new CompletionContext(pyDict, pyDict.doc.length, false))
  ok(!!pyMembers?.options.some((entry) => entry.label === 'items' && entry.detail === 'dict'), 'infers Python dictionary members')

  const cSource = getCompletionSourceForLanguage('c')
  const cStruct = EditorState.create({ doc: 'struct User { int id; char name[20]; };\nstruct User user;\nuser.' })
  const cMembers = cSource(new CompletionContext(cStruct, cStruct.doc.length, false))
  ok(!!cMembers?.options.some((entry) => entry.label === 'id' && String(entry.detail).includes('struct User')), 'suggests actual C struct fields')

  console.log('\n[more languages]')
  ok(KEYWORDS_BY_LANG.go.some((k) => k.label === 'func'), 'Go keywords are available')
  ok(KEYWORDS_BY_LANG.rust.some((k) => k.label === 'impl'), 'Rust keywords are available')
  ok(KEYWORDS_BY_LANG.php.some((k) => k.label === 'foreach'), 'PHP keywords are available')
  ok(KEYWORDS_BY_LANG.sql.some((k) => k.label === 'SELECT'), 'SQL keywords are available')
  for (const language of ['kotlin', 'swift', 'ruby', 'lua', 'csharp', 'dart', 'scala', 'perl', 'r', 'pascal', 'groovy', 'fsharp', 'ocaml', 'clojure', 'vbnet', 'cobol']) {
    ok((KEYWORDS_BY_LANG[language]?.length || 0) > 5, `${language} has a baseline completion catalog`)
  }
  const phpSource = getCompletionSourceForLanguage('php')
  const phpState = EditorState.create({ doc: '$username = "Ada";\n$user' })
  const phpResult = phpSource(new CompletionContext(phpState, phpState.doc.length, false))
  ok(phpResult?.from === phpState.doc.length - 4 && phpResult.options.some((entry) => entry.label === 'username'), 'PHP $variables complete without duplicating the sigil')
  const go = extractLocalSymbols('func calculate(a int) int {\n  result := a\n  return result\n}', 'go')
  ok(labels(go).includes('calculate'), 'Go local function is indexed')
  const rust = extractLocalSymbols('struct User { id: u64 }\nfn load_user(id: u64) { let result = id; }', 'rust')
  ok(labels(rust).includes('User') && labels(rust).includes('load_user'), 'Rust functions and types are indexed')

  console.log('\n[keyword lists sanity]')
  ok(KEYWORDS_BY_LANG.python.some((k) => k.label === 'print'), 'python keyword list has print')
  ok(KEYWORDS_BY_LANG.javascript.some((k) => k.label === 'console'), 'js keyword list has console')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
