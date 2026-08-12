// Centralized API endpoint constants
export const API = {
  // Judge0 CE — user can override base URL and key in settings
  judge0DefaultBaseUrl: 'https://judge0-ce.p.rapidapi.com',
  // Judge0 language catalogue (see judge0Languages.ts)
  // GitHub REST API
  githubApiBase: 'https://api.github.com',
} as const

export const POLL_INTERVAL_MS = 1000
export const MAX_POLL_ATTEMPTS = 30 // 30 * 1s = 30s worst case
