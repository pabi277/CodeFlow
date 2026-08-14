import { useState } from 'react'
import { useStore, runTargetNode } from '../store/useStore'
import { openFind } from '../utils/editorApi'
import { IconButton } from './Shared/IconButton'
import { BottomSheet } from './Shared/BottomSheet'
import { HiMenu, HiDotsVertical } from 'react-icons/hi'
import { FaPlay, FaStop } from 'react-icons/fa'
import { AiOutlineSetting, AiOutlineSearch, AiOutlinePlus, AiOutlineFolder, AiOutlineFileText, AiOutlineDownload, AiOutlineEye, AiOutlineExport } from 'react-icons/ai'
import { VscClearAll, VscTerminal, VscHistory, VscCode, VscGitCommit, VscError } from 'react-icons/vsc'
import { isHtmlPreview, isPreviewable } from '../utils/markdown'

export function TopBar() {
  const toggleDrawer = useStore((s) => s.toggleDrawer)
  const runCurrentFile = useStore((s) => s.runCurrentFile)
  const stopLiveRun = useStore((s) => s.stopLiveRun)
  const running = useStore((s) => s.running)
  const liveSessionId = useStore((s) => s.liveSessionId)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const setCommandPalette = useStore((s) => s.setCommandPalette)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const clearTerminal = useStore((s) => s.clearTerminal)
  const setTerminalOpen = useStore((s) => s.setTerminalOpen)
  const setNewItemModal = useStore((s) => s.setNewItemModal)
  const setFindInProject = useStore((s) => s.setFindInProject)
  const setHistoryBrowser = useStore((s) => s.setHistoryBrowser)
  const setSnippetsOpen = useStore((s) => s.setSnippetsOpen)
  const openGitLog = useStore((s) => s.openGitLog)
  const openHome = useStore((s) => s.openHome)
  const exportProjectZip = useStore((s) => s.exportProjectZip)
  const setImportProjectOpen = useStore((s) => s.setImportProjectOpen)
  const cyclePreviewMode = useStore((s) => s.cyclePreviewMode)
  const previewMode = useStore((s) => s.previewMode)
  const formatActiveDocument = useStore((s) => s.formatActiveDocument)
  const setGoToLineOpen = useStore((s) => s.setGoToLineOpen)
  const openBottomPanel = useStore((s) => s.openBottomPanel)
  const setViewerOpen = useStore((s) => s.setViewerOpen)
  const openPreviewInNewTab = useStore((s) => s.openPreviewInNewTab)
  const [menuOpen, setMenuOpen] = useState(false)

  const dirtyTabs = useStore((s) => s.dirtyTabs)
  const activeFile = activeTabId ? nodeMap[activeTabId] : undefined
  const dirty = activeTabId ? dirtyTabs[activeTabId] : false
  const canPreview = !!(activeFile && isPreviewable(activeFile.path))
  const canHtml = !!(activeFile && isHtmlPreview(activeFile.path))

  // The file Run will actually execute (respects the project's main-file override).
  const runLabel = useStore((s) => {
    const node = runTargetNode(s)
    if (!node) return 'Run'
    const pid = s.activeProjectId
    const main = pid ? s.settings.runConfiguration[pid] : undefined
    if (main && s.nodeMap[main]?.type === 'file' && main !== s.activeTabId) return `Run ${node.name}`
    return 'Run'
  })

  return (
    <>
      <div className="bar-glass bar-hairline flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <IconButton label="Menu" onClick={() => toggleDrawer()}>
          <HiMenu size={22} />
        </IconButton>
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-colors active:bg-black/5 dark:active:bg-white/5"
          onClick={() => setCommandPalette(true)}
          onDoubleClick={() => setCommandPalette(true)}
          aria-label="Open command palette"
        >
          <span className="truncate text-[15px] font-semibold text-ink">{activeFile ? activeFile.name : 'No file open'}</span>
          {activeFile && (
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
              dirty
                ? 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
            }`}>
              {dirty ? '● unsaved' : '✓ saved'}
            </span>
          )}
        </button>
        {canPreview && (
          <IconButton label={`Preview (${previewMode})`} onClick={() => cyclePreviewMode()}>
            <AiOutlineEye size={20} className={previewMode !== 'editor' ? 'text-accent' : undefined} />
          </IconButton>
        )}
        {liveSessionId ? (
          <button
            onClick={() => void stopLiveRun()}
            aria-label="Stop program"
            className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-4 font-semibold text-white shadow-[0_4px_16px_-2px_rgba(239,68,68,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform duration-150 active:scale-95"
          >
            <FaStop size={12} />
            <span className="text-[13px]">Stop</span>
          </button>
        ) : (
          <button
            onClick={() => runCurrentFile()}
            aria-label="Run code"
            className="btn-run flex h-11 items-center gap-2 rounded-xl px-4 font-semibold text-white"
          >
            {running ? <FaPlay className="animate-pulse" size={14} /> : <FaPlay size={14} />}
            <span className="text-[13px]">{runLabel}</span>
          </button>
        )}
        <IconButton label="More" onClick={() => setMenuOpen(true)}>
          <HiDotsVertical size={22} />
        </IconButton>
      </div>
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Actions">
        <div className="divide-y divide-ink/5 pb-2 dark:divide-white/5">
          <MenuItem icon={<AiOutlineFolder />} label="Open Projects" onPress={() => openHome()} />
          <MenuItem icon={<AiOutlinePlus />} label="New Project" onPress={() => openHome('new')} />
          <MenuItem icon={<AiOutlineDownload />} label="Import Project" onPress={() => setImportProjectOpen(true)} />
          <MenuItem icon={<AiOutlineFolder />} label="Export Project as ZIP" onPress={() => exportProjectZip()} />
          <MenuItem icon={<AiOutlineSearch />} label="Command Palette" onPress={() => setCommandPalette(true)} />
          <MenuItem icon={<AiOutlineFileText />} label="Find in File" onPress={() => openFind()} />
          <MenuItem icon={<AiOutlineFolder />} label="Find in Project" onPress={() => setFindInProject(true)} />
          <MenuItem icon={<AiOutlinePlus />} label="New File" onPress={() => setNewItemModal({ parentId: null, type: 'file' })} />
          <MenuItem icon={<AiOutlineFolder />} label="New Folder" onPress={() => setNewItemModal({ parentId: null, type: 'folder' })} />
          <MenuItem icon={<FaPlay />} label="Run Code" onPress={() => runCurrentFile()} />
          <MenuItem icon={<VscClearAll />} label="Clear Terminal" onPress={() => clearTerminal()} />
          <MenuItem icon={<VscTerminal />} label="Toggle Terminal" onPress={() => setTerminalOpen(!useStore.getState().terminalOpen)} />
          <MenuItem icon={<VscHistory />} label="Execution History" onPress={() => setHistoryBrowser(true)} />
          <MenuItem icon={<VscCode />} label="Snippets" onPress={() => setSnippetsOpen(true)} />
          <MenuItem icon={<VscGitCommit />} label="Git History" onPress={() => openGitLog()} />
          <MenuItem icon={<AiOutlineEye />} label="Toggle Preview" onPress={() => cyclePreviewMode()} />
          {canHtml && <MenuItem icon={<AiOutlineEye />} label="Open HTML Viewer" onPress={() => setViewerOpen(true)} />}
          {canHtml && <MenuItem icon={<AiOutlineExport />} label="Open Preview in New Tab" onPress={() => { void openPreviewInNewTab() }} />}
          <MenuItem icon={<VscCode />} label="Format Document" onPress={() => formatActiveDocument()} />
          <MenuItem icon={<AiOutlineSearch />} label="Go to Line" onPress={() => setGoToLineOpen(true)} />
          <MenuItem icon={<AiOutlineSearch />} label="Go to Symbol" onPress={() => useStore.getState().setSymbolSearchOpen(true)} />
          <MenuItem icon={<VscCode />} label="Go to Definition" onPress={() => { void useStore.getState().goToDefinition() }} />
          <MenuItem icon={<VscCode />} label="Find References" onPress={() => { void useStore.getState().findReferences() }} />
          <MenuItem icon={<VscCode />} label="Rename Symbol" onPress={() => useStore.getState().openRename()} />
          <MenuItem icon={<AiOutlineEye />} label="Zen Mode" onPress={() => useStore.getState().toggleZen()} />
          <MenuItem icon={<VscError />} label="Show Problems" onPress={() => openBottomPanel('problems')} />
          <MenuItem icon={<AiOutlineSetting />} label="Keyboard Shortcuts" onPress={() => useStore.getState().setShortcutsOpen(true)} />
          <MenuItem icon={<AiOutlineSetting />} label="Settings" onPress={() => setSettingsOpen(true)} />
        </div>
      </BottomSheet>
    </>
  )
}

function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <button onClick={onPress} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-ink active:bg-black/5 dark:active:bg-white/5">
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
