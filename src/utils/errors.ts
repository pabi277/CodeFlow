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

/**
 * Turn low-level GitHub REST failures into a short explanation and a next step.
 * GitHub frequently returns generic messages such as "Conflict" with status 409;
 * those are useful to an API client but not to someone trying to save their work.
 */
export function friendlyGitHubError(err: unknown, action = 'complete this GitHub action'): string {
  const response = typeof err === 'object' && err !== null && 'response' in err
    ? (err as { response?: { status?: number; data?: { message?: unknown; errors?: unknown[] } } }).response
    : undefined
  const status = response?.status
  const apiMessage = typeof response?.data?.message === 'string' ? response.data.message : ''
  const detail = apiMessage.toLowerCase()

  if (!status) {
    if (axios.isAxiosError(err)) return 'Can’t reach GitHub. Check your connection and try again.'
    if (err instanceof Error && err.message) return err.message
    return `Couldn’t ${action}. Please try again.`
  }

  if (status === 401) return 'GitHub sign-in expired. Reconnect GitHub, then try again.'
  if (status === 403) {
    if (detail.includes('rate limit')) return 'GitHub is temporarily rate-limiting requests. Wait a few minutes, then try again.'
    if (detail.includes('protected branch')) return 'This branch is protected. Push to a different branch or ask a repository maintainer for access.'
    return 'GitHub denied permission for this action. Reconnect with a token that can access this repository and push to this branch.'
  }
  if (status === 404) return 'GitHub could not find this repository or your account cannot access it. Check the repository and reconnect GitHub if needed.'
  if (status === 409) {
    if (detail.includes('git repository is empty')) {
      return 'This GitHub repository has no commits yet. Add a file, then use Commit & Push to create its first commit.'
    }
    if (detail.includes('reference update') || detail.includes('fast forward') || detail.includes('conflict')) {
      return 'GitHub has newer changes on this branch. Pull first, resolve any conflicts, then push again.'
    }
    return 'GitHub found a conflict while saving your changes. Pull the latest changes, then try pushing again.'
  }
  if (status === 422) {
    if (detail.includes('already exists')) return 'That GitHub repository or branch already exists. Choose a different name, or connect to the existing repository.'
    if (detail.includes('protected branch')) return 'This branch is protected. Push to a different branch or ask a repository maintainer for access.'
    return 'GitHub could not accept these changes. Check the repository name, branch, and file paths, then try again.'
  }
  if (status === 429) return 'GitHub is receiving too many requests. Wait a moment, then try again.'
  if (status >= 500) return 'GitHub is having a temporary problem. Your local changes are safe; try again shortly.'
  return `GitHub couldn’t ${action}. Please try again.`
}
