import { db } from './db'
import type { GitHubAuth } from '../types'

/**
 * Auth is stored as a single row whose primary key is the access token.
 * Always read/write via these helpers — never look the row up by a fixed id.
 */
export async function getAuth(): Promise<GitHubAuth | null> {
  const all = await db.gitHubAuth.toArray()
  return all[0] || null
}

export async function setAuth(auth: GitHubAuth): Promise<void> {
  await db.gitHubAuth.clear()
  await db.gitHubAuth.add(auth)
}

export async function clearAuth(): Promise<void> {
  await db.gitHubAuth.clear()
}
