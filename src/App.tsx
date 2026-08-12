import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { applyThemePreset } from './utils/theme'
import { Home } from './components/Home'
import { TopBar } from './components/TopBar'
import { TabBar } from './components/TabBar'
import { EditorWorkspace } from './components/Editor/EditorWorkspace'
import { KeyboardToolbar } from './components/KeyboardToolbar'
import { Breadcrumbs } from './components/Breadcrumbs'
import { StatusBar } from './components/StatusBar'
import { GoToLine } from './components/GoToLine'
import { useIDEShortcuts } from './hooks/useIDEShortcuts'
import { Drawer } from './components/Drawer'
import { CommandPalette } from './components/CommandPalette'
import { FindInProject } from './components/FindInProject'
import { Settings } from './components/Settings'
import { ContextMenu } from './components/Shared/ContextMenu'
import { Toasts } from './components/Shared/Toasts'
import { RepoBrowser } from './components/GitHub/RepoBrowser'
import { CommitModal } from './components/GitHub/CommitModal'
import { DiffViewer } from './components/GitHub/DiffViewer'
import { BranchPicker } from './components/GitHub/BranchPicker'
import { ImportProjectModal } from './components/Shared/ImportProjectModal'
import { ExecutionHistory } from './components/ExecutionHistory'
import { SnippetLibrary } from './components/SnippetLibrary'
import { GitLog } from './components/GitHub/GitLog'
import { PullRequests } from './components/GitHub/PullRequests'
import { PluginHost } from './components/PluginHost'
import { FileListSidebar } from './components/FileExplorer/FileListSidebar'
import { initBuiltinPlugins } from './plugins/builtin'
import { usePWA } from './hooks/usePWA'
import { AiOutlineDownload } from 'react-icons/ai'
import { VscCircleSlash, VscClose } from 'react-icons/vsc'

function OfflineBanner() {
  const offline = useStore((s) => s.offline)
  if (!offline) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-[12px] font-semibold text-black shadow-lg">
        <VscCircleSlash /> Offline — editing works, syncing paused
      </div>
    </div>
  )
}

function InstallBanner() {
  const { canInstall, install, dismiss } = usePWA()
  if (!canInstall) return null
  return (
    <div className="fixed inset-x-0 bottom-4 z-[45] flex justify-center px-4">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-xl bg-surface/95 p-3 shadow-xl backdrop-blur dark:bg-panel">
        <AiOutlineDownload className="text-accent text-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">Install CodeFlow</div>
          <div className="text-[11px] text-ink-muted">Native app experience with offline support</div>
        </div>
        <button onClick={install} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white">Install</button>
        <button onClick={dismiss} aria-label="Dismiss" className="flex h-8 w-8 items-center justify-center rounded text-ink-muted active:bg-black/5 dark:active:bg-white/10">
          <VscClose />
        </button>
      </div>
    </div>
  )
}

export default function App() {
  useIDEShortcuts()
  const booted = useStore((s) => s.booted)
  const bootstrap = useStore((s) => s.bootstrap)
  const activeProjectId = useStore((s) => s.activeProjectId)
  const themePreset = useStore((s) => s.settings.themePreset)
  const landscapeSplit = useStore((s) => s.landscapeSplit)
  const importProjectOpen = useStore((s) => s.importProjectOpen)

  useEffect(() => {
    initBuiltinPlugins()
    bootstrap()
  }, [bootstrap])

  // Auto-enable the split editor in landscape (width > height)
  useEffect(() => {
    const onResize = () => {
      const isLandscape = window.innerWidth > window.innerHeight
      useStore.getState().setLandscapeSplit(isLandscape)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Apply the full theme palette as CSS variables (sets the dark class too)
  useEffect(() => {
    applyThemePreset(themePreset)
  }, [themePreset])

  if (!booted) {
    return <div className="flex h-dvh items-center justify-center bg-surface text-ink-muted dark:bg-panel">Loading…</div>
  }

  return (
    <div className="bg-app flex h-dvh flex-col overflow-hidden text-ink">
      {activeProjectId ? (
        <>
          <TopBar />
          <TabBar />
          <Breadcrumbs />
          <div className={`relative flex min-h-0 flex-1 ${landscapeSplit ? 'flex-row' : 'flex-col'}`}>
            {landscapeSplit && !useStore.getState().drawerOpen && <FileListSidebar />}
            <EditorWorkspace />
          </div>
          <StatusBar />
          <KeyboardToolbar />
        </>
      ) : (
        <Home />
      )}

      <Drawer />
      <CommandPalette />
      <FindInProject />
      <Settings />
      <ContextMenu />
      <ImportProjectModal
        open={importProjectOpen}
        onClose={() => useStore.getState().setImportProjectOpen(false)}
      />
      <RepoBrowser />
      <CommitModal />
      <DiffViewer />
      <BranchPicker />
      <ExecutionHistory />
      <SnippetLibrary />
      <GitLog />
      <PullRequests />
      <PluginHost />
      <GoToLine />
      <Toasts />
      <OfflineBanner />
      <InstallBanner />
    </div>
  )
}
