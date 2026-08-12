/* Project search / replace.
 * Run with: npx tsx scripts/projectSearch.test.ts
 */
import { replaceInText, searchInFiles } from '../src/utils/projectSearch'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  const files = [
    { id: 'a', path: '/a.js', type: 'file', content: 'const foo = 1\nFoo bar\n' },
    { id: 'b', path: '/b.md', type: 'file', content: 'hello foo world\n' },
  ]
  ok(searchInFiles(files, 'foo').length === 3, 'case-insensitive finds 3')
  ok(searchInFiles(files, 'foo', { matchCase: true }).length === 2, 'match case finds 2')
  ok(searchInFiles(files, 'foo', { wholeWord: true }).length >= 2, 'whole word')
  ok(searchInFiles(files, 'f.o', { regex: true }).length >= 2, 'regex')
  const r = replaceInText('foo Foo foo', 'foo', 'x', {})
  ok(r.count === 3 && r.text === 'x x x', `replace all case-insensitive (got ${r.count} ${JSON.stringify(r.text)})`)
  const r2 = replaceInText('foo Foo', 'foo', 'x', { matchCase: true })
  ok(r2.count === 1 && r2.text === 'x Foo', 'replace match case')
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
