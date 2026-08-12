// Local execution used as the default (no API key needed).
// JavaScript/TypeScript are actually executed in a sandboxed Function
// capturing console output. Other languages return a friendly mock result
// that points the user to Judge0 for real execution.

export interface MockRunResult {
  stdout: string
  stderr: string
  compileOutput: string
  status: 'accepted' | 'runtime_error' | 'compile_error'
  timeMs: number
  memoryKb: number
}

export function runLocalJavaScript(code: string, stdin: string): MockRunResult {
  const start = Date.now()
  const stdoutLines: string[] = []
  const stderrLines: string[] = []
  const capture = (stream: string[]) => (...args: unknown[]) => {
    stream.push(args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '))
  }

  const sandboxConsole = {
    log: capture(stdoutLines),
    info: capture(stdoutLines),
    error: capture(stderrLines),
    warn: capture(stderrLines),
    debug: capture(stdoutLines),
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', 'stdin', '"use strict";\n' + code)
    const ret = fn(sandboxConsole, stdin)
    if (ret !== undefined) stdoutLines.push(String(ret))
    return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), compileOutput: '', status: 'accepted', timeMs: Date.now() - start, memoryKb: 2048 }
  } catch (err: any) {
    const message = err?.message || String(err)
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.length ? stderrLines.join('\n') : message,
      compileOutput: '',
      status: 'runtime_error',
      timeMs: Date.now() - start,
      memoryKb: 2048,
    }
  }
}

function safeStringify(v: unknown): string {
  try {
    if (typeof v === 'object') return JSON.stringify(v, null, 0) ?? String(v)
    return String(v)
  } catch {
    return String(v)
  }
}

/** Produce sample deterministic output so the terminal feels alive in mock mode. */
export function mockSample(languageName: string, code: string): MockRunResult {
  const firstLine = code.split('\n').find((l) => l.trim().length > 0) || ''
  const stdout = `[mock] ${languageName} execution sample.\n\nTo run "${languageName}" for real, add your Judge0 API key in Settings → Execution.\n\nFirst line of source:\n  ${firstLine}`
  return { stdout, stderr: '', compileOutput: '', status: 'accepted', timeMs: 1, memoryKb: 1024 }
}
