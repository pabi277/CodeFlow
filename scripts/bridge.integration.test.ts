/* End-to-end test of the Termux bridge: starts a real bridge on a port and
 * verifies it executes real code (not mock) with the new contract.
 * Run with: npx tsx scripts/bridge.integration.test.ts
 */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

const PORT = 8080
const HOST = '127.0.0.1'

async function post(language: string, code: string, stdin = '', extra: Record<string, unknown> = {}) {
  const res = await fetch(`http://${HOST}:${PORT}/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, stdin, ...extra }),
  })
  return res.json()
}

async function main() {
  // The Settings "Copy Bridge Script" button serves /termux-bridge.js. The .cjs
  // twin exists only so the repo's `"type": "module"` doesn't matter when the
  // test spawns `node` on it. They must be the same program.
  console.log('\n[bridge files in sync]')
  const jsPath = path.resolve(__dirname, '../public/termux-bridge.js')
  const cjsPath = path.resolve(__dirname, '../public/termux-bridge.cjs')
  const jsSrc = readFileSync(jsPath, 'utf8')
  const cjsSrc = readFileSync(cjsPath, 'utf8')
  ok(jsSrc === cjsSrc, 'termux-bridge.js and termux-bridge.cjs are identical')
  ok(jsSrc.includes('appendStream'), 'copied script defines appendStream')
  ok(jsSrc.includes("'/poll'"), 'copied script serves GET /poll')
  ok(jsSrc.includes("'/stdin'"), 'copied script serves POST /stdin')
  ok(jsSrc.includes("'/kill'"), 'copied script serves POST /kill')
  ok(jsSrc.includes('Access-Control-Allow-Private-Network'), 'copied script sends Private-Network header')
  ok(jsSrc.includes('Access-Control-Allow-Local-Network'), 'copied script sends Local-Network header')
  ok(jsSrc.includes('interactive'), 'copied script executes with interactive')
  ok(jsSrc.includes("VERSION = '2.2'"), 'bridge VERSION bumped to 2.2')

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
  ok(health.preview === true, 'v2 bridge advertises preview:true')
  ok(health.interactive === true, 'v2.2 bridge advertises interactive:true')

  console.log('\n[cors / private-network headers]')
  const corsRes = await fetch('http://127.0.0.1:8080/health')
  ok(!!corsRes.headers.get('access-control-allow-origin'), 'CORS allow-origin present')
  ok(corsRes.headers.get('access-control-allow-private-network') === 'true', 'Access-Control-Allow-Private-Network: true')
  ok(corsRes.headers.get('access-control-allow-local-network') === 'true', 'Access-Control-Allow-Local-Network: true')

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

  console.log('\n[multi-file python imports]')
  const multi = await post('python', 'from util import add\nprint(add(2, 3))\n', '', {
    files: { '/main.py': 'from util import add\nprint(add(2, 3))\n', '/util.py': 'def add(a, b):\n    return a + b\n' },
    entry: '/main.py',
  })
  ok(multi.success === true && String(multi.stdout).includes('5'), `python imports sibling module (got ${JSON.stringify(multi.stdout)} / ${JSON.stringify(multi.stderr)})`)

  console.log('\n[live preview server]')
  const sync = await fetch('http://127.0.0.1:8080/sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: {
        '/index.html': '<link rel="stylesheet" href="css/app.css"><h1>Hi</h1>',
        '/css/app.css': 'h1{color:red}',
      },
    }),
  })
  const syncJson = await sync.json()
  ok(sync.ok && syncJson.ok, 'POST /sync writes workspace')
  const html = await (await fetch('http://127.0.0.1:8080/preview/index.html')).text()
  ok(html.includes('css/app.css'), 'GET /preview/index.html serves HTML')
  const css = await (await fetch('http://127.0.0.1:8080/preview/css/app.css')).text()
  ok(css.includes('color:red'), 'GET /preview/css/app.css serves stylesheet')
  const escape = await fetch('http://127.0.0.1:8080/preview/../../etc/passwd')
  ok(escape.status === 403 || escape.status === 404, `path traversal blocked (got ${escape.status})`)

  console.log('\n[interactive session — /poll /stdin /kill]')
  const inter = await post('python', 'import sys\nprint("go", flush=True)\nline = sys.stdin.readline()\nprint("echo:" + line.strip())', '', { interactive: true })
  ok(!!inter.sessionId && inter.interactive === true, `interactive execute returns a sessionId (got ${JSON.stringify(inter)})`)
  const sessId = inter.sessionId
  let polled: any = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150))
    polled = await (await fetch(`http://127.0.0.1:8080/poll?session=${sessId}`)).json()
    if (String(polled.stdout || '').includes('go')) break
  }
  ok(!!polled && String(polled.stdout).includes('go'), 'interactive session stdout polled')
  const stdinRes = await fetch('http://127.0.0.1:8080/stdin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessId, text: 'hello' }),
  })
  ok(stdinRes.ok, 'POST /stdin accepted')
  let echoed: any = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150))
    echoed = await (await fetch(`http://127.0.0.1:8080/poll?session=${sessId}`)).json()
    if (String(echoed.stdout || '').includes('echo:hello')) break
  }
  ok(!!echoed && String(echoed.stdout).includes('echo:hello'), 'stdin line echoed back via poll')
  const killed = await (await fetch('http://127.0.0.1:8080/kill', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessId }),
  })).json()
  ok(killed.done === true, 'POST /kill stops the session')

  child.kill('SIGKILL')
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
