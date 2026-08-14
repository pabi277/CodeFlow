// GitHub OAuth + personal-access-token management.
//
// The OAuth client secret never ships to the browser. The short-lived code is
// exchanged by the serverless function at /api/exchange, while the resulting
// access token is kept in IndexedDB by the auth database helpers.
//
// Users can also paste a classic / fine-grained personal access token. That
// path needs no OAuth App and works in any environment (including local preview).

import axios, { type AxiosResponse } from 'axios'
import { getAuth, setAuth, clearAuth } from '../db/gitHub'
import * as gh from './githubService'
import type { GitHubAuth } from '../types'

const origin = typeof window !== 'undefined' ? window.location.origin : ''

// OAuth state must survive the redirect even when Android kills the tab in
// between (sessionStorage is lost then). Stored in localStorage as
// `{ state, expiresAt }` with a short TTL so a stale entry can't be replayed.
const OAUTH_STATE_KEY = 'cf_oauth_state'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function storeOAuthState(state: string): void {
  try {
    localStorage.setItem(OAUTH_STATE_KEY, JSON.stringify({ state, expiresAt: Date.now() + OAUTH_STATE_TTL_MS }))
  } catch {
    // Storage may be unavailable (private mode) — the callback will then
    // report a mismatch rather than failing silently.
  }
}

/** Return the pending OAuth state if it is still valid, otherwise null. */
function readOAuthState(): string | null {
  try {
    const raw = localStorage.getItem(OAUTH_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: unknown; expiresAt?: unknown }
    if (typeof parsed.state !== 'string' || typeof parsed.expiresAt !== 'number') {
      localStorage.removeItem(OAUTH_STATE_KEY)
      return null
    }
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(OAUTH_STATE_KEY)
      return null
    }
    return parsed.state
  } catch {
    return null
  }
}

function clearOAuthState(): void {
  try {
    localStorage.removeItem(OAUTH_STATE_KEY)
  } catch {
    // ignore
  }
}

// OAuth App config (frontend-safe values only — never the client secret).
export const GITHUB_OAUTH = {
  clientId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GITHUB_CLIENT_ID) || '',
  redirectUri: `${origin}/auth/callback`,
  scopes: ['repo', 'user'],
  tokenProxyUrl: `${origin}/api/exchange`,
}

export function isOAuthConfigured(): boolean {
  return Boolean(GITHUB_OAUTH.clientId)
}

/** Pull a useful message out of Error, Axios, or server JSON payloads. */
function extractErrorMessage(value: unknown, depth = 0): string | undefined {
  if (typeof value === 'string') return value || undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (!value || typeof value !== 'object' || depth >= 3) return undefined

  if (value instanceof Error) return value.message || undefined
  const record = value as Record<string, unknown>
  for (const key of ['error', 'message', 'error_description', 'detail', 'reason']) {
    const message = extractErrorMessage(record[key], depth + 1)
    if (message) return message
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractErrorMessage(item, depth + 1)
      if (message) return message
    }
  }
  if (typeof record.code === 'string') return record.code
  return undefined
}

/** Always return a string suitable for displaying in a toast. */
export function oauthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return extractErrorMessage(error.response?.data) || error.message || 'GitHub authentication failed. Please try again.'
  }
  return extractErrorMessage(error) || 'GitHub authentication failed. Please try again.'
}

export async function loadStoredAuth(): Promise<GitHubAuth | null> {
  return getAuth()
}

export async function isConnected(): Promise<boolean> {
  return (await getAuth()) !== null
}

export async function signOut(): Promise<void> {
  await clearAuth()
}

/** Start OAuth by redirecting to GitHub's authorization screen. */
export function beginOAuth(): void {
  if (!GITHUB_OAUTH.clientId) {
    throw new Error('GitHub OAuth is not configured. Paste a personal access token instead.')
  }
  const state = Math.random().toString(36).slice(2)
  storeOAuthState(state)
  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH.clientId,
    redirect_uri: GITHUB_OAUTH.redirectUri,
    scope: GITHUB_OAUTH.scopes.join(' '),
    state,
  })
  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`
}

/**
 * Validate a personal access token against the GitHub API and store it.
 * Accepts classic (`ghp_…`) and fine-grained (`github_pat_…`) tokens.
 */
export async function connectWithToken(rawToken: string): Promise<GitHubAuth> {
  const token = rawToken.trim()
  if (!token) throw new Error('Paste a GitHub personal access token.')
  if (/\s/.test(token)) throw new Error('That does not look like a token — it contains spaces.')
  try {
    const user = await gh.getCurrentUser(token)
    const auth: GitHubAuth = {
      token,
      username: user.login,
      displayName: user.name || user.login,
      avatarUrl: user.avatar_url,
      tokenExpiry: null,
      scopes: GITHUB_OAUTH.scopes,
    }
    await setAuth(auth)
    return auth
  } catch (error) {
    throw new Error(oauthErrorMessage(error) || 'That token was rejected by GitHub. Check the token and try again.')
  }
}

/**
 * Handle the OAuth redirect callback (`/auth/callback?code=...&state=...`).
 * Exchanges the code via the backend proxy, fetches the profile, stores the
 * token, then cleans the URL. Returns the stored auth or null.
 */
export async function handleOAuthCallback(): Promise<GitHubAuth | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error')
  if (oauthError) {
    clearOAuthState()
    if (window.history.replaceState) window.history.replaceState({}, '', '/')
    throw new Error(params.get('error_description') || `GitHub authorization failed: ${oauthError}`)
  }
  if (!code) return null

  const expectedState = readOAuthState()
  if (!state || !expectedState || state !== expectedState) {
    throw new Error('OAuth state mismatch — please try again.')
  }

  let response: AxiosResponse<{ access_token?: string; error?: string }>
  try {
    response = await axios.post<{ access_token?: string; error?: string }>(
      GITHUB_OAUTH.tokenProxyUrl,
      { code, redirect_uri: GITHUB_OAUTH.redirectUri },
    )
  } catch (error) {
    throw new Error(oauthErrorMessage(error))
  }

  const token = response.data.access_token
  if (!token) {
    throw new Error(response.data.error || 'GitHub authentication failed. Please try again.')
  }

  const user = await gh.getCurrentUser(token)
  const auth: GitHubAuth = {
    token,
    username: user.login,
    displayName: user.name || user.login,
    avatarUrl: user.avatar_url,
    tokenExpiry: null,
    scopes: GITHUB_OAUTH.scopes,
  }
  await setAuth(auth)
  clearOAuthState()
  if (window.history.replaceState) window.history.replaceState({}, '', '/')
  return auth
}

export function saveAuth(auth: GitHubAuth): Promise<void> {
  return setAuth(auth)
}
