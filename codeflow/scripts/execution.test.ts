/* Tests for the unified execution service priority chain.
 * Run with: npx tsx scripts/execution.test.ts
 * (No Termux bridge expected running; tests the fallback behaviour.)
 */
import { executeCode, clearBridgeCache, checkTermuxBridge } from '../src/services/executionService'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

const opts = { apiKey: '', baseUrl: '', timeLimit: 5, memoryLimit: 128 }

async function main() {
  console.log('\n[bridge availability]')
  clearBridgeCache()
  const available = await checkTermuxBridge()
  ok(typeof available === 'boolean', 'checkTermuxBridge returns a boolean (no bridge running here)')

  console.log('\n[JavaScript -> local runner]')
  const js = await executeCode('console.log("hi", 2+2)', 'hello.js', '', opts)
  ok(js.source === 'local', `JS uses local runner (got ${js.source})`)
  ok(js.stdout.includes('hi 4'), 'JS stdout correct')

  console.log('\n[Python -> no bridge, no key -> mock]')
  const py = await executeCode('print("x")', 'main.py', '', opts)
  ok(py.source === 'mock', `Python falls back to mock (got ${py.source})`)

  console.log('\n[TypeScript -> local runner]')
  const ts = await executeCode('const n: number = 1; console.log(n)', 'app.ts', '', opts)
  ok(ts.source === 'local', 'TS uses local runner')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
