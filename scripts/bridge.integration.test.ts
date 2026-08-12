/* End-to-end test of the Termux bridge: starts a real bridge on a port and
 * verifies it executes real code (not mock) with the new contract.
 * Run with: npx tsx scripts/bridge.integration.test.ts
 */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

const PORT = 8080
const HOST = '127.0.0.1'

async function post(language: string, code: string, stdin = '') {
  const res = await fetch(`http://${HOST}:${PORT}/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, stdin }),
  })
  return res.json()
}

async function main() {
  const bridgePath = path.resolve(__dirname, '../public/termux-bridge.cjs')
  // The bridge binds a fixed port (8080); test against 8080 to keep it simple.
  const child = spawn('node', [bridgePath], { stdio: ['ignore', 'pipe', 'pipe'] })
  // wait for the server to be ready
  let ready = false
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300))
    try {
      const h = await fetch('http://127.0.0.1:8080/health')
      if (h.ok) { ready = true; break }
    } catch {}
  }
  if (!ready) {
    console.error('❌ bridge did not start')
    process.exit(1)
  }

  console.log('\n[health contract]')
  const health = await (await fetch('http://127.0.0.1:8080/health')).json()
  ok(health.status === 'ok' && health.version, 'health returns { status:"ok", version }')

  console.log('\n[real execution — python]')
  const py = await post('python', 'print("Hello from Termux!")\nx = 5 + 3\nprint(f"5 + 3 = {x}")')
  ok(py.success === true && py.stdout.includes('Hello from Termux!') && py.stdout.includes('5 + 3 = 8'), 'python runs real code, not mock')
  ok(py.source === 'termux', 'response includes source:"termux"')

  console.log('\n[stdin — python]')
  const std = await post('python', 'name=input("Name: ")\nprint(f"Hi, {name}")', 'CodeFlow')
  ok(std.success && std.stdout.includes('Hi, CodeFlow'), 'stdin is piped to the process')

  console.log('\n[real execution — C compile+run]')
  const c = await post('c', '#include <stdio.h>\nint main(){printf("C works! %d\\n", 2+2); return 0;}')
  ok(c.success === true && c.stdout.includes('C works! 4'), 'C compiles and runs')

  console.log('\n[unsupported language]')
  const bad = await post('notalang', 'x')
  ok(bad.success === false && /not supported/i.test(bad.stderr), 'unsupported language returns helpful message')

  child.kill('SIGKILL')
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
