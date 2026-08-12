import { db } from './db'
import type { GitHubAuth } from '../types'

const KEY = 'auth'

export async function getAuth(): Promise<GitHubAuth | null> {
  return (await db.gitHubAuth.get(KEY)) || null
}

export async function setAuth(auth: GitHubAuth): Promise<void> {
  await db.gitHubAuth.put({ ...auth, token: auth.token })
}

export async function clearAuth(): Promise<void> {
  await db.gitHubAuth.delete(KEY)
}
