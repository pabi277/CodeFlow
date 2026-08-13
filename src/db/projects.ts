import { db } from './db'
import type { Project, GitHubMeta } from '../types'
import { uuid } from '../utils/id'

export async function createProject(name: string, rootFolderId: string): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    name,
    rootFolderId,
    createdAt: now,
    lastOpenedAt: now,
    github: { owner: null, repo: null, branch: null, lastSyncAt: null, connected: false },
  }
  await db.projects.add(project)
  return project
}

export async function listProjects(): Promise<Project[]> {
  const projects = await db.projects.toArray()
  // Most-recently-opened first so bootstrap restores the project the user was
  // last working in (Android kills the PWA and reopens the app constantly).
  return projects.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function updateProjectGithub(id: string, github: Partial<GitHubMeta>): Promise<void> {
  const p = await db.projects.get(id)
  if (!p) return
  await db.projects.update(id, { github: { ...p.github, ...github } })
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { lastOpenedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  // delete all its files too
  const nodes = await db.files.where('projectId').equals(id).toArray()
  await db.files.bulkDelete(nodes.map((n) => n.id))
  await db.projects.delete(id)
}
