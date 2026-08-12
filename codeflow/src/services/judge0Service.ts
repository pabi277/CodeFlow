import axios from 'axios'
import { API, POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS } from '../config/api'
import type { Judge0Result, Judge0SubmissionResponse } from '../types'

// Judge0 CE status codes
export const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  INTERNAL_ERROR: 12,
  EXEC_FORMAT_ERROR: 13,
} as const

export class Judge0Error extends Error {}

function headers(apiKey: string, baseUrl: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    if (baseUrl.includes('rapidapi.com')) {
      h['x-rapidapi-key'] = apiKey
      h['x-rapidapi-host'] = 'judge0-ce.p.rapidapi.com'
    } else {
      h['X-Auth-Token'] = apiKey
    }
  }
  return h
}

export async function submitCode(
  sourceCode: string,
  languageId: number,
  stdin: string,
  options: { apiKey: string; baseUrl: string; timeLimit?: number; memoryLimit?: number },
): Promise<string> {
  const url = `${options.baseUrl || API.judge0DefaultBaseUrl}/submissions`
  const params: Record<string, string> = { base64_encoded: 'false', wait: 'false' }
  try {
    const res = await axios.post<Judge0SubmissionResponse>(
      url,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin,
        cpu_time_limit: options.timeLimit ?? 5,
        memory_limit: options.memoryLimit ?? 128,
      },
      { headers: headers(options.apiKey, options.baseUrl), params },
    )
    return res.data.token
  } catch (err: any) {
    if (err?.response?.status === 429) {
      throw new Judge0Error('Judge0 API rate limit reached. Please wait a moment and retry.')
    }
    if (!err?.response) throw new Judge0Error('Code execution service is unreachable. Your code is saved.')
    throw new Judge0Error('Code execution service error. Please try again.')
  }
}

export async function getResult(token: string, apiKey: string, baseUrl: string): Promise<Judge0Result> {
  const url = `${baseUrl || API.judge0DefaultBaseUrl}/submissions/${token}`
  const res = await axios.get<Judge0Result>(url, {
    headers: headers(apiKey, baseUrl),
    params: { base64_encoded: 'false' },
  })
  return res.data
}

/** Poll until result is ready (not in queue/processing). Returns result. */
export async function pollResult(
  token: string,
  apiKey: string,
  baseUrl: string,
  onPoll?: (attempt: number) => void,
): Promise<Judge0Result> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    onPoll?.(attempt)
    const result = await getResult(token, apiKey, baseUrl)
    if (result.status && result.status.id !== STATUS.IN_QUEUE && result.status.id !== STATUS.PROCESSING) {
      return result
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Judge0Error('Execution is taking too long. Please try again.')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
