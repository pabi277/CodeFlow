/* Document formatter.
 * Run with: npx tsx scripts/format.test.ts
 */
import { formatDocument } from '../src/utils/formatDocument'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  console.log('\n[json]')
  const pretty = formatDocument('{"a":1,"b":[2,3]}', 'json', 2)
  ok(pretty.ok && pretty.text === '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n', 'pretty-prints JSON')
  const bad = formatDocument('{', 'json', 2)
  ok(!bad.ok && bad.error.length > 0, 'invalid JSON returns an error')
  ok(formatDocument('   ', 'json', 2).ok, 'whitespace-only JSON is left alone')

  console.log('\n[whitespace]')
  const ws = formatDocument('foo  \nbar\t\n\n\n', 'javascript', 2)
  ok(ws.ok && ws.text === 'foo\nbar\n', `strips trailing space and extra newlines (got ${JSON.stringify(ws.ok ? ws.text : ws.error)})`)
  ok(formatDocument('x', 'python', 4).ok && formatDocument('x', 'python', 4).ok && (formatDocument('x', 'python', 4) as { text: string }).text === 'x\n', 'ensures trailing newline')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
