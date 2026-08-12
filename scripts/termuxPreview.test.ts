/* Preview URL helper.
 * Run with: npx tsx scripts/termuxPreview.test.ts
 */
import { previewUrlFor } from '../src/services/termuxPreview'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  ok(previewUrlFor('/preview.html') === 'http://127.0.0.1:8080/preview/preview.html', 'root html')
  ok(previewUrlFor('/css/style.css') === 'http://127.0.0.1:8080/preview/css/style.css', 'nested css')
  ok(previewUrlFor('pages/index.html') === 'http://127.0.0.1:8080/preview/pages/index.html', 'no leading slash')
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
