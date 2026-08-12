// Friendly error translation + compiler error parsing.
import axios from 'axios'

export function friendlyError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Network error. Check your internet connection.'
    const status = err.response.status
    const data: any = err.response.data
    if (status === 401) return 'Authentication failed. Please reconnect your GitHub account.'
    if (status === 403) {
      if (data?.message?.includes('rate limit')) return 'GitHub API rate limit reached. Please try again later.'
      return 'You do not have permission for this action.'
    }
    if (status === 404) return 'The requested resource was not found.'
    if (status === 422) return data?.message || 'The operation could not be completed.'
    if (status === 429) return 'Too many requests. Please slow down and try again.'
    return data?.message || 'Something went wrong on the server. Please try again.'
  }
  if (err instanceof Error) {
    // friendly domain errors
    if (err.message) return err.message
    return 'An unexpected error occurred.'
  }
  return 'An unexpected error occurred.'
}

export interface CompiledErrorLocation {
  line?: number
  message: string
}

/** Best-effort parse of compiler output to extract the first error line + line number. */
export function parseCompilerError(output: string): CompiledErrorLocation | null {
  if (!output) return null
  // Python:   File "file.py", line 3, in <module>
  //           NameError: ...
  const py = output.match(/line (\d+)/)
  // C/C++/Java:  main.c:3:5: error: ...
  const gcc = output.match(/:(\d+):(\d+):\s*(error|warning):\s*(.+)/)
  if (gcc) return { line: Number(gcc[1]), message: `${gcc[3]}: ${gcc[4]}` }
  if (py) {
    const lineIdx = py[1]
    const msgMatch = output.match(/^(\w+Error):\s*(.+)$/m)
    return { line: Number(lineIdx), message: msgMatch ? `${msgMatch[1]}: ${msgMatch[2]}` : output.split('\n').filter(Boolean)[0] }
  }
  const firstLine = output.split('\n').find((l) => l.trim().length > 0)
  return { message: firstLine || 'Compilation failed' }
}
