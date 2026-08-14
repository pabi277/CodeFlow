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
import { WelcomeTour, shouldShowWelcome } from './components/WelcomeTour'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { SymbolSearch, RenameSymbol, ReferencesPanel } from './components/SymbolSearch'
import { ConflictResolver } from './components/GitHub/ConflictResolver'
import { Preview } from './components/Editor/Preview'
import { isHtmlPreview } from './utils/markdown'
import { useIDEShortcuts } from './hooks/useIDEShortcuts'
import { Drawer } from './components/Drawer'
import { CommandPalette } from './components/CommandPalette'
import { FindInProject } from './components/FindInProject'
import { Settings } from './components/Settings'
import { ContextMenu } from './components/Shared/ContextMenu'
import { ProgramInputWizard } from './components/ProgramInputWizard'
import { Toasts } from './components/Shared/Toasts'
import { RepoBrowser } from './components/GitHub/RepoBrowser'
import { UploadModal } from './components/GitHub/UploadModal'
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
import { useHardwareBack } from './hooks/useHardwareBack'
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
  useHardwareBack()
  const booted = useStore((s) => s.booted)
  const bootstrap = useStore((s) => s.bootstrap)
  const activeProjectId = useStore((s) => s.activeProjectId)
  const themePreset = useStore((s) => s.settings.themePreset)
  const landscapeSplit = useStore((s) => s.landscapeSplit)
  const importProjectOpen = useStore((s) => s.importProjectOpen)
  const zenMode = useStore((s) => s.zenMode)
  const viewerOpen = useStore((s) => s.viewerOpen)
  const viewerFile = useStore((s) => {
    const id = s.activeTabId
    return id ? s.nodeMap[id] : undefined
  })

  useEffect(() => {
    initBuiltinPlugins()
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (booted && shouldShowWelcome()) useStore.getState().setWelcomeOpen(true)
  }, [booted])

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

  // Persist unsaved edits + editor state when the tab is hidden or unloaded.
  // Android kills the PWA without warning — pagehide / visibilitychange are the
  // last reliable chance to write the debounced saves and caret/scroll.
  useEffect(() => {
    const persistNow = () => {
      const s = useStore.getState()
      void s.flushDirtyTabs()
      void s.persistEditorState()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }
    window.addEventListener('pagehide', persistNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!booted) {
    return <div className="flex h-dvh items-center justify-center bg-surface text-ink-muted dark:bg-panel">Loading…</div>
  }

  return (
    <div className="bg-app flex h-dvh flex-col overflow-hidden text-ink">
      {activeProjectId ? (
        <>
          {!zenMode && <TopBar />}
          {!zenMode && <TabBar />}
          {!zenMode && <Breadcrumbs />}
          <div className={`relative flex min-h-0 flex-1 ${landscapeSplit && !zenMode ? 'flex-row' : 'flex-col'}`}>
            {landscapeSplit && !zenMode && !useStore.getState().drawerOpen && <FileListSidebar />}
            <EditorWorkspace />
          </div>
          {!zenMode && <StatusBar />}
          {!zenMode && <KeyboardToolbar />}
          {zenMode && (
            <button
              onClick={() => useStore.getState().toggleZen()}
              className="fixed right-3 top-3 z-[30] rounded-full bg-surface/90 px-3 py-1.5 text-[12px] font-semibold text-ink shadow-lg dark:bg-panel/90"
            >
              Exit zen
            </button>
          )}
        </>
      ) : (
        <Home />
      )}

      <Drawer />
      <CommandPalette />
      <FindInProject />
      <Settings />
      <ContextMenu />
      <ProgramInputWizard />
      <ImportProjectModal
        open={importProjectOpen}
        onClose={() => useStore.getState().setImportProjectOpen(false)}
      />
      <RepoBrowser />
      <UploadModal />
      <CommitModal />
      <DiffViewer />
      <BranchPicker />
      <ExecutionHistory />
      <SnippetLibrary />
      <GitLog />
      <PullRequests />
      <PluginHost />
      <GoToLine />
      <WelcomeTour />
      <ShortcutsHelp />
      <SymbolSearch />
      <RenameSymbol />
      <ReferencesPanel />
      <ConflictResolver />
      {viewerOpen && viewerFile && isHtmlPreview(viewerFile.path) && (
        <Preview
          content={viewerFile.content}
          path={viewerFile.path}
          variant="overlay"
          onClose={() => useStore.getState().setViewerOpen(false)}
        />
      )}
      <Toasts />
      <OfflineBanner />
      <InstallBanner />
    </div>
  )
}
