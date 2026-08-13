#!/usr/bin/env node
/**
 * CodeFlow — Termux local execution + preview server v2.2
 *
 * HTTP server on 127.0.0.1:8080:
 *   GET  /health          — liveness + { preview: true, interactive: true }
 *   POST /sync            — write the open project to a workspace
 *   GET  /preview/*       — serve that workspace (HTML/CSS/JS/images)
 *   POST /execute         — run a language; optional `files` + `entry`
 *                           so Python/JS can import the rest of the project
 *   GET  /poll?session=…  — poll an interactive session's output
 *   POST /stdin           — write a line to an interactive session
 *   POST /kill            — stop an interactive session
 *
 * Run it in Termux:
 *   node termux-bridge.js
 *
 * SECURITY:
 *   - Binds ONLY to 127.0.0.1 — never 0.0.0.0.
 *   - Validates `language` against a whitelist.
 *   - Preview paths cannot escape the workspace.
 *   - Never runs arbitrary shell commands — only predefined executors.
 *   - Do NOT forward port 8080 on public WiFi.
 *
 * If port 8080 is in use: pkill -f termux-bridge
 */
'use strict'

const http = require('http')
const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const VERSION = '2.2'
const HOST = '127.0.0.1'
const PORT = 8080
const EXEC_TIMEOUT_MS = 10000
const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_STDIN_BYTES = 64 * 1024
const MAX_FILES = 400

const TMP_DIR = path.join(os.tmpdir(), 'codeflow-bridge')
const WORKSPACE = path.join(TMP_DIR, 'workspace')

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

const RUNNERS = {
  python: {
    label: 'Python', kind: 'script', ext: '.py', check: 'python3', fallbackCheck: 'python',
    run: ['python3', '-u'], install: 'pkg install python',
  },
  javascript: {
    label: 'Node.js', kind: 'script', ext: '.js', check: 'node',
    run: ['node'], install: 'pkg install nodejs',
  },
  typescript: {
    label: 'TypeScript', kind: 'script', ext: '.ts', check: 'ts-node',
    run: ['ts-node'], install: 'npm install -g ts-node typescript',
  },
  c: {
    label: 'C', kind: 'compile', ext: '.c', check: 'gcc',
    compile: ['gcc', '-lm'], run: [], install: 'pkg install clang',
  },
  cpp: {
    label: 'C++', kind: 'compile', ext: '.cpp', check: 'g++',
    compile: ['g++'], run: [], install: 'pkg install clang',
  },
  java: {
    label: 'Java', kind: 'java', ext: '.java', check: 'javac',
    compile: ['javac'], run: ['java'], install: 'pkg install openjdk-17',
  },
  bash: { label: 'Bash', kind: 'script', ext: '.sh', check: 'bash', run: ['bash'], install: 'pkg install bash' },
  shell: { label: 'Bash', kind: 'script', ext: '.sh', check: 'bash', run: ['bash'], install: 'pkg install bash' },
  ruby: { label: 'Ruby', kind: 'script', ext: '.rb', check: 'ruby', run: ['ruby'], install: 'pkg install ruby' },
  php: { label: 'PHP', kind: 'script', ext: '.php', check: 'php', run: ['php'], install: 'pkg install php' },
  go: { label: 'Go', kind: 'go', ext: '.go', check: 'go', run: ['go', 'run'], install: 'pkg install golang' },
  rust: {
    label: 'Rust', kind: 'compile', ext: '.rs', check: 'rustc',
    compile: ['rustc'], run: [], install: 'pkg install rust',
  },
  kotlin: {
    label: 'Kotlin', kind: 'kotlin', ext: '.kt', check: 'kotlinc',
    compile: ['kotlinc', '-include-runtime'], run: ['java', '-jar'], install: 'pkg install kotlin',
  },
  perl: { label: 'Perl', kind: 'script', ext: '.pl', check: 'perl', run: ['perl'], install: 'pkg install perl' },
  lua: { label: 'Lua', kind: 'script', ext: '.lua', check: 'lua', fallbackCheck: 'lua54', run: ['lua'], install: 'pkg install lua54' },
  swift: { label: 'Swift', kind: 'script', ext: '.swift', check: 'swift', run: ['swift'], install: null },
}

const WHITELIST = new Set(Object.keys(RUNNERS))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.wasm': 'application/wasm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.py': 'text/plain; charset=utf-8', '.ts': 'text/plain; charset=utf-8',
}

function isInstalled(bin) {
  try {
    return require('child_process').execSync(`which ${bin}`).toString().trim().length > 0
  } catch {
    return false
  }
}

function uniqueTemp(ext) {
  ensureTmpDir()
  const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return path.join(TMP_DIR, `temp_${base}${ext}`)
}

function safeJoin(root, rel) {
  const cleaned = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const rootResolved = path.resolve(root)
  const full = path.resolve(rootResolved, cleaned)
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return null
  return full
}

function writeWorkspace(files) {
  ensureTmpDir()
  fs.rmSync(WORKSPACE, { recursive: true, force: true })
  fs.mkdirSync(WORKSPACE, { recursive: true })
  let count = 0
  const entries = Object.entries(files || {})
  for (const [p, content] of entries.slice(0, MAX_FILES)) {
    if (typeof content !== 'string') continue
    const dest = safeJoin(WORKSPACE, p)
    if (!dest) continue
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, content)
    count++
  }
  return count
}

const MAX_STREAM = 256 * 1024

function appendStream(buf, chunk) {
  if (buf.length >= MAX_STREAM) return buf
  const s = chunk.toString()
  if (buf.length + s.length <= MAX_STREAM) return buf + s
  return buf + s.slice(0, MAX_STREAM - buf.length) + '\n…[truncated]…'
}

function runProcess(cmdArgs, cwd, stdin, timeoutMs, extraEnv) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
      cwd: cwd || TMP_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    })
    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch { /* ignore */ }
    }, timeoutMs)
    child.stdout.on('data', (d) => { stdout = appendStream(stdout, d) })
    child.stderr.on('data', (d) => { stderr = appendStream(stderr, d) })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: (stderr || err.message), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
    if (stdin) child.stdin.write(stdin)
    child.stdin.end()
  })
}

const INTERACTIVE_MS = 5 * 60 * 1000
const sessions = new Map()

function writeUnbufHelper() {
  ensureTmpDir()
  const p = path.join(TMP_DIR, 'codeflow_unbuf.c')
  fs.writeFileSync(p, [
    '#include <stdio.h>',
    '__attribute__((constructor)) static void codeflow_unbuf(void) {',
    '  setvbuf(stdout, NULL, _IONBF, 0);',
    '  setvbuf(stderr, NULL, _IONBF, 0);',
    '}',
    '',
  ].join('\n'))
  return p
}

function spawnInteractive(cmdArgs, cwd, extraEnv, cleanup) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
    cwd: cwd || TMP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  })
  const sess = {
    id, child, stdout: '', stderr: '', done: false, code: null, timedOut: false, started: Date.now(),
  }
  const runCleanup = () => { if (typeof cleanup === 'function') { try { cleanup() } catch { /* ignore */ } } }
  child.stdout.on('data', (d) => { sess.stdout = appendStream(sess.stdout, d) })
  child.stderr.on('data', (d) => { sess.stderr = appendStream(sess.stderr, d) })
  child.on('error', (err) => {
    sess.stderr = appendStream(sess.stderr, err.message)
    sess.done = true
    sess.code = 1
    runCleanup()
  })
  child.on('close', (code) => {
    sess.done = true
    sess.code = code
    clearTimeout(sess.timer)
    runCleanup()
  })
  sess.timer = setTimeout(() => {
    sess.timedOut = true
    try { child.kill('SIGKILL') } catch { /* ignore */ }
  }, INTERACTIVE_MS)
  sessions.set(id, sess)
  return sess
}

function sessionPayload(sess) {
  return {
    sessionId: sess.id,
    interactive: true,
    stdout: sess.stdout,
    stderr: sess.timedOut ? (sess.stderr || 'Interactive session timed out after 5 minutes') : sess.stderr,
    done: sess.done,
    success: sess.done && sess.code === 0 && !sess.timedOut,
    timedOut: sess.timedOut,
    executionTime: Date.now() - sess.started,
    source: 'termux',
  }
}

function getSession(id) {
  return id ? sessions.get(String(id)) : null
}

function killSession(sess) {
  if (!sess) return
  try { sess.child.kill('SIGKILL') } catch { /* ignore */ }
  sess.done = true
  clearTimeout(sess.timer)
}

function javaClassName(code) {
  const m = code.match(/public\s+class\s+([A-Za-z_]\w*)/)
  return m ? m[1] : null
}

function guessEntry(files, language) {
  const ext = (RUNNERS[language] && RUNNERS[language].ext) || ''
  const names = Object.keys(files || {})
  const preferred = names.find((p) => /(^|\/)main\.\w+$/i.test(p) && p.endsWith(ext))
  if (preferred) return preferred
  return names.find((p) => p.endsWith(ext)) || names[0] || null
}

async function executeLanguage(language, code, stdin, files, entry, interactive) {
  const runner = RUNNERS[language]
  let bin = runner.check
  if (!isInstalled(bin) && runner.fallbackCheck && isInstalled(runner.fallbackCheck)) {
    bin = runner.fallbackCheck
  }
  if (!isInstalled(bin)) {
    const msg =
      runner.install === null
        ? `${runner.label} is not available on Android/Termux.`
        : `${runner.label} not installed. Run in Termux: ${runner.install}`
    return { success: false, stdout: '', stderr: msg, missing: true }
  }

  let cwd = null
  let file
  const hasFiles = files && typeof files === 'object' && Object.keys(files).length > 0

  if (hasFiles) {
    const merged = { ...files }
    const entryPath = entry || guessEntry(merged, language)
    if (entryPath && typeof code === 'string') merged[entryPath] = code
    writeWorkspace(merged)
    cwd = WORKSPACE
    file = safeJoin(WORKSPACE, entryPath || ('main' + runner.ext))
    if (!file) file = uniqueTemp(runner.ext)
    if (!fs.existsSync(file)) fs.writeFileSync(file, code)
  } else {
    file = uniqueTemp(runner.ext)
    fs.writeFileSync(file, code)
  }

  const extraEnv = cwd
    ? { PYTHONPATH: cwd, NODE_PATH: cwd }
    : undefined

  // Interactive sessions consume their temp artifact asynchronously, so the
  // file must live until the session ends — the cleanup callback removes it.
  const cleanupTemp = () => {
    try { fs.unlinkSync(file) } catch { /* ignore */ }
  }

  try {
    if (runner.kind === 'script') {
      const runCmd = runner.run.map((a) => (a === 'BIN' || a === runner.check ? bin : a))
      const cmd = [...runCmd, file]
      if (interactive) {
        const sess = spawnInteractive(cmd, cwd, extraEnv, !hasFiles ? cleanupTemp : undefined)
        if (stdin) try { sess.child.stdin.write(stdin) } catch { /* ignore */ }
        return { session: sess }
      }
      const r = await runProcess(cmd, cwd, stdin, EXEC_TIMEOUT_MS, extraEnv)
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'go') {
      if (interactive) {
        const sess = spawnInteractive(['go', 'run', file], cwd, extraEnv, !hasFiles ? cleanupTemp : undefined)
        if (stdin) try { sess.child.stdin.write(stdin) } catch { /* ignore */ }
        return { session: sess }
      }
      const r = await runProcess(['go', 'run', file], cwd, stdin, EXEC_TIMEOUT_MS, extraEnv)
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'compile') {
      const out = file + '.out'
      const unbuf = writeUnbufHelper()
      const compileCmd = [...runner.compile, file, unbuf, '-o', out]
      const c = await runProcess(compileCmd, cwd, '', 15000)
      if (c.code !== 0) {
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      if (interactive) {
        const sess = spawnInteractive([out], cwd, undefined, () => {
          try { fs.unlinkSync(out) } catch { /* ignore */ }
          if (!hasFiles) cleanupTemp()
        })
        if (stdin) try { sess.child.stdin.write(stdin) } catch { /* ignore */ }
        return { session: sess }
      }
      const r = await runProcess([out], cwd, stdin, EXEC_TIMEOUT_MS)
      try { fs.unlinkSync(out) } catch { /* ignore */ }
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'java') {
      const srcCode = fs.readFileSync(file, 'utf8')
      const cls = javaClassName(srcCode) || 'Main'
      const dir = cwd || fs.mkdtempSync(path.join(TMP_DIR, 'java_'))
      if (!cwd) {
        const src = path.join(dir, cls + '.java')
        fs.writeFileSync(src, srcCode)
      }
      const c = await runProcess(['javac', file], dir, '', 15000)
      if (c.code !== 0) {
        if (!cwd) try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      const r = await runProcess(['java', '-cp', dir, cls], dir, stdin, EXEC_TIMEOUT_MS)
      if (!cwd) try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'kotlin') {
      const out = file.replace(/\.kt$/, '.jar')
      const c = await runProcess(['kotlinc', file, '-include-runtime', '-d', out], cwd, '', 20000)
      if (c.code !== 0) {
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      const r = await runProcess(['java', '-jar', out], cwd, stdin, EXEC_TIMEOUT_MS)
      try { fs.unlinkSync(out) } catch { /* ignore */ }
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }
  } finally {
    // Non-interactive runs are done by now; interactive sessions clean up their
    // own temp file when the process exits (see cleanupTemp above).
    if (!hasFiles && !interactive) {
      try { fs.unlinkSync(file) } catch { /* ignore */ }
    }
  }

  return { success: false, stdout: '', stderr: 'Unsupported runner kind: ' + runner.kind }
}

function runStartupChecks() {
  console.log('\nChecking installed languages...')
  let count = 0
  for (const lang of Object.keys(RUNNERS)) {
    const runner = RUNNERS[lang]
    const ok = isInstalled(runner.check) || (runner.fallbackCheck && isInstalled(runner.fallbackCheck))
    if (ok) {
      count++
      console.log(`  ✅ ${runner.label}: ${runner.check}`)
    } else {
      const msg = runner.install === null ? 'not available on Android/Termux' : `not installed (run: ${runner.install})`
      console.log(`  ❌ ${runner.label}: ${msg}`)
    }
  }
  console.log(`Ready! ${count} languages · live HTML preview at /preview/\n`)
}

function cors(req, res) {
  // Echo Origin so Chrome Private / Local Network Access from the Vercel HTTPS
  // app can reach this loopback server. Wildcard + PNA is rejected by Chrome.
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Request-Private-Network, Access-Control-Request-Local-Network')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Allow-Local-Network', 'true')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
}

function send(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let body = ''
    let aborted = false
    req.on('data', (c) => {
      if (aborted) return
      if (body.length + c.length > max) {
        aborted = true
        req.destroy()
        reject(new Error('too large'))
        return
      }
      body += c
    })
    req.on('end', () => { if (!aborted) resolve(body) })
    req.on('error', reject)
  })
}

function servePreview(req, res, url) {
  let rel = decodeURIComponent(url.pathname.replace(/^\/preview\/?/, ''))
  if (!rel || rel.endsWith('/')) {
    const index = safeJoin(WORKSPACE, path.join(rel, 'index.html'))
    if (index && fs.existsSync(index) && fs.statSync(index).isFile()) rel = path.join(rel, 'index.html')
  }
  const dest = safeJoin(WORKSPACE, rel)
  if (!dest) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    return res.end('Forbidden')
  }
  if (!fs.existsSync(dest) || !fs.statSync(dest).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('Not found: /' + rel)
  }
  const ext = path.extname(dest).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const data = fs.readFileSync(dest)
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
  })
  if (req.method === 'HEAD') return res.end()
  res.end(data)
}

const server = http.createServer((req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
    return send(res, 200, {
      status: 'ok',
      version: VERSION,
      preview: true,
      interactive: true,
      message: 'CodeFlow Termux Bridge running',
    })
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/preview' || url.pathname.startsWith('/preview/'))) {
    return servePreview(req, res, url)
  }

  if (req.method === 'POST' && url.pathname === '/sync') {
    readBody(req, MAX_BODY_BYTES)
      .then((raw) => {
        let data
        try { data = JSON.parse(raw) } catch { return send(res, 400, { error: 'Invalid JSON body' }) }
        const count = writeWorkspace(data.files || {})
        console.log(`[sync] wrote ${count} files to workspace`)
        send(res, 200, { ok: true, files: count, preview: '/preview/' })
      })
      .catch((err) => send(res, err.message === 'too large' ? 413 : 400, { error: err.message }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/execute') {
    readBody(req, MAX_BODY_BYTES)
      .then((raw) => {
        let data
        try { data = JSON.parse(raw) } catch { return send(res, 400, { error: 'Invalid JSON body' }) }

        const { language, code = '', stdin = '', files, entry, interactive } = data
        if (typeof language !== 'string' || !WHITELIST.has(language)) {
          console.log(`[error] language=${language || '(none)'} | not supported`)
          return send(res, 200, {
            success: false, stdout: '', stderr: `Language "${language}" is not supported by the Termux bridge. Try using Judge0 API for this language.`,
            executionTime: 0, language, source: 'termux',
          })
        }
        if (typeof code !== 'string') return send(res, 400, { error: 'code must be a string' })
        if (Buffer.byteLength(stdin) > MAX_STDIN_BYTES) return send(res, 413, { success: false, error: 'stdin exceeds 64KB limit' })

        const t0 = Date.now()
        const extra = files && typeof files === 'object' ? ` | files=${Object.keys(files).length}` : ''
        console.log(`[execute] language=${language} | chars=${code.length}${extra}`)
        executeLanguage(language, code, stdin, files, entry, !!interactive)
          .then((r) => {
            if (r.session) {
              setTimeout(() => send(res, 200, sessionPayload(r.session)), 80)
              return
            }
            const executionTime = Date.now() - t0
            let status = r.success
            let outStderr = r.stderr || ''
            const outStdout = r.stdout || ''
            if (r.timedOut) {
              status = false
              outStderr = 'Execution timed out after 10 seconds'
            }
            const result = {
              success: status,
              stdout: outStdout,
              stderr: outStderr,
              executionTime,
              language,
              source: 'termux',
            }
            if (r.missing) {
              result.missing = true
              result.error = outStderr
              console.log(`[missing] ${language} not found - user needs to install it`)
            }
            if (r.compileError) {
              result.compileError = true
              result.stderr = outStderr
              console.log(`[compile] language=${language} | compile error`)
            }
            if (r.timedOut) console.log(`[timeout] language=${language} | killed after 10s`)
            console.log(`[done] language=${language} | time=${executionTime}ms | success=${status}`)
            send(res, 200, result)
          })
          .catch((err) => {
            console.log(`[error] language=${language} | ${err.message}`)
            send(res, 500, { success: false, stdout: '', stderr: err.message, executionTime: 0, language, source: 'termux' })
          })
      })
      .catch((err) => send(res, err.message === 'too large' ? 413 : 400, { error: err.message }))
    return
  }

  if (req.method === 'GET' && url.pathname === '/poll') {
    const sess = getSession(url.searchParams.get('session'))
    if (!sess) return send(res, 404, { error: 'No such session', done: true })
    return send(res, 200, sessionPayload(sess))
  }

  if (req.method === 'POST' && url.pathname === '/stdin') {
    readBody(req, MAX_STDIN_BYTES)
      .then((raw) => {
        let data
        try { data = JSON.parse(raw) } catch { return send(res, 400, { error: 'Invalid JSON body' }) }
        const sess = getSession(data.sessionId)
        if (!sess || sess.done) return send(res, 404, { error: 'Session is not running', done: true })
        let text = typeof data.text === 'string' ? data.text : ''
        if (text && !text.endsWith('\n')) text += '\n'
        try { sess.child.stdin.write(text) } catch (err) {
          return send(res, 500, { error: err.message, done: sess.done })
        }
        send(res, 200, sessionPayload(sess))
      })
      .catch((err) => send(res, 400, { error: err.message }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/kill') {
    readBody(req, 4096)
      .then((raw) => {
        let data
        try { data = JSON.parse(raw || '{}') } catch { data = {} }
        const sess = getSession(data.sessionId)
        if (sess) killSession(sess)
        send(res, 200, sess ? sessionPayload(sess) : { done: true })
      })
      .catch((err) => send(res, 400, { error: err.message }))
    return
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  ensureTmpDir()
  fs.mkdirSync(WORKSPACE, { recursive: true })
  console.log('CodeFlow Termux Bridge v' + VERSION)
  console.log('Listening on http://127.0.0.1:' + PORT)
  console.log('Preview server: http://127.0.0.1:' + PORT + '/preview/')
  console.log('Keep this terminal open while using CodeFlow')
  console.log('Supported languages: ' + Object.keys(RUNNERS).join(', '))
  runStartupChecks()
})
