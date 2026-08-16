/* Document formatter.
 * Run with: npx tsx scripts/format.test.ts
 */
import { formatDocument } from '../src/utils/formatDocument'
import { cIndentAfterLines } from '../src/utils/formatC'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function main() {
  console.log('\n[json]')
  const pretty = await formatDocument('{"a":1,"b":[2,3]}', 'json', 2)
  ok(pretty.ok && pretty.text === '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n', 'pretty-prints JSON')
  const bad = await formatDocument('{', 'json', 2)
  ok(!bad.ok && bad.error.length > 0, 'invalid JSON returns an error')
  ok((await formatDocument('   ', 'json', 2)).ok, 'whitespace-only JSON is left alone')

  console.log('\n[prettier js]')
  const js = await formatDocument('const x=1;function f(){return x}', 'javascript', 2)
  ok(js.ok && js.text.includes('function f()') && js.text.includes('const x = 1'), `prettier formats JS (got ${JSON.stringify(js.ok ? js.text : js.error)})`)

  console.log('\n[c indent]')
  const messy = [
    '#include <stdio.h>',
    '',
    'int main(void) {',
    '  int y;',
    '    y=6;',
    '  return 0;',
    '}',
    '',
  ].join('\n')
  const c = await formatDocument(messy, 'c', 2)
  ok(c.ok && c.text.includes('  int y;\n  y=6;\n  return 0;'), `C statements share one indent (got ${JSON.stringify(c.ok ? c.text : c.error)})`)
  const hash = await formatDocument(['  #include <stdio.h>', 'int main(){', 'int x;', '}', ''].join('\n'), 'c', 2)
  ok(hash.ok && hash.text.startsWith('#include'), 'preprocessor stays in column 0')
  ok(cIndentAfterLines('    work();', 'if (ready)', 4) === 0, 'Enter dedents after a one-line if body')
  ok(cIndentAfterLines('    work();', 'if (ready) {', 4) === 4, 'Enter keeps block indentation after a statement')
  ok(cIndentAfterLines('if (ready) {', '', 4) === 4, 'Enter uses the configured four-space indent after an opening block')
  ok(cIndentAfterLines('        work();', '', 4, true) === 4, 'closing bracket dedents one configured level')

  console.log('\n[whitespace]')
  const ws = await formatDocument('foo  \nbar\t\n\n\n', 'python', 2)
  ok(ws.ok && ws.text === 'foo\nbar\n', `strips trailing space and extra newlines (got ${JSON.stringify(ws.ok ? ws.text : ws.error)})`)
  const py = await formatDocument('x', 'python', 4)
  ok(py.ok && py.text === 'x\n', 'ensures trailing newline')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
