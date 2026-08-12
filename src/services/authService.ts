// GitHub OAuth token management.
//
// SECURITY: The code<->token exchange REQUIRES the client secret, which must
// never ship in frontend code. This app therefore delegates that single step to
// a small backend proxy (see /worker — a Cloudflare Worker). The frontend only
// ever holds the access token, which is stored in IndexedDB (never localStorage
// / cookies / URLs).

import axios from 'axios'
import { getAuth, setAuth, clearAuth } from '../db/gitHub'
import * as gh from './githubService'
import type { GitHubAuth } from '../types'

// OAuth App config (frontend-safe values only — never the client secret)
// VITE_GITHUB_CLIENT_ID is set in Vercel Dashboard → Settings → Environment Variables.
// The token proxy is a Vercel Serverless Function at /api/exchange.
const origin = typeof window !== 'undefined' ? window.location.origin : ''

export const GITHUB_OAUTH = {
  clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  redirectUri: `${origin}/auth/callback`,
  scopes: ['repo', 'user'],
  tokenProxyUrl: `${origin}/api/exchange`,
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
  const state = Math.random().toString(36).slice(2)
  sessionStorage.setItem('cf_oauth_state', state)
  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH.clientId,
    redirect_uri: GITHUB_OAUTH.redirectUri,
    scope: GITHUB_OAUTH.scopes.join(' '),
    state,
  })
  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`
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
  if (!code) return null

  const expectedState = sessionStorage.getItem('cf_oauth_state')
  if (state && expectedState && state !== expectedState) {
    throw new Error('OAuth state mismatch — please try again.')
  }

  const res = await axios.post<{ access_token?: string; error?: string }>(
    GITHUB_OAUTH.tokenProxyUrl,
    { code, redirect_uri: GITHUB_OAUTH.redirectUri },
  )
  const token = res.data.access_token
  if (!token) {
    throw new Error(res.data.error || 'GitHub authentication failed. Please try again.')
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
  sessionStorage.removeItem('cf_oauth_state')
  if (window.history.replaceState) window.history.replaceState({}, '', '/')
  return auth
}

export function saveAuth(auth: GitHubAuth): Promise<void> {
  return setAuth(auth)
}
