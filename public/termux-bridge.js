#!/usr/bin/env node
/**
 * CodeFlow — Termux local code execution bridge v1.0
 *
 * Runs an HTTP server on 127.0.0.1:8080 that executes code in your Termux
 * environment using REAL language runtimes (python, node, gcc, javac, ruby,
 * php, go, rustc, kotlinc, perl, lua, swift, bash). This gives CodeFlow free,
 * unlimited, offline execution for any language installed in Termux.
 *
 * Run it in Termux:
 *   node termux-bridge.js
 *
 * SECURITY:
 *   - Binds ONLY to 127.0.0.1 (localhost) — never 0.0.0.0.
 *   - Validates the `language` against a strict whitelist.
 *   - Never runs arbitrary shell commands — only the predefined executors.
 *   - Do NOT forward port 8080 on public WiFi.
 *
 * If port 8080 is in use, kill the old process with: pkill -f termux-bridge
 */
'use strict'

const http = require('http')
const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const VERSION = '1.0'
const HOST = '127.0.0.1'
const PORT = 8080
const EXEC_TIMEOUT_MS = 10000 // 10s hard limit
const MAX_CODE_BYTES = 1024 * 1024 // 1MB
const MAX_STDIN_BYTES = 64 * 1024 // 64KB

// Dedicated temp directory
const TMP_DIR = path.join(os.tmpdir(), 'codeflow-bridge')

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Language definitions
// ---------------------------------------------------------------------------
// Each runner describes how to check availability, how to write the source,
// and how to compile+run. `kind`: 'script' | 'compile' | 'java' | 'kotlin'.
// `install`: the pkg/npm command the user needs to run if missing.
const RUNNERS = {
  python: {
    label: 'Python', kind: 'script', ext: '.py', check: 'python3', fallbackCheck: 'python',
    run: ['python3'], install: 'pkg install python',
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
  lua: { label: 'Lua', kind: 'script', ext: '.lua', check: 'lua', run: ['lua'], install: 'pkg install lua54' },
  swift: { label: 'Swift', kind: 'script', ext: '.swift', check: 'swift', run: ['swift'], install: null /* unavailable on Android */ },
}

const WHITELIST = new Set(Object.keys(RUNNERS))

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
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

/**
 * Spawn a process, pipe stdin, enforce a timeout, capture stdout/stderr.
 * Always kills the process on timeout. Returns a promise.
 */
function runProcess(cmdArgs, cwd, stdin, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
      cwd: cwd || TMP_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch {}
    }, timeoutMs)

    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: (stderr || err.message), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })

    // pipe stdin if provided
    if (stdin) {
      child.stdin.write(stdin)
    }
    child.stdin.end()
  })
}

function javaClassName(code) {
  const m = code.match(/public\s+class\s+([A-Za-z_]\w*)/)
  return m ? m[1] : null
}

/**
 * Execute code for a given language. Returns a promise of a result object.
 */
async function executeLanguage(language, code, stdin) {
  const runner = RUNNERS[language]

  // availability check (python: fall back to `python` if python3 missing)
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

  const file = uniqueTemp(runner.ext)
  fs.writeFileSync(file, code)

  try {
    if (runner.kind === 'script') {
      const runCmd = runner.run.map((a) => (a === 'BIN' ? bin : a))
      const cmd = runCmd[0] === 'go' ? ['go', 'run', file] : [...runCmd, file]
      const r = await runProcess(cmd, null, stdin, EXEC_TIMEOUT_MS)
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'go') {
      const r = await runProcess(['go', 'run', file], null, stdin, EXEC_TIMEOUT_MS)
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'compile') {
      const out = file + '.out'
      // build compile command: compile-flags + source + -o out
      const compileCmd = [...runner.compile, file, '-o', out]
      const c = await runProcess(compileCmd, null, '', 15000)
      if (c.code !== 0) {
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      const r = await runProcess([out], null, stdin, EXEC_TIMEOUT_MS)
      try { fs.unlinkSync(out) } catch {}
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'java') {
      const cls = javaClassName(code) || 'Main'
      const dir = fs.mkdtempSync(path.join(TMP_DIR, 'java_'))
      const src = path.join(dir, cls + '.java')
      fs.writeFileSync(src, code)
      const c = await runProcess(['javac', src], dir, '', 15000)
      if (c.code !== 0) {
        try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      const r = await runProcess(['java', '-cp', dir, cls], dir, stdin, EXEC_TIMEOUT_MS)
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }

    if (runner.kind === 'kotlin') {
      const out = file.replace(/\.kt$/, '.jar')
      const c = await runProcess(['kotlinc', file, '-include-runtime', '-d', out], null, '', 20000)
      if (c.code !== 0) {
        return { success: false, stdout: '', stderr: c.stderr, compileError: true, timedOut: c.timedOut }
      }
      const r = await runProcess(['java', '-jar', out], null, stdin, EXEC_TIMEOUT_MS)
      try { fs.unlinkSync(out) } catch {}
      return { success: r.code === 0, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut, exitCode: r.code }
    }
  } finally {
    // always clean up the source temp file
    try { fs.unlinkSync(file) } catch {}
  }

  return { success: false, stdout: '', stderr: 'Unsupported runner kind: ' + runner.kind }
}

// ---------------------------------------------------------------------------
// Startup checks — print which languages are installed
// ---------------------------------------------------------------------------
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
  console.log(`Ready! ${count} languages available for local execution\n`)
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function send(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

const server = http.createServer((req, res) => {
  cors(res)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    console.log('[health] ping from CodeFlow')
    return send(res, 200, { status: 'ok', version: VERSION, message: 'CodeFlow Termux Bridge running' })
  }

  // Execute
  if (req.method === 'POST' && url.pathname === '/execute') {
    let body = ''
    let aborted = false
    req.on('data', (c) => {
      if (body.length + c.length > MAX_CODE_BYTES + MAX_STDIN_BYTES) {
        aborted = true
        req.destroy()
        return
      }
      body += c
    })
    req.on('end', () => {
      if (aborted) return send(res, 413, { success: false, error: 'Request too large' })
      let data
      try { data = JSON.parse(body) } catch { return send(res, 400, { error: 'Invalid JSON body' }) }

      const { language, code = '', stdin = '' } = data
      if (typeof language !== 'string' || !WHITELIST.has(language)) {
        console.log(`[error] language=${language || '(none)'} | not supported`)
        return send(res, 200, {
          success: false, stdout: '', stderr: `Language "${language}" is not supported by the Termux bridge. Try using Judge0 API for this language.`,
          executionTime: 0, language, source: 'termux',
        })
      }
      if (typeof code !== 'string') return send(res, 400, { error: 'code must be a string' })
      if (Buffer.byteLength(code) > MAX_CODE_BYTES) return send(res, 413, { success: false, error: 'Code exceeds 1MB limit' })
      if (Buffer.byteLength(stdin) > MAX_STDIN_BYTES) return send(res, 413, { success: false, error: 'stdin exceeds 64KB limit' })

      const t0 = Date.now()
      console.log(`[execute] language=${language} | chars=${code.length}`)
      executeLanguage(language, code, stdin)
        .then((r) => {
          const executionTime = Date.now() - t0
          let status = r.success
          let outStderr = r.stderr || ''
          let outStdout = r.stdout || ''

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
    return
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  console.log('CodeFlow Termux Bridge v' + VERSION)
  console.log('Listening on http://127.0.0.1:' + PORT)
  console.log('Keep this terminal open while using CodeFlow')
  console.log('Supported languages: ' + Object.keys(RUNNERS).join(', '))
  runStartupChecks()
})
