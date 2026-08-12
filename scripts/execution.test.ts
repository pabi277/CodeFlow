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

  console.log('\n[HTML -> preview hint, no Termux]')
  const html = await executeCode('<h1>hi</h1>', 'index.html', '', opts)
  ok(html.source === 'local', `HTML does not hit Termux/mock (got ${html.source})`)
  ok(/preview/i.test(html.stdout), 'HTML run points at Preview')

  console.log('\n[JSON -> not executable]')
  const json = await executeCode('{}', 'data.json', '', opts)
  ok(json.success === true, 'JSON run does not fail the UI')
  ok(/not executable/i.test(json.stdout), 'JSON explains it is not runnable')

  const { filterWorkspaceFiles, getLanguageProfile } = await import('../src/utils/language')
  const { clipOutput: clip } = await import('../src/services/executionService')
  ok(getLanguageProfile('main.py').termuxKey === 'python', 'Python profile has Termux key')
  ok(getLanguageProfile('index.html').execute === 'preview', 'HTML is preview-only')
  const packed = filterWorkspaceFiles({
    '/main.py': 'import util',
    '/util.py': 'x=1',
    '/readme.md': '# no',
    '/photo.svg': '<svg/>',
  }, 'python', '/main.py')
  ok(!!packed && packed['/util.py'] === 'x=1' && !packed['/readme.md'], 'Python workspace keeps only .py')
  ok(clip('a'.repeat(60_000)).includes('truncated'), 'clipOutput trims huge dumps')
  const { usesInteractiveInput } = await import('../src/utils/language')
  ok(usesInteractiveInput('scanf("%d", &x);', 'c'), 'detects C scanf')
  ok(!usesInteractiveInput('printf("hi");', 'c'), 'printf-only is not interactive')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
