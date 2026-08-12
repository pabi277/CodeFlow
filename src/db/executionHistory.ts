import { db } from './db'
import type { ExecutionResult } from '../types'
import { uuid } from '../utils/id'

export async function addExecutionResult(result: Omit<ExecutionResult, 'id'>): Promise<string> {
  const id = uuid()
  await db.executionHistory.add({ ...result, id } as ExecutionResult)
  return id
}

export async function listExecutionHistory(projectId?: string): Promise<ExecutionResult[]> {
  let results = await db.executionHistory.toArray()
  if (projectId) results = results.filter((r) => r.projectId === projectId)
  return results.sort((a, b) => b.timestamp - a.timestamp)
}

export async function getExecutionResult(id: string): Promise<ExecutionResult | undefined> {
  return db.executionHistory.get(id)
}

export async function clearExecutionHistory(): Promise<void> {
  await db.executionHistory.clear()
}
