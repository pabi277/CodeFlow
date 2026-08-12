/* Emmet expansion.
 * Run with: npx tsx scripts/emmet.test.ts
 */
import { expandEmmetAbbreviation } from '../src/editor/emmetExpand'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  const ul = expandEmmetAbbreviation('ul>li*3', 'html')
  ok(!!ul && ul.includes('<ul>') && (ul.match(/<li/g) || []).length === 3, 'expands ul>li*3')
  const div = expandEmmetAbbreviation('div.container', 'html')
  ok(!!div && div.includes('class="container"'), 'expands class shorthand')
  const css = expandEmmetAbbreviation('m10', 'css')
  ok(!!css && /margin:\s*10px/.test(css), `expands CSS m10 (got ${css})`)
  ok(expandEmmetAbbreviation('', 'html') === null, 'empty abbr is null')
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
