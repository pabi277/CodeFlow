import { create } from 'zustand'
import type {
  FileNode,
  Project,
  AppSettings,
  EditorPersistState,
  ExecutionResult,
  GitHubAuth,
  GitHubRepo,
  GitHubBranch,
  CloneProgress,
  GitHubCommit,
  GitHubPullRequest,
  Snippet,
  Diagnostic,
  PreviewMode,
  BottomPanelTab,
  GitConflict,
  ThemePalette,
  UploadToGitHubOptions,
} from '../types'
import * as fsDb from '../db/files'
import { db } from '../db/db'
import * as projectsDb from '../db/projects'
import * as settingsDb from '../db/settings'
import * as editorDb from '../db/editorState'
import * as historyDb from '../db/executionHistory'
import { uuid } from '../utils/id'
import { detectLanguage, languageName, canRunLocally } from '../utils/language'
import * as gitService from '../services/gitService'
import { executeCode, checkTermuxBridge, clearBridgeCache, type ExecutionSource } from '../services/executionService'
import { collectProjectFiles, previewUrlFor, syncTermuxWorkspace, termuxSupportsPreview } from '../services/termuxPreview'
import { buildHtmlPreview } from '../utils/htmlPreview'
import { isHtmlPreview } from '../utils/markdown'
import * as authService from '../services/authService'
import * as ghSvc from '../services/githubService'
import * as snippetsDb from '../db/snippets'
import { DEFAULT_SETTINGS } from '../config/defaults'
import { downloadProjectZip, buildSubtreeZip, storedContentToBlob, parseZipFile, filesToEntries, entriesToSeed } from '../utils/zip'
import { mimeForPath } from '../utils/binary'
import { diagnoseProject } from '../services/diagnostics'
import { formatDocument } from '../utils/formatDocument'
import { replaceInText } from '../utils/projectSearch'
import { goToPosition, replaceDocument, getWordAtCursor } from '../utils/editorApi'
import { findDefinitions, findReferences as findRefs, renameInText, wordAt } from '../utils/symbolNav'
import { parseThemeText } from '../utils/themeImport'
import { convertLineEnding, type LineEnding } from '../utils/lineEnding'
import { setBridgeOrigin } from '../services/bridgeUrl'
import type { GitStatusItem } from '../services/gitService'

export type ContextMenuState = { nodeId: string; x: number; y: number; clientX: number; clientY: number } | null
export type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }

const TAB_SYNC_ID = uuid()
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('codeflow-sync') : null
if (syncChannel) {
  syncChannel.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { source?: string; type?: string; projectId?: string } | null
    if (!msg || msg.source === TAB_SYNC_ID) return
    if (msg.type === 'files' && msg.projectId && msg.projectId === useStore.getState().activeProjectId) {
      void useStore.getState().refreshProject()
    }
  }
}

function toastMs(type: Toast['type']): number {
  if (type === 'error') return 6000
  if (type === 'warning') return 5000
  if (type === 'success') return 2500
  return 3500
}

function requireOnline(): boolean {
  if (!useStore.getState().offline) return true
  useStore.getState().showToast('You are offline — GitHub sync is paused until you reconnect.', 'warning')
  return false
}

interface StoreState {
  // bootstrap
  booted: boolean

  // projects
  projects: Project[]
  activeProjectId: string | null
  nodeMap: Record<string, FileNode>
  expanded: Record<string, boolean>

  // tabs / editor
  openTabs: string[]
  activeTabId: string | null
  pinnedTabs: string[]
  dirtyTabs: Record<string, boolean>
  zenMode: boolean
  cursorPositions: Record<string, { line: number; col: number }>
  scrollPositions: Record<string, number>
  lastSaved: Record<string, string>

  // settings
  settings: AppSettings

  // terminal / execution
  terminalOpen: boolean
  terminalHeight: number
  stdin: string
  running: boolean
  runningFileId: string | null
  terminalText: TerminalLine[]
  history: ExecutionResult[]

  // ui
  drawerOpen: boolean
  drawerTab: 'files' | 'git'
  contextMenu: ContextMenuState
  commandPaletteOpen: boolean
  settingsOpen: boolean
  newItemModal: { parentId: string | null; type: 'file' | 'folder' } | null
  offline: boolean
  toasts: Toast[]

  // github
  auth: GitHubAuth | null
  repos: GitHubRepo[]
  reposLoading: boolean
  repoBrowserOpen: boolean
  uploadOpen: boolean
  uploading: boolean
  commitOpen: boolean
  branchPickerOpen: boolean
  branches: GitHubBranch[]
  diffFileId: string | null
  cloneProgress: CloneProgress | null
  pulling: boolean
  gitStatus: GitStatusItem[]
  findInProjectOpen: boolean
  rateLimit: { remaining: number; reset: number; limit: number } | null
  // phase 4
  historyBrowserOpen: boolean
  snippets: Snippet[]
  snippetsOpen: boolean
  gitLog: GitHubCommit[]
  gitLogOpen: boolean
  prs: GitHubPullRequest[]
  prsOpen: boolean
  activePluginPanel: string | null
  landscapeSplit: boolean
  termuxAvailable: boolean
  lastRunSource: ExecutionSource | null
  homeAction: 'new' | null
  importProjectOpen: boolean
  focusEditorRequest: number
  // phase 5
  previewMode: PreviewMode
  bottomPanelTab: BottomPanelTab
  diagnostics: Diagnostic[]
  cursorPos: { line: number; col: number }
  goToLineOpen: boolean
  pendingGoTo: { fileId: string; line: number; col: number } | null
  viewerOpen: boolean
  shortcutsOpen: boolean
  welcomeOpen: boolean
  gitConflicts: GitConflict[]
  conflictFileId: string | null
  symbolSearchOpen: boolean
  renameOpen: boolean
  referenceHits: { fileId: string; path: string; name: string; line: number; col: number }[]
  referencesOpen: boolean

  // actions
  bootstrap: () => Promise<void>
  connectGitHub: () => void
  handleCallback: () => Promise<void>
  disconnectGitHub: () => Promise<void>
  openRepoBrowser: () => void
  closeRepoBrowser: () => void
  loadRepos: () => Promise<void>
  cloneRepo: (repo: GitHubRepo) => Promise<void>
  openUpload: () => void
  closeUpload: () => void
  uploadToGitHub: (opts: UploadToGitHubOptions) => Promise<void>
  importZipIntoCurrentProject: (file: File) => Promise<void>
  openCommit: () => void
  closeCommit: () => void
  doCommit: (message: string, includeIds: string[], push: boolean) => Promise<void>
  openBranchPicker: () => void
  closeBranchPicker: () => void
  loadBranches: () => Promise<void>
  doSwitchBranch: (name: string) => Promise<void>
  openDiff: (fileId: string) => void
  closeDiff: () => void
  discardFileChanges: (fileId: string) => Promise<void>
  doPull: () => Promise<void>
  refreshGitStatus: () => Promise<void>
  setFindInProject: (v: boolean) => void
  loadRateLimit: () => Promise<void>
  // phase 4 actions
  setHistoryBrowser: (v: boolean) => void
  loadSnippets: () => Promise<void>
  addSnippet: (s: Omit<Snippet, 'id' | 'createdAt'>) => Promise<void>
  deleteSnippet: (id: string) => Promise<void>
  setSnippetsOpen: (v: boolean) => void
  openGitLog: () => void
  closeGitLog: () => void
  loadGitLog: () => Promise<void>
  openPrs: () => void
  closePrs: () => void
  loadPrs: () => Promise<void>
  openPluginPanel: (id: string) => void
  closePluginPanel: () => void
  setLandscapeSplit: (v: boolean) => void
  setMainFile: (fileId: string) => void
  refreshTermuxStatus: () => Promise<void>
  openHome: (action?: 'new' | null) => void
  setImportProjectOpen: (v: boolean) => void
  setPreviewMode: (m: PreviewMode) => void
  cyclePreviewMode: () => void
  setBottomPanelTab: (t: BottomPanelTab) => void
  openBottomPanel: (t?: BottomPanelTab) => void
  refreshDiagnostics: () => void
  setCursorPos: (p: { line: number; col: number }) => void
  setGoToLineOpen: (v: boolean) => void
  goToLocation: (fileId: string, line: number, col?: number) => Promise<void>
  clearPendingGoTo: () => void
  revealInExplorer: (nodeId: string) => void
  formatActiveDocument: () => void
  replaceInProject: (query: string, replacement: string, opts?: { matchCase?: boolean; regex?: boolean; wholeWord?: boolean }) => Promise<number>
  clearHistory: () => Promise<void>
  setViewerOpen: (v: boolean) => void
  setShortcutsOpen: (v: boolean) => void
  setWelcomeOpen: (v: boolean) => void
  toggleZen: () => void
  pinTab: (id: string) => void
  unpinTab: (id: string) => void
  togglePinTab: (id: string) => void
  closeOtherTabs: (id: string) => Promise<void>
  closeTabsToTheRight: (id: string) => Promise<void>
  closeSavedTabs: () => Promise<void>
  reorderTabs: (fromId: string, toId: string) => void
  doCreateBranch: (name: string) => Promise<void>
  doDeleteBranch: (name: string) => Promise<void>
  openConflict: (fileId: string) => void
  closeConflict: () => void
  resolveConflict: (fileId: string, choice: 'local' | 'remote' | 'both') => Promise<void>
  goToDefinition: () => Promise<void>
  findReferences: () => Promise<void>
  openRename: () => void
  closeRename: () => void
  renameCurrentSymbol: (next: string) => Promise<number>
  setSymbolSearchOpen: (v: boolean) => void
  setReferencesOpen: (v: boolean) => void
  importThemeJson: (text: string) => Promise<void>
  openPreviewInNewTab: () => Promise<void>
  exportProjectZip: () => Promise<void>
  downloadNode: (id: string) => Promise<void>
  shareNode: (id: string) => Promise<void>
  importProjectFromEntries: (entries: { path: string; content: string }[], name?: string) => Promise<Project | null>
  importProjectFromZip: (file: File) => Promise<void>
  importProjectFromFiles: (files: FileList | File[]) => Promise<void>
  showToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
  setOffline: (v: boolean) => void

  // project
  setActiveProject: (id: string | null) => Promise<void>
  newProject: (name: string, seed?: SeedFile[]) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  refreshProject: () => Promise<void>

  // files
  toggleFolder: (id: string) => void
  openFile: (id: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  setActiveTab: (id: string) => void
  createNode: (parentId: string | null, type: 'file' | 'folder', name: string) => Promise<FileNode | null>
  saveContent: (id: string, content: string) => void
  persistContent: (id: string) => Promise<void>
  renameNode: (id: string, newName: string) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  duplicateNode: (id: string) => Promise<void>
  setDirty: (id: string, dirty: boolean) => void
  persistEditorState: () => Promise<void>
  saveActiveEditorCursor: (id: string, cursor: { line: number; col: number }) => void
  saveActiveEditorScroll: (id: string, top: number) => void
  moveNode: (id: string, newParentId: string) => Promise<void>
  revertToSaved: (id: string) => Promise<void>
  cycleTab: (dir: 1 | -1) => void
  convertActiveLineEnding: (to: LineEnding) => void

  // execution
  runCurrentFile: () => Promise<void>
  setStdin: (v: string) => void
  setTerminalOpen: (v: boolean) => void
  setTerminalHeight: (v: number) => void
  clearTerminal: () => void
  loadHistory: () => Promise<void>

  // ui
  toggleDrawer: (open?: boolean) => void
  setDrawerTab: (t: 'files' | 'git') => void
  openContextMenu: (m: ContextMenuState) => void
  closeContextMenu: () => void
  setCommandPalette: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setNewItemModal: (m: StoreState['newItemModal']) => void

  // settings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export interface TerminalLine {
  id: string
  kind: 'stdout' | 'stderr' | 'system' | 'info'
  text: string
  source?: ExecutionSource
}

export interface SeedFile {
  path: string
  content: string
}

export const useStore = create<StoreState>((set, get) => ({
  booted: false,
  projects: [],
  activeProjectId: null,
  nodeMap: {},
  expanded: {},
  openTabs: [],
  activeTabId: null,
  pinnedTabs: [],
  dirtyTabs: {},
  zenMode: false,
  cursorPositions: {},
  scrollPositions: {},
  lastSaved: {},
  settings: DEFAULT_SETTINGS,
  terminalOpen: false,
  terminalHeight: 40,
  stdin: '',
  running: false,
  runningFileId: null,
  terminalText: [],
  history: [],
  drawerOpen: false,
  drawerTab: 'files',
  contextMenu: null,
  commandPaletteOpen: false,
  settingsOpen: false,
  newItemModal: null,
  offline: false,
  toasts: [],
  auth: null,
  repos: [],
  reposLoading: false,
  repoBrowserOpen: false,
  uploadOpen: false,
  uploading: false,
  commitOpen: false,
  branchPickerOpen: false,
  branches: [],
  diffFileId: null,
  cloneProgress: null,
  pulling: false,
  gitStatus: [],
  findInProjectOpen: false,
  rateLimit: null,
  historyBrowserOpen: false,
  snippets: [],
  snippetsOpen: false,
  gitLog: [],
  gitLogOpen: false,
  prs: [],
  prsOpen: false,
  activePluginPanel: null,
  landscapeSplit: false,
  termuxAvailable: false,
  lastRunSource: null,
  homeAction: null,
  importProjectOpen: false,
  focusEditorRequest: 0,
  previewMode: 'editor',
  bottomPanelTab: 'terminal',
  diagnostics: [],
  cursorPos: { line: 1, col: 1 },
  goToLineOpen: false,
  pendingGoTo: null,
  viewerOpen: false,
  shortcutsOpen: false,
  welcomeOpen: false,
  gitConflicts: [],
  conflictFileId: null,
  symbolSearchOpen: false,
  renameOpen: false,
  referenceHits: [],
  referencesOpen: false,

  bootstrap: async () => {
    const [projects, settings, editorState, auth] = await Promise.all([
      projectsDb.listProjects(),
      settingsDb.loadSettings(),
      editorDb.loadEditorState(),
      authService.loadStoredAuth(),
    ])
    // handle OAuth redirect if present
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      try {
        const cbAuth = await authService.handleOAuthCallback()
        if (cbAuth) set({ auth: cbAuth })
      } catch (err) {
        // swallow; toast on next render
      }
    }
    // restore a project
    const active = projects.length ? projects[0] : null
    set({ projects, settings, auth, booted: true })
    await get().setActiveProject(active?.id ?? null)
    // restore tabs
    if (editorState.openTabIds.length) {
      set({
        openTabs: editorState.openTabIds,
        activeTabId: editorState.activeTabId,
        pinnedTabs: editorState.pinnedTabIds || [],
        terminalOpen: editorState.terminalOpen,
        terminalHeight: editorState.terminalHeight || 40,
      })
    }
    await get().loadHistory()
    await get().refreshGitStatus()
    void get().refreshTermuxStatus()
  },

  showToast: (message, type = 'info') => {
    const id = uuid()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), toastMs(type))
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setOffline: (v) => set({ offline: v }),

  setActiveProject: async (id) => {
    if (!id) {
      set({ activeProjectId: null, nodeMap: {}, openTabs: [], activeTabId: null, pinnedTabs: [], dirtyTabs: {}, expanded: {}, diagnostics: [], gitConflicts: [] })
      return
    }
    await projectsDb.touchProject(id)
    const nodes = await fsDb.listAllInProject(id)
    const nodeMap: Record<string, FileNode> = {}
    for (const n of nodes) nodeMap[n.id] = n
    const rootId = getRootNodeId(nodeMap)
    const lastSaved: Record<string, string> = {}
    for (const n of nodes) if (n.type === 'file') lastSaved[n.id] = n.content
    set({ activeProjectId: id, nodeMap, openTabs: [], activeTabId: null, dirtyTabs: {}, expanded: rootId ? { [rootId]: true } : {}, gitStatus: [], lastSaved })
    await get().refreshGitStatus()
    get().refreshDiagnostics()
  },

  newProject: async (name, seed = []) => {
    const project = await projectsDb.createProject(name, '')
    // Build the root folder node (path computed under project root)
    const root = await fsDb.createNode(project.id, null, name, 'folder')
    await db.projects.update(project.id, { rootFolderId: root.id })
    await dbUpdateRoot(root.id, { path: '/' })
    // seed files
    for (const s of seed) {
      await createSeedPath(project.id, root.id, s)
    }
    set((s) => ({ projects: [...s.projects, project] }))
    await get().setActiveProject(project.id)
    return project
  },

  deleteProject: async (id) => {
    await projectsDb.deleteProject(id)
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
    if (get().activeProjectId === id) await get().setActiveProject(null)
  },

  refreshProject: async () => {
    const pid = get().activeProjectId
    if (!pid) return
    const nodes = await fsDb.listAllInProject(pid)
    const nodeMap: Record<string, FileNode> = {}
    for (const n of nodes) nodeMap[n.id] = n
    set({ nodeMap })
    get().refreshDiagnostics()
  },

  toggleFolder: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

  openFile: async (id) => {
    const node = get().nodeMap[id]
    if (!node || node.type !== 'file') return
    const dirty = get().dirtyTabs
    set((s) => ({
      openTabs: s.openTabs.includes(id) ? s.openTabs : insertTab(s.openTabs, s.pinnedTabs, id),
      activeTabId: id,
      dirtyTabs: { ...dirty, [id]: dirty[id] ?? false },
    }))
    await get().persistEditorState()
  },

  closeTab: async (id) => {
    const { openTabs, activeTabId, pinnedTabs } = get()
    const nextTabs = openTabs.filter((t) => t !== id)
    let nextActive = activeTabId
    if (activeTabId === id) {
      const idx = openTabs.indexOf(id)
      nextActive = nextTabs[Math.min(idx, nextTabs.length - 1)] ?? null
    }
    set((s) => {
      const dirtyTabs = { ...s.dirtyTabs }
      delete dirtyTabs[id]
      return { openTabs: nextTabs, activeTabId: nextActive, dirtyTabs, pinnedTabs: pinnedTabs.filter((t) => t !== id) }
    })
    await get().persistEditorState()
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  createNode: async (parentId, type, name) => {
    const pid = get().activeProjectId
    if (!pid) return null
    try {
      // parentId null -> create inside the project root folder
      const rootId = getRootNodeId(get().nodeMap)
      const effectiveParent = parentId ?? rootId ?? null
      const node = await fsDb.createNode(pid, effectiveParent, name, type)
      set((s) => ({ nodeMap: { ...s.nodeMap, [node.id]: node } }))
      if (effectiveParent) {
        const parent = s_nodeMap(get().nodeMap, effectiveParent)
        if (parent) set((s) => ({ nodeMap: { ...s.nodeMap, [effectiveParent]: { ...parent, childIds: [...parent.childIds, node.id] } } }))
      }
      if (type === 'folder') {
        // folders just expand in the tree — do NOT auto-open
        set((s) => ({ expanded: { ...s.expanded, [node.id]: true } }))
      } else {
        // Files auto-open as the active tab so the user can start typing
        // immediately. Close the drawer (portrait) and request editor focus.
        await get().openFile(node.id)
        if (!get().landscapeSplit) set({ drawerOpen: false })
        set({ newItemModal: null, focusEditorRequest: (get().focusEditorRequest || 0) + 1 })
        if (get().openTabs.length > 20) {
          get().showToast('Many tabs are open — consider closing some', 'info')
        }
      }
      return node
    } catch (err) {
      get().showToast((err as Error).message, 'error')
      return null
    }
  },

  renameNode: async (id, newName) => {
    try {
      await fsDb.renameNode(id, newName)
      await get().refreshProject()
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },

  deleteNode: async (id) => {
    const ids = await fsDb.collectSubtreeIds(id)
    await fsDb.deleteNode(id)
    const nodeMap = { ...get().nodeMap }
    for (const i of ids) delete nodeMap[i]
    const dirtyTabs = { ...get().dirtyTabs }
    for (const i of ids) delete dirtyTabs[i]
    const openTabs = get().openTabs.filter((t) => !ids.includes(t))
    let activeTabId = get().activeTabId
    if (activeTabId && ids.includes(activeTabId)) activeTabId = openTabs[openTabs.length - 1] ?? null
    set({ nodeMap, dirtyTabs, openTabs, activeTabId })
    await get().persistEditorState()
    get().refreshDiagnostics()
  },

  duplicateNode: async (id) => {
    try {
      const node = await fsDb.duplicateNode(id)
      set((s) => ({ nodeMap: { ...s.nodeMap, [node.id]: node } }))
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },

  setDirty: (id, dirty) => set((s) => ({ dirtyTabs: { ...s.dirtyTabs, [id]: dirty } })),
  saveContent: (id, content) =>
    set((s) => {
      const n = s.nodeMap[id]
      if (!n) return {}
      const gitModified = n.gitSha != null && n.gitSha !== '' && content !== (n.originalContent ?? '')
      const dirtyTabs = { ...s.dirtyTabs, [id]: true }
      return {
        nodeMap: { ...s.nodeMap, [id]: { ...n, content, isGitModified: gitModified } },
        dirtyTabs,
      }
    }),
  persistContent: async (id) => {
    let node = get().nodeMap[id]
    if (!node || node.type !== 'file') return
    try {
      if (get().settings.formatOnSave) {
        const result = await formatDocument(node.content, detectLanguage(node.path), get().settings.tabSize)
        if (result.ok && result.text !== node.content) {
          get().saveContent(id, result.text)
          if (get().activeTabId === id) replaceDocument(result.text)
          node = get().nodeMap[id] || node
        }
      }
      await fsDb.updateContent(id, node.content)
      set((s) => ({ dirtyTabs: { ...s.dirtyTabs, [id]: false }, lastSaved: { ...s.lastSaved, [id]: node.content } }))
      syncChannel?.postMessage({ source: TAB_SYNC_ID, type: 'files', projectId: get().activeProjectId })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },

  persistEditorState: async () => {
    const state: EditorPersistState = {
      openTabIds: get().openTabs,
      activeTabId: get().activeTabId,
      pinnedTabIds: get().pinnedTabs,
      cursorPositions: get().cursorPositions,
      scrollPositions: get().scrollPositions,
      terminalOpen: get().terminalOpen,
      terminalHeight: get().terminalHeight,
    }
    await editorDb.saveEditorState(state)
  },

  saveActiveEditorCursor: (id, cursor) => {
    set((s) => ({ cursorPositions: { ...s.cursorPositions, [id]: cursor } }))
  },
  saveActiveEditorScroll: (id, top) => {
    set((s) => ({ scrollPositions: { ...s.scrollPositions, [id]: top } }))
  },
  moveNode: async (id, newParentId) => {
    try {
      await fsDb.moveNode(id, newParentId)
      await get().refreshProject()
      get().showToast('Moved', 'success')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  revertToSaved: async (id) => {
    const saved = get().lastSaved[id]
    const node = get().nodeMap[id]
    if (!node) return
    if (saved == null) {
      get().showToast('Nothing to revert — file has not been saved this session', 'info')
      return
    }
    if (saved === node.content) {
      get().showToast('Already matches last save', 'info')
      return
    }
    get().saveContent(id, saved)
    if (get().activeTabId === id) replaceDocument(saved)
    await get().persistContent(id)
    get().showToast('Reverted to last save', 'success')
  },
  cycleTab: (dir) => {
    const { openTabs, activeTabId } = get()
    if (openTabs.length < 2) return
    const i = Math.max(0, openTabs.indexOf(activeTabId || ''))
    const next = openTabs[(i + dir + openTabs.length) % openTabs.length]
    set({ activeTabId: next })
  },
  convertActiveLineEnding: (to) => {
    const id = get().activeTabId
    const node = id ? get().nodeMap[id] : undefined
    if (!id || !node) return
    const next = convertLineEnding(node.content, to)
    if (next === node.content) {
      get().showToast(`Already ${to.toUpperCase()}`, 'info')
      return
    }
    replaceDocument(next)
    get().saveContent(id, next)
    void get().persistContent(id)
    get().showToast(`Converted to ${to.toUpperCase()}`, 'success')
  },

  runCurrentFile: async () => {
    const s = get()
    // Run the configured main file for this project if one exists, else active tab
    let id = s.activeTabId
    const pid = s.activeProjectId
    const configuredMain = pid ? s.settings.runConfiguration[pid] : undefined
    if (configuredMain && s.nodeMap[configuredMain]) id = configuredMain
    const node = id ? s.nodeMap[id] : undefined
    if (!node || node.type !== 'file') {
      get().showToast('Open a file to run it', 'info')
      return
    }
    const lang = detectLanguage(node.path)
    if (s.offline && !canRunLocally(lang)) {
      get().showToast('Code execution requires internet connection. Your code is saved and will run when you are back online.', 'info')
      return
    }
    set({ running: true, runningFileId: node.id, terminalOpen: true })
    appendTerminal({ kind: 'system', text: `Running ${node.name} (${languageName(lang)})…` })
    const start = Date.now()
    try {
      const settings = get().settings
      const files = collectProjectFiles(get().nodeMap)
      files[node.path] = node.content
      const result = await executeCode(node.content, node.path, get().stdin, {
        apiKey: settings.judge0ApiKey,
        baseUrl: settings.judge0BaseUrl,
        timeLimit: settings.timeLimit,
        memoryLimit: settings.memoryLimit,
      }, files)
      const source = result.source
      set({ lastRunSource: source })

      if (result.stdout.trim()) appendTerminal({ kind: 'stdout', text: result.stdout.trimEnd() })
      if (result.stderr.trim()) appendTerminal({ kind: 'stderr', text: result.stderr.trimEnd() })
      if (result.compileOutput.trim()) appendTerminal({ kind: 'system', text: result.compileOutput.trimEnd() })

      const elapsed = Date.now() - start
      appendTerminal({ kind: 'system', text: `Execution time: ${(elapsed / 1000).toFixed(2)}s · memory: ${result.memoryKb}KB · status: ${result.status}`, source })
      if (result.status === 'time_limit_exceeded') {
        get().showToast('Your code exceeded the time limit. Consider optimizing your solution.', 'error')
      }

      // persist to history
      const hist: Omit<ExecutionResult, 'id'> = {
        fileId: node.id,
        projectId: get().activeProjectId || '',
        languageName: languageName(lang),
        code: node.content,
        stdout: result.stdout, stderr: result.stderr, compileOutput: result.compileOutput,
        status: result.status,
        timeMs: elapsed, memoryKb: result.memoryKb, timestamp: Date.now(),
      }
      await historyDb.addExecutionResult(hist)
      set({ running: false, runningFileId: null })
    } catch (err) {
      const msg = (err as Error).message || 'Execution failed'
      appendTerminal({ kind: 'system', text: `Error: ${msg}` })
      get().showToast(msg, 'error')
      set({ running: false, runningFileId: null })
    }
  },

  setStdin: (v) => set({ stdin: v }),
  setTerminalOpen: (v) => { set({ terminalOpen: v }); get().persistEditorState() },
  setTerminalHeight: (v) => { set({ terminalHeight: v }); get().persistEditorState() },
  clearTerminal: () => set({ terminalText: [] }),
  loadHistory: async () => set({ history: await historyDb.listExecutionHistory() }),

  toggleDrawer: (open) => set((s) => ({ drawerOpen: open ?? !s.drawerOpen })),
  setDrawerTab: (t) => set({ drawerTab: t }),
  openContextMenu: (m) => set({ contextMenu: m }),
  closeContextMenu: () => set({ contextMenu: null }),
  setCommandPalette: (v) => set({ commandPaletteOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setNewItemModal: (m) => set({ newItemModal: m }),

  updateSettings: async (patch) => {
    const next = await settingsDb.updateSettings({ ...get().settings, ...patch })
    set({ settings: next })
    if (patch.termuxBridgeUrl !== undefined) {
      setBridgeOrigin(next.termuxBridgeUrl)
      clearBridgeCache()
      void get().refreshTermuxStatus()
    }
  },

  // ---- GitHub actions ----
  connectGitHub: () => {
    try { navigator.vibrate?.(10) } catch {}
    authService.beginOAuth()
  },
  handleCallback: async () => {
    try {
      const auth = await authService.handleOAuthCallback()
      if (auth) set({ auth })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  disconnectGitHub: async () => {
    await authService.signOut()
    set({ auth: null, repos: [] })
    get().showToast('Disconnected from GitHub', 'success')
  },
  openRepoBrowser: () => { set({ repoBrowserOpen: true }); get().loadRepos() },
  closeRepoBrowser: () => set({ repoBrowserOpen: false }),
  loadRepos: async () => {
    const auth = get().auth
    if (!auth) return
    set({ reposLoading: true })
    try {
      const repos = await ghSvc.listRepos(auth.token)
      set({ repos })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    } finally {
      set({ reposLoading: false })
    }
  },
  cloneRepo: async (repo) => {
    if (!requireOnline()) return
    set({ cloneProgress: { label: 'Starting…', done: 0, total: 0 } })
    try {
      const name = repo.name
      const project = await gitService.cloneRepository(repo, name, (p) => set({ cloneProgress: p }))
      set({ cloneProgress: null, repoBrowserOpen: false })
      set((s) => ({ projects: [...s.projects, project] }))
      await get().setActiveProject(project.id)
      get().showToast(`Cloned ${repo.full_name}`, 'success')
    } catch (err) {
      set({ cloneProgress: null })
      get().showToast((err as Error).message, 'error')
    }
  },
  openUpload: () => set({ uploadOpen: true }),
  closeUpload: () => set({ uploadOpen: false }),
  uploadToGitHub: async (opts) => {
    if (!requireOnline()) return
    const pid = get().activeProjectId
    if (!pid) return
    set({ uploading: true })
    try {
      const result = await gitService.uploadProjectToGitHub(pid, opts, (p) => set({ cloneProgress: p }))
      const fresh = await projectsDb.getProject(pid)
      if (fresh) set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? fresh : p)) }))
      set({ uploadOpen: false, uploading: false, cloneProgress: null })
      await get().refreshProject()
      await get().refreshGitStatus()
      get().showToast(`Uploaded to ${result.owner}/${result.repo}`, 'success')
    } catch (err) {
      set({ uploading: false, cloneProgress: null })
      get().showToast((err as Error).message, 'error')
    }
  },
  importZipIntoCurrentProject: async (file) => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      const entries = await parseZipFile(file)
      const result = await gitService.mergeEntriesIntoProject(pid, entries)
      await get().refreshProject()
      await get().refreshGitStatus()
      get().showToast(`Imported ${result.created + result.updated} file(s) from ZIP`, 'success')
    } catch (err) {
      get().showToast((err as Error).message || 'Could not open ZIP', 'error')
    }
  },
  openCommit: () => { set({ commitOpen: true }); get().refreshGitStatus() },
  closeCommit: () => set({ commitOpen: false }),
  doCommit: async (message, includeIds, push) => {
    if (!requireOnline()) return
    const pid = get().activeProjectId
    if (!pid || !message.trim()) return
    try {
      const sha = await gitService.commitChanges(pid, { message: message.trim(), includeIds, push })
      await get().refreshProject()
      await get().refreshGitStatus()
      set({ commitOpen: false })
      get().showToast(`Committed ${sha.slice(0, 7)}`, 'success')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  openBranchPicker: () => { set({ branchPickerOpen: true }); get().loadBranches() },
  closeBranchPicker: () => set({ branchPickerOpen: false }),
  loadBranches: async () => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      const branches = await gitService.listBranches(pid)
      set({ branches })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  doSwitchBranch: async (name) => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      await gitService.switchBranch(pid, name)
      set({ branchPickerOpen: false })
      get().showToast(`Switched to ${name}`, 'success')
      await get().doPull()
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  doCreateBranch: async (name) => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      await gitService.createBranch(pid, name)
      await get().loadBranches()
      get().showToast(`Created branch ${name}`, 'success')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  doDeleteBranch: async (name) => {
    if (!requireOnline()) return
    const pid = get().activeProjectId
    if (!pid) return
    try {
      await gitService.deleteBranch(pid, name)
      await get().loadBranches()
      get().showToast(`Deleted ${name}`, 'success')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  openConflict: (fileId) => set({ conflictFileId: fileId }),
  closeConflict: () => set({ conflictFileId: null }),
  resolveConflict: async (fileId, choice) => {
    const conflict = get().gitConflicts.find((c) => c.fileId === fileId)
    const node = get().nodeMap[fileId]
    if (!conflict || !node) return
    let next = node.content
    if (choice === 'remote') next = conflict.remote
    else if (choice === 'local') next = conflict.local
    else {
      next = `<<<<<<< Local\n${conflict.local.replace(/\n$/, '')}\n=======\n${conflict.remote.replace(/\n$/, '')}\n>>>>>>> Remote\n`
    }
    get().saveContent(fileId, next)
    if (choice === 'remote') {
      try {
        await fsDb.syncGitFile(fileId, next, conflict.remoteSha)
      } catch {
        await get().persistContent(fileId)
      }
    } else {
      await get().persistContent(fileId)
    }
    await get().refreshProject()
    set((s) => ({
      gitConflicts: s.gitConflicts.filter((c) => c.fileId !== fileId),
      conflictFileId: s.conflictFileId === fileId ? null : s.conflictFileId,
    }))
    get().showToast(choice === 'both' ? 'Kept both with conflict markers' : `Kept ${choice} version`, 'success')
    await get().refreshGitStatus()
  },
  openDiff: (fileId) => set({ diffFileId: fileId }),
  closeDiff: () => set({ diffFileId: null }),
  discardFileChanges: async (fileId) => {
    await gitService.discardChanges(fileId)
    await get().refreshProject()
    await get().refreshGitStatus()
    set({ diffFileId: null })
    get().showToast('Changes discarded', 'success')
  },
  doPull: async () => {
    if (!requireOnline()) return
    const pid = get().activeProjectId
    if (!pid) return
    set({ pulling: true })
    try {
      const result = await gitService.pullChanges(pid, (p) => set({ cloneProgress: p }))
      set({ cloneProgress: null, pulling: false })
      await get().refreshProject()
      await get().refreshGitStatus()
      let msg = `Pull complete. ${result.updated} updated, ${result.created} created.`
      if (result.conflicts.length) msg += ` ${result.conflicts.length} conflict(s).`
      set({ gitConflicts: result.conflictDetails || [] })
      get().showToast(msg, result.conflicts.length ? 'error' : 'success')
      if (result.conflictDetails?.length) {
        set({ conflictFileId: result.conflictDetails[0].fileId, drawerOpen: true, drawerTab: 'git' })
      }
      if (result.deletedRemote.length) {
        get().showToast(`WARNING: ${result.deletedRemote.length} file(s) deleted remotely were kept locally.`, 'info')
      }
    } catch (err) {
      set({ cloneProgress: null, pulling: false })
      get().showToast((err as Error).message, 'error')
    }
  },
  refreshGitStatus: async () => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      const status = await gitService.computeGitStatus(pid, get().nodeMap)
      set({ gitStatus: status })
    } catch {
      // no-op
    }
  },
  setFindInProject: (v) => set({ findInProjectOpen: v }),
  loadRateLimit: async () => {
    const auth = get().auth
    if (!auth) return
    try {
      const limit = await ghSvc.getRateLimit(auth.token)
      set({ rateLimit: limit })
    } catch {
      set({ rateLimit: null })
    }
  },

  // ---- Phase 4 actions ----
  setHistoryBrowser: (v) => set({ historyBrowserOpen: v }),
  loadSnippets: async () => set({ snippets: await snippetsDb.listSnippets() }),
  addSnippet: async (s) => {
    await snippetsDb.addSnippet(s)
    set({ snippets: await snippetsDb.listSnippets() })
    get().showToast('Snippet saved', 'success')
  },
  deleteSnippet: async (id) => {
    await snippetsDb.deleteSnippet(id)
    set({ snippets: await snippetsDb.listSnippets() })
    get().showToast('Snippet deleted', 'success')
  },
  setSnippetsOpen: (v) => { set({ snippetsOpen: v }); if (v) get().loadSnippets() },
  openGitLog: () => { set({ gitLogOpen: true }); get().loadGitLog() },
  closeGitLog: () => set({ gitLogOpen: false }),
  loadGitLog: async () => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      const commits = await gitService.getCommitLog(pid)
      set({ gitLog: commits })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  openPrs: () => { set({ prsOpen: true }); get().loadPrs() },
  closePrs: () => set({ prsOpen: false }),
  loadPrs: async () => {
    const pid = get().activeProjectId
    if (!pid) return
    try {
      const prs = await gitService.getPullRequests(pid)
      set({ prs })
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },
  openPluginPanel: (id) => set({ activePluginPanel: id }),
  closePluginPanel: () => set({ activePluginPanel: null }),
  setLandscapeSplit: (v) => set({ landscapeSplit: v }),
  setMainFile: (fileId) => {
    const pid = get().activeProjectId
    if (!pid) return
    void get().updateSettings({ runConfiguration: { ...get().settings.runConfiguration, [pid]: fileId } })
    get().showToast('Set as main file to run', 'success')
  },
  refreshTermuxStatus: async () => {
    clearBridgeCache()
    const available = await checkTermuxBridge()
    set({ termuxAvailable: available })
  },
  openHome: (action) => {
    set({ homeAction: action ?? null })
    void get().setActiveProject(null)
  },
  setImportProjectOpen: (v) => set({ importProjectOpen: v }),

  // ---- Phase 5 actions ----
  setViewerOpen: (v) => set({ viewerOpen: v }),
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  setWelcomeOpen: (v) => set({ welcomeOpen: v }),
  toggleZen: () => set((s) => {
    const zenMode = !s.zenMode
    return {
      zenMode,
      drawerOpen: zenMode ? false : s.drawerOpen,
      terminalOpen: zenMode ? false : s.terminalOpen,
    }
  }),
  pinTab: (id) => set((s) => {
    if (s.pinnedTabs.includes(id)) return {}
    const pinnedTabs = [...s.pinnedTabs, id]
    return { pinnedTabs, openTabs: orderTabs(s.openTabs, pinnedTabs) }
  }),
  unpinTab: (id) => set((s) => {
    const pinnedTabs = s.pinnedTabs.filter((t) => t !== id)
    return { pinnedTabs, openTabs: orderTabs(s.openTabs, pinnedTabs) }
  }),
  togglePinTab: (id) => {
    if (get().pinnedTabs.includes(id)) get().unpinTab(id)
    else get().pinTab(id)
    void get().persistEditorState()
  },
  closeOtherTabs: async (id) => {
    const keep = new Set([id, ...get().pinnedTabs])
    for (const t of [...get().openTabs]) {
      if (!keep.has(t)) await get().closeTab(t)
    }
  },
  closeTabsToTheRight: async (id) => {
    const idx = get().openTabs.indexOf(id)
    if (idx < 0) return
    const pinned = new Set(get().pinnedTabs)
    for (const t of get().openTabs.slice(idx + 1)) {
      if (!pinned.has(t)) await get().closeTab(t)
    }
  },
  closeSavedTabs: async () => {
    const pinned = new Set(get().pinnedTabs)
    for (const t of [...get().openTabs]) {
      if (!get().dirtyTabs[t] && !pinned.has(t)) await get().closeTab(t)
    }
  },
  reorderTabs: (fromId, toId) => {
    if (fromId === toId) return
    set((s) => {
      const tabs = [...s.openTabs]
      const from = tabs.indexOf(fromId)
      const to = tabs.indexOf(toId)
      if (from < 0 || to < 0) return {}
      tabs.splice(from, 1)
      tabs.splice(to, 0, fromId)
      return { openTabs: orderTabs(tabs, s.pinnedTabs) }
    })
    void get().persistEditorState()
  },
  goToDefinition: async () => {
    const id = get().activeTabId
    const node = id ? get().nodeMap[id] : undefined
    if (!node) return
    const name = getWordAtCursor() || wordAt(node.content, get().cursorPos.line, get().cursorPos.col)
    if (!name) {
      get().showToast('No symbol under cursor', 'info')
      return
    }
    const files = Object.values(get().nodeMap).filter((n) => n.type === 'file').map((n) => ({ id: n.id, path: n.path, content: n.content }))
    const hits = findDefinitions(name, files, id || undefined)
    if (!hits.length) {
      get().showToast(`No definition for “${name}”`, 'info')
      return
    }
    await get().goToLocation(hits[0].fileId, hits[0].line, hits[0].col)
    if (hits.length > 1) {
      set({ referenceHits: hits, referencesOpen: true })
      get().showToast(`${hits.length} definitions — pick one`, 'info')
    }
  },
  findReferences: async () => {
    const id = get().activeTabId
    const node = id ? get().nodeMap[id] : undefined
    if (!node) return
    const name = getWordAtCursor() || wordAt(node.content, get().cursorPos.line, get().cursorPos.col)
    if (!name) {
      get().showToast('No symbol under cursor', 'info')
      return
    }
    const files = Object.values(get().nodeMap).filter((n) => n.type === 'file').map((n) => ({ id: n.id, path: n.path, content: n.content }))
    const hits = findRefs(name, files)
    set({ referenceHits: hits, referencesOpen: true, symbolSearchOpen: false })
    if (!hits.length) get().showToast(`No references to “${name}”`, 'info')
  },
  openRename: () => {
    const name = getWordAtCursor()
    if (!name) {
      get().showToast('No symbol under cursor', 'info')
      return
    }
    set({ renameOpen: true })
  },
  closeRename: () => set({ renameOpen: false }),
  renameCurrentSymbol: async (next) => {
    const name = getWordAtCursor()
    if (!name || !next.trim() || next.trim() === name) {
      set({ renameOpen: false })
      return 0
    }
    let total = 0
    const files = Object.values(get().nodeMap).filter((n) => n.type === 'file')
    for (const n of files) {
      const result = renameInText(n.content, name, next.trim())
      if (!result.count) continue
      total += result.count
      get().saveContent(n.id, result.text)
      if (get().activeTabId === n.id) replaceDocument(result.text)
      await get().persistContent(n.id)
    }
    set({ renameOpen: false })
    get().refreshDiagnostics()
    get().showToast(total ? `Renamed ${total} occurrence${total === 1 ? '' : 's'}` : 'Nothing to rename', total ? 'success' : 'info')
    return total
  },
  setSymbolSearchOpen: (v) => set({ symbolSearchOpen: v }),
  setReferencesOpen: (v) => set({ referencesOpen: v }),
  importThemeJson: async (text) => {
    try {
      const imported = parseThemeText(text)
      const customThemes: Record<string, ThemePalette> = { ...get().settings.customThemes, [imported.key]: imported.palette }
      await get().updateSettings({ customThemes, themePreset: imported.key })
      get().showToast(`Imported theme “${imported.palette.name}”`, 'success')
    } catch (err) {
      get().showToast((err as Error).message || 'Could not import theme', 'error')
    }
  },
  openPreviewInNewTab: async () => {
    const id = get().activeTabId
    const node = id ? get().nodeMap[id] : undefined
    if (!node || !isHtmlPreview(node.path)) {
      get().showToast('Open an HTML file first', 'info')
      return
    }
    const files = collectProjectFiles(get().nodeMap)
    files[node.path] = node.content
    if (await termuxSupportsPreview()) {
      const ok = await syncTermuxWorkspace(files)
      if (ok) {
        window.open(previewUrlFor(node.path), '_blank', 'noopener')
        return
      }
    }
    const bundled = buildHtmlPreview(node.content, node.path, files)
    const blob = new Blob([bundled.html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank', 'noopener')
  },
  setPreviewMode: (m) => set({ previewMode: m }),
  cyclePreviewMode: () => {
    const order: PreviewMode[] = ['editor', 'split', 'preview']
    const i = order.indexOf(get().previewMode)
    set({ previewMode: order[(i + 1) % order.length] })
  },
  setBottomPanelTab: (t) => set({ bottomPanelTab: t }),
  openBottomPanel: (t) => set({ terminalOpen: true, ...(t ? { bottomPanelTab: t } : {}) }),
  refreshDiagnostics: () => set({ diagnostics: diagnoseProject(get().nodeMap) }),
  setCursorPos: (p) => set({ cursorPos: p }),
  setGoToLineOpen: (v) => set({ goToLineOpen: v }),
  goToLocation: async (fileId, line, col = 1) => {
    set({ pendingGoTo: { fileId, line, col } })
    await get().openFile(fileId)
    // If the file is already active the editor effect may have already run —
    // apply immediately as well.
    if (get().activeTabId === fileId) {
      goToPosition(line, col)
      set({ pendingGoTo: null })
    }
  },
  clearPendingGoTo: () => set({ pendingGoTo: null }),
  revealInExplorer: (nodeId) => {
    const map = get().nodeMap
    const expanded = { ...get().expanded }
    let n = map[nodeId]
    if (n?.type === 'folder') expanded[n.id] = true
    while (n?.parentId) {
      expanded[n.parentId] = true
      n = map[n.parentId]
    }
    set({ expanded, drawerOpen: true, drawerTab: 'files' })
  },
  formatActiveDocument: () => {
    const id = get().activeTabId
    const node = id ? get().nodeMap[id] : undefined
    if (!id || !node || node.type !== 'file') {
      get().showToast('Open a file to format it', 'info')
      return
    }
    void (async () => {
      const result = await formatDocument(node.content, detectLanguage(node.path), get().settings.tabSize)
      if (!result.ok) {
        get().showToast(result.error, 'error')
        return
      }
      if (result.text === node.content) {
        get().showToast('Already formatted', 'info')
        return
      }
      replaceDocument(result.text)
      get().saveContent(id, result.text)
      void get().persistContent(id)
      get().refreshDiagnostics()
      get().showToast('Document formatted', 'success')
    })()
  },
  replaceInProject: async (query, replacement, opts = {}) => {
    if (!query) return 0
    let total = 0
    const files = Object.values(get().nodeMap).filter((n) => n.type === 'file')
    for (const n of files) {
      const next = replaceInText(n.content, query, replacement, opts)
      if (next.count === 0) continue
      total += next.count
      get().saveContent(n.id, next.text)
      await get().persistContent(n.id)
    }
    get().refreshDiagnostics()
    return total
  },
  clearHistory: async () => {
    await historyDb.clearExecutionHistory()
    set({ history: [] })
    get().showToast('Execution history cleared', 'success')
  },

  exportProjectZip: async () => {
    const pid = get().activeProjectId
    const proj = get().projects.find((p) => p.id === pid)
    if (!pid || !proj) { get().showToast('Open a project first', 'info'); return }
    try {
      await downloadProjectZip(pid, proj.name)
      get().showToast('Project exported as ZIP', 'success')
    } catch (err) {
      get().showToast((err as Error).message || 'Export failed', 'error')
    }
  },
  /** Download a single file, or a folder as a .zip of its subtree. */
  downloadNode: async (id) => {
    const node = get().nodeMap[id]
    const pid = get().activeProjectId
    if (!node || !pid) return
    try {
      const { saveAs } = await import('file-saver')
      if (node.type === 'file') {
        saveAs(storedContentToBlob(node.content, node.path), node.name)
      } else {
        const blob = await buildSubtreeZip(pid, node.path)
        saveAs(blob, `${node.name}.zip`)
      }
      get().showToast(`Downloaded ${node.name}`, 'success')
    } catch (err) {
      get().showToast((err as Error).message || 'Download failed', 'error')
    }
  },
  /** Share a file (or a folder as .zip) via the native share sheet. */
  shareNode: async (id) => {
    const node = get().nodeMap[id]
    const pid = get().activeProjectId
    if (!node || !pid) return
    try {
      const toShare = async (): Promise<File> => {
        if (node.type === 'file') {
          return new File([storedContentToBlob(node.content, node.path)], node.name, { type: mimeForPath(node.path) })
        }
        const blob = await buildSubtreeZip(pid, node.path)
        return new File([blob], `${node.name}.zip`, { type: 'application/zip' })
      }
      const file = await toShare()
      const data = { title: node.name, files: [file] }
      const canFileShare = !navigator.canShare || navigator.canShare(data)
      if (navigator.share && canFileShare) {
        await navigator.share(data).catch(() => {})
        return
      }
      // fallback — copy path so the user can still grab it
      try { navigator.clipboard?.writeText(node.path) } catch {}
      get().showToast('Sharing not supported here — path copied', 'info')
    } catch (err) {
      get().showToast((err as Error).message || 'Share failed', 'error')
    }
  },
  importProjectFromEntries: async (entries, name) => {
    const seed = entriesToSeed(entries)
    if (!seed.length) { get().showToast('No files to import', 'error'); return null }
    const projectName = name || seed[0].path.split('/')[0] || 'Imported project'
    try {
      const project = await get().newProject(projectName, seed)
      return project
    } catch (err) {
      get().showToast((err as Error).message || 'Import failed', 'error')
      return null
    }
  },
  importProjectFromZip: async (file) => {
    try {
      const entries = await parseZipFile(file)
      const base = (file.name || 'import.zip').replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9-_]/g, '_') || 'Imported project'
      await get().importProjectFromEntries(entries, base)
    } catch (err) {
      get().showToast((err as Error).message || 'Could not open ZIP', 'error')
    }
  },
  importProjectFromFiles: async (files) => {
    try {
      const entries = await filesToEntries(files)
      await get().importProjectFromEntries(entries)
    } catch (err) {
      get().showToast((err as Error).message || 'Could not import files', 'error')
    }
  },
}))

// ---- module helpers (kept out of JSX scope) ----
function s_nodeMap(map: Record<string, FileNode>, id: string): FileNode | undefined {
  return map[id]
}
function appendTerminal(line: Omit<TerminalLine, 'id'>) {
  useStore.setState((s) => ({ terminalText: [...s.terminalText, { ...line, id: uuid() }].slice(-200) }))
}
async function dbUpdateRoot(id: string, patch: Partial<FileNode>) {
  await db.files.update(id, patch)
}
async function createSeedPath(projectId: string, rootId: string, seed: SeedFile) {
  const parts = seed.path.split('/').filter(Boolean)
  const dirs = parts.slice(0, -1)
  const file = parts[parts.length - 1]
  let parentId: string | null = rootId
  for (const d of dirs) {
    const existing = await findChildByName(projectId, parentId, d, 'folder')
    if (existing) parentId = existing
    else {
      const n = await fsDb.createNode(projectId, parentId, d, 'folder')
      parentId = n.id
    }
  }
  await fsDb.createNode(projectId, parentId, file, 'file', seed.content)
}

function insertTab(openTabs: string[], pinnedTabs: string[], id: string): string[] {
  if (openTabs.includes(id)) return openTabs
  return orderTabs([...openTabs, id], pinnedTabs)
}

function orderTabs(openTabs: string[], pinnedTabs: string[]): string[] {
  const pinned = pinnedTabs.filter((id) => openTabs.includes(id))
  const rest = openTabs.filter((id) => !pinnedTabs.includes(id))
  return [...pinned, ...rest]
}

function getRootNodeId(nodeMap: Record<string, FileNode>): string | null {
  const root = Object.values(nodeMap).find((n) => n.path === '/')
  return root ? root.id : null
}

async function findChildByName(projectId: string, parentId: string | null, name: string, type: 'file' | 'folder'): Promise<string | null> {
  const children = await fsDb.getChildren(parentId, projectId)
  const match = children.find((c) => c.type === type && c.name.toLowerCase() === name.toLowerCase())
  return match ? match.id : null
}
