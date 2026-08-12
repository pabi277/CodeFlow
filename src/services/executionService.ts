// Unified execution service with a priority chain:
//   JS/TS -> browser local runner (always)
//   other -> Termux bridge (if running) -> Judge0 (if key configured) -> mock
import { runLocalJavaScript, mockSample } from './mockRunner'
import * as judge0 from './judge0Service'
import { judge0IdForLanguage, canRunLocally, languageName, detectLanguage } from '../utils/language'
import { getBridgeOrigin } from './bridgeUrl'
import type { ExecStatus } from '../types'

export type ExecutionSource = 'local' | 'termux' | 'judge0' | 'mock'

export interface ExecuteResult {
  success: boolean
  stdout: string
  stderr: string
  compileOutput: string
  status: ExecStatus
  executionTime: number
  memoryKb: number
  source: ExecutionSource
  error?: string
}

// Cache bridge availability for 30s
let bridgeCache = { available: false, checkedAt: 0 }

export async function checkTermuxBridge(): Promise<boolean> {
  if (Date.now() - bridgeCache.checkedAt < 30000) return bridgeCache.available
  try {
    const res = await fetch(`${getBridgeOrigin()}/health`, { signal: AbortSignal.timeout(1500) })
    // Bridge is considered available only if it answers with { status: "ok" }
    if (res.ok) {
      const data = await res.json().catch(() => null)
      bridgeCache = { available: data?.status === 'ok', checkedAt: Date.now() }
    } else {
      bridgeCache = { available: false, checkedAt: Date.now() }
    }
  } catch {
    bridgeCache = { available: false, checkedAt: Date.now() }
  }
  return bridgeCache.available
}

export function clearBridgeCache() {
  bridgeCache = { available: false, checkedAt: 0 }
}

function termuxLangKey(lang: string): string | null {
  const map: Record<string, string> = {
    python: 'python', javascript: 'javascript', typescript: 'typescript',
    c: 'c', cpp: 'cpp', java: 'java', bash: 'bash', shell: 'shell', sh: 'shell',
    ruby: 'ruby', php: 'php', go: 'go', rust: 'rust', kotlin: 'kotlin',
    perl: 'perl', lua: 'lua', swift: 'swift',
  }
  return map[lang] || null
}

export async function executeInTermux(
  code: string,
  language: string,
  stdin = '',
  files?: Record<string, string>,
  entry?: string,
): Promise<ExecuteResult> {
  const key = termuxLangKey(language)
  if (!key) throw new Error(`Termux does not support ${languageName(language)}.`)
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(`${getBridgeOrigin()}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: key, code, stdin, files, entry }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    clearBridgeCache()
    throw new Error('Termux bridge disconnected. Restart it with: node termux-bridge.js')
  }
  const data = await res.json()
  const elapsed = Date.now() - t0

  if (data.error && !data.success && !data.stdout && !data.stderr) {
    return { success: false, stdout: '', stderr: '', compileOutput: data.error, status: 'compile_error', executionTime: elapsed, memoryKb: 0, source: 'termux', error: data.error }
  }
  let status: ExecStatus = data.success ? 'accepted' : 'runtime_error'
  if (data.compileError) status = 'compile_error'
  if (data.timedOut) status = 'time_limit_exceeded'

  return {
    success: data.success,
    stdout: data.stdout || '',
    stderr: data.stderr || '',
    compileOutput: data.compileError ? data.stderr || '' : '',
    status,
    executionTime: data.executionTime || elapsed,
    memoryKb: 0,
    source: 'termux',
    error: data.error,
  }
}

export interface RunOptions {
  apiKey: string
  baseUrl: string
  timeLimit: number
  memoryLimit: number
}

/** Full priority-chain execution. Returns a unified result. */
export async function executeCode(
  code: string,
  path: string,
  stdin: string,
  opts: RunOptions,
  files?: Record<string, string>,
): Promise<ExecuteResult> {
  const lang = detectLanguage(path)
  const projectFiles = files && Object.keys(files).length ? files : undefined
  const hasSiblings = !!(projectFiles && Object.keys(projectFiles).length > 1)

  // 1. JS/TS run in the browser unless Termux can resolve sibling modules
  if (canRunLocally(lang) && !(hasSiblings && await checkTermuxBridge())) {
    const r = await runLocalJavaScript(code, stdin)
    return {
      success: r.status === 'accepted',
      stdout: r.stdout, stderr: r.stderr, compileOutput: r.compileOutput,
      status: r.status, executionTime: r.timeMs, memoryKb: r.memoryKb, source: 'local',
    }
  }

  // 2. Termux if available — send the whole project so imports work
  if (await checkTermuxBridge()) {
    try {
      const r = await executeInTermux(code, lang, stdin, projectFiles, path)
      // If the language is missing in Termux, surface the helpful install
      // message ("Ran in Termux — attempted locally") instead of silently
      // falling back. Only connectivity errors (thrown above) fall through.
      if (!r.error) return r
      if (r.compileOutput || r.stderr) {
        return {
          success: false, stdout: r.stdout, stderr: r.stderr, compileOutput: r.compileOutput,
          status: r.status, executionTime: r.executionTime, memoryKb: 0, source: 'termux', error: r.error,
        }
      }
      // error with no output → treat as missing/unsupported, surface it
      return {
        success: false, stdout: '', stderr: r.error || '', compileOutput: '', status: 'compile_error',
        executionTime: r.executionTime, memoryKb: 0, source: 'termux', error: r.error,
      }
    } catch (err) {
      // bridge became unavailable — JS can still run in the browser
      void err
      if (canRunLocally(lang)) {
        const r = await runLocalJavaScript(code, stdin)
        return {
          success: r.status === 'accepted',
          stdout: r.stdout, stderr: r.stderr, compileOutput: r.compileOutput,
          status: r.status, executionTime: r.timeMs, memoryKb: r.memoryKb, source: 'local',
        }
      }
    }
  }

  // 3. Judge0 if key configured
  const judge0Id = judge0IdForLanguage(lang)
  if (judge0Id && opts.apiKey) {
    const token = await judge0.submitCode(code, judge0Id, stdin, {
      apiKey: opts.apiKey, baseUrl: opts.baseUrl,
      timeLimit: opts.timeLimit, memoryLimit: opts.memoryLimit,
    })
    const result = await judge0.pollResult(token, opts.apiKey, opts.baseUrl)
    return {
      success: result.status?.id === 3,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compileOutput: result.compile_output || '',
      status: judge0Status(result.status?.id),
      executionTime: parseFloat(result.time || '0') * 1000,
      memoryKb: result.memory || 0,
      source: 'judge0',
    }
  }

  // 4. Mock fallback
  const m = mockSample(languageName(lang), code)
  return {
    success: true, stdout: m.stdout, stderr: m.stderr, compileOutput: m.compileOutput,
    status: m.status, executionTime: m.timeMs, memoryKb: m.memoryKb, source: 'mock',
  }
}

function judge0Status(id?: number): ExecStatus {
  switch (id) {
    case judge0.STATUS.ACCEPTED: return 'accepted'
    case judge0.STATUS.WRONG_ANSWER: return 'wrong_answer'
    case judge0.STATUS.TIME_LIMIT_EXCEEDED: return 'time_limit_exceeded'
    case judge0.STATUS.COMPILATION_ERROR: return 'compile_error'
    default:
      if (id && id >= judge0.STATUS.RUNTIME_ERROR_SIGSEGV && id <= judge0.STATUS.RUNTIME_ERROR_NZEC) return 'runtime_error'
      return 'system_error'
  }
}
