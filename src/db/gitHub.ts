import { db } from './db'
import type { GitHubAuth } from '../types'

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
