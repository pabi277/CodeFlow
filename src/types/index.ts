export type NodeType = 'file' | 'folder'

// A single file OR folder record (unified files store)
export interface FileNode {
  id: string
  name: string
  type: NodeType
  /** Full path from project root, e.g. "/src/components/Button.tsx" */
  path: string
  /** Only populated for files; '' for folders */
  content: string
  /** Parent folder id, or null for root-level items */
  parentId: string | null
  /** For folders: ids of direct children. For files: [] */
  childIds: string[]
  createdAt: number
  modifiedAt: number
  /** True when content differs from last Git sync */
  isGitModified: boolean
  /** Git blob/commit SHA from GitHub (after clone) */
  gitSha: string | null
  /** Content as of last Git sync (clone/pull/commit) — used for modification detection & diff */
  originalContent: string
  /** New file created locally, not present in the clone */
  isNew: boolean
  /** File deleted locally but still tracked in Git (kept as tombstone) */
  isDeleted: boolean
  projectId: string
}

export interface GitHubMeta {
  owner: string | null
  repo: string | null
  branch: string | null
  lastSyncAt: number | null
  connected: boolean
}

export interface Project {
  id: string
  name: string
  rootFolderId: string
  createdAt: number
  lastOpenedAt: number
  github: GitHubMeta
}

export interface ThemePalette {
  name: string
  dark: boolean
  bg: string
  panel: string
  text: string
  muted: string
  input: string
  accent: string
  border: string
  selection: string
  activeLine: string
}

export interface AppSettings {
  theme: 'dark' | 'light'
  themePreset: string
  fontSize: number
  fontFamily: string
  tabSize: number
  indentWithSpaces: boolean
  wordWrap: boolean
  autoSave: boolean
  autoSaveDelay: number
  showKeyboardToolbar: boolean
  keyboardToolbarKeys: Record<string, string[]>
  showLineNumbers: boolean
  bracketMatching: boolean
  showMinimap: boolean
  showBreadcrumbs: boolean
  showStatusBar: boolean
  cursorStyle: 'line' | 'block' | 'underline'
  smoothCursor: boolean
  formatOnSave: boolean
  formatOnPaste: boolean
  indentGuides: boolean
  rainbowBrackets: boolean
  stickyScroll: boolean
  autoDetectIndent: boolean
  /** User-imported VS Code themes, keyed by slug */
  customThemes: Record<string, ThemePalette>
  termuxBridgeUrl: string
  judge0ApiKey: string
  judge0BaseUrl: string
  timeLimit: number
  memoryLimit: number
  /** filePath -> mainFilePath used as run target */
  runConfiguration: Record<string, string>
}

export interface EditorPersistState {
  openTabIds: string[]
  activeTabId: string | null
  pinnedTabIds: string[]
  cursorPositions: Record<string, { line: number; col: number }>
  scrollPositions: Record<string, number>
  terminalOpen: boolean
  terminalHeight: number
}

export interface GitConflict {
  fileId: string
  path: string
  local: string
  remote: string
  remoteSha: string
}

export type ExecStatus =
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit_exceeded'
  | 'runtime_error'
  | 'compile_error'
  | 'system_error'

export interface ExecutionResult {
  id: string
  fileId: string
  projectId: string
  languageName: string
  code: string
  stdout: string
  stderr: string
  compileOutput: string
  status: ExecStatus
  timeMs: number
  memoryKb: number
  timestamp: number
}

export interface GitHubAuth {
  token: string
  username: string
  displayName: string
  avatarUrl: string
  tokenExpiry: number | null
  scopes: string[]
}

// ---- GitHub API response types ----
export interface GitHubRepo {
  id: number
  full_name: string
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  private: boolean
  updated_at: string
  default_branch: string
  clone_url: string
}

export interface GitHubTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url?: string
}

export interface GitHubTreeResponse {
  sha: string
  truncated: boolean
  tree: GitHubTreeItem[]
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export interface GitHubBranch {
  name: string
  protected?: boolean
}

export interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
}

export interface GitHubPullRequest {
  number: number
  title: string
  html_url: string
  state: string
  user: { login: string; avatar_url: string }
  created_at: string
  head: { label: string }
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  oldNo: number | null
  newNo: number | null
  text: string
}

export interface Snippet {
  id: string
  name: string
  /** Short description shown under the name */
  description: string
  /** Restrict to a language key ('' = any) */
  language: string
  /** Code body. Optional ${cursor} marks the caret landing position. */
  body: string
  createdAt: number
}

export interface CloneProgress {
  label: string
  done: number
  total: number
}

export type PreviewMode = 'editor' | 'split' | 'preview'
export type BottomPanelTab = 'terminal' | 'problems' | 'outline'
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  id: string
  fileId: string
  path: string
  line: number
  col: number
  severity: DiagnosticSeverity
  message: string
  source: string
}

// ---- Judge0 response types ----
export interface Judge0SubmissionResponse {
  token: string
}

export interface Judge0Result {
  token: string
  status: { id: number; description: string }
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  time: string | null
  memory: number | null
  exit_code: number | null
}
