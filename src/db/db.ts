import Dexie, { type Table } from 'dexie'
import type {
  FileNode,
  Project,
  ExecutionResult,
  GitHubAuth,
  Snippet,
} from '../types'

// CodeFlowDB — single source of truth for all local data.
// Stores per the spec: files, projects, settings, editorState,
// executionHistory, gitHubAuth.
export class CodeFlowDB extends Dexie {
  files!: Table<FileNode, string>
  projects!: Table<Project, string>
  settings!: Table<{ key: string; value: unknown }, string>
  editorState!: Table<{ key: string; value: unknown }, string>
  executionHistory!: Table<ExecutionResult, string>
  gitHubAuth!: Table<GitHubAuth, string>
  snippets!: Table<Snippet, string>

  constructor() {
    super('CodeFlowDB')
    this.version(1).stores({
      files: 'id, projectId, parentId, name, path',
      projects: 'id, name, lastOpenedAt',
      settings: 'key',
      editorState: 'key',
      executionHistory: 'id, fileId, projectId, timestamp',
      gitHubAuth: '&token, username',
    })
    this.version(2).stores({
      files: 'id, projectId, parentId, name, path',
      projects: 'id, name, lastOpenedAt',
      settings: 'key',
      editorState: 'key',
      executionHistory: 'id, fileId, projectId, timestamp',
      gitHubAuth: '&token, username',
      snippets: 'id, name, language, createdAt',
    })
  }
}

export const db = new CodeFlowDB()
