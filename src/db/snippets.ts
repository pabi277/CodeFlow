import { db } from './db'
import type { Snippet } from '../types'
import { uuid } from '../utils/id'

export async function listSnippets(): Promise<Snippet[]> {
  return db.snippets.toArray()
}

export async function addSnippet(s: Omit<Snippet, 'id' | 'createdAt'>): Promise<string> {
  const id = uuid()
  await db.snippets.add({ ...s, id, createdAt: Date.now() } as Snippet)
  return id
}

export async function updateSnippet(id: string, patch: Partial<Snippet>): Promise<void> {
  await db.snippets.update(id, patch)
}

export async function deleteSnippet(id: string): Promise<void> {
  await db.snippets.delete(id)
}
