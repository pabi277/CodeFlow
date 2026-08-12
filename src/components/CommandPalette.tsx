import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { openFind } from '../utils/editorApi'
import { collectPluginCommands } from '../plugins/registry'
import { AiOutlineSearch, AiOutlineFile } from 'react-icons/ai'
import { VscSymbolMethod } from 'react-icons/vsc'
import type { FileNode } from '../types'

interface Cmd {
  label: string
  run: () => void
}

function fuzzy(query: string, target: string): number {
  const q = query.toLowerCase().replace(/\s+/g, '')
  const t = target.toLowerCase().replace(/\s+/g, '')
  if (!q) return 1
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length ? 40 - (t.length - q.length) * 0.1 : 0
}

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen)
  const setOpen = useStore((s) => s.setCommandPalette)
  const nodeMap = useStore((s) => s.nodeMap)
  const openFile = useStore((s) => s.openFile)
  const runCurrentFile = useStore((s) => s.runCurrentFile)
  const setNewItemModal = useStore((s) => s.setNewItemModal)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const clearTerminal = useStore((s) => s.clearTerminal)
  const setTerminalOpen = useStore((s) => s.setTerminalOpen)
  const closeTab = useStore((s) => s.closeTab)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const showToast = useStore((s) => s.showToast)
  const openRepoBrowser = useStore((s) => s.openRepoBrowser)
  const openCommit = useStore((s) => s.openCommit)
  const doPull = useStore((s) => s.doPull)
  const openBranchPicker = useStore((s) => s.openBranchPicker)
  const connectGitHub = useStore((s) => s.connectGitHub)
  const auth = useStore((s) => s.auth)
  const setFindInProject = useStore((s) => s.setFindInProject)
  const setHistoryBrowser = useStore((s) => s.setHistoryBrowser)
  const setSnippetsOpen = useStore((s) => s.setSnippetsOpen)
  const openGitLog = useStore((s) => s.openGitLog)
  const openPrs = useStore((s) => s.openPrs)
  const openHome = useStore((s) => s.openHome)
  const exportProjectZip = useStore((s) => s.exportProjectZip)
  const setImportProjectOpen = useStore((s) => s.setImportProjectOpen)
  const cyclePreviewMode = useStore((s) => s.cyclePreviewMode)
  const setPreviewMode = useStore((s) => s.setPreviewMode)
  const formatActiveDocument = useStore((s) => s.formatActiveDocument)
  const setGoToLineOpen = useStore((s) => s.setGoToLineOpen)
  const openBottomPanel = useStore((s) => s.openBottomPanel)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const commands: Cmd[] = useMemo(() => [
    { label: 'New Project', run: () => { openHome('new'); setOpen(false) } },
    { label: 'Open Projects', run: () => { openHome(); setOpen(false) } },
    { label: 'Import Project', run: () => { setImportProjectOpen(true); setOpen(false) } },
    { label: 'Export Project as ZIP', run: () => { exportProjectZip(); setOpen(false) } },
    { label: 'New File', run: () => { setNewItemModal({ parentId: null, type: 'file' }); setOpen(false) } },
    { label: 'New Folder', run: () => { setNewItemModal({ parentId: null, type: 'folder' }); setOpen(false) } },
    { label: 'Run Code', run: () => { runCurrentFile(); setOpen(false) } },
    { label: 'Open Settings', run: () => { setSettingsOpen(true); setOpen(false) } },
    { label: 'Toggle Theme', run: () => updateSettings({ themePreset: settings.themePreset === 'github-light' ? 'default-dark' : 'github-light' }) },
    { label: 'Toggle Terminal', run: () => setTerminalOpen(!useStore.getState().terminalOpen) },
    { label: 'Clear Terminal', run: () => clearTerminal() },
    { label: 'Close Current Tab', run: () => { const id = useStore.getState().activeTabId; if (id) closeTab(id) } },
    { label: 'Close All Tabs', run: () => { useStore.getState().openTabs.forEach((id) => closeTab(id)); setOpen(false) } },
    { label: 'Increase Font Size', run: () => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) }) },
    { label: 'Decrease Font Size', run: () => updateSettings({ fontSize: Math.max(10, settings.fontSize - 1) }) },
    { label: 'Toggle Line Numbers', run: () => updateSettings({ showLineNumbers: !settings.showLineNumbers }) },
    { label: 'Toggle Word Wrap', run: () => updateSettings({ wordWrap: !settings.wordWrap }) },
    { label: 'Toggle Minimap', run: () => updateSettings({ showMinimap: !settings.showMinimap }) },
    { label: 'Toggle Breadcrumbs', run: () => updateSettings({ showBreadcrumbs: !settings.showBreadcrumbs }) },
    { label: 'Toggle Status Bar', run: () => updateSettings({ showStatusBar: !settings.showStatusBar }) },
    { label: 'Toggle Preview', run: () => { cyclePreviewMode(); setOpen(false) } },
    { label: 'Preview: Editor Only', run: () => { setPreviewMode('editor'); setOpen(false) } },
    { label: 'Preview: Split', run: () => { setPreviewMode('split'); setOpen(false) } },
    { label: 'Preview: Preview Only', run: () => { setPreviewMode('preview'); setOpen(false) } },
    { label: 'Go to Line', run: () => { setGoToLineOpen(true); setOpen(false) } },
    { label: 'Format Document', run: () => { formatActiveDocument(); setOpen(false) } },
    { label: 'Show Problems', run: () => { openBottomPanel('problems'); setOpen(false) } },
    { label: 'Show Outline', run: () => { openBottomPanel('outline'); setOpen(false) } },
    { label: 'Show Terminal', run: () => { openBottomPanel('terminal'); setOpen(false) } },
    { label: 'Find in File', run: () => { openFind(); setOpen(false) } },
    { label: 'Find in Project', run: () => { setFindInProject(true); setOpen(false) } },
    { label: 'Show Execution History', run: () => { setHistoryBrowser(true); setOpen(false) } },
    { label: 'Snippet Library', run: () => { setSnippetsOpen(true); setOpen(false) } },
    { label: 'Git: Show History', run: () => { openGitLog(); setOpen(false) } },
    { label: 'Git: Pull Requests', run: () => { openPrs(); setOpen(false) } },
    ...(auth
      ? [
          { label: 'Git: Clone Repository', run: () => { openRepoBrowser(); setOpen(false) } },
          { label: 'Git: Commit', run: () => { openCommit(); setOpen(false) } },
          { label: 'Git: Pull', run: () => { doPull(); setOpen(false) } },
          { label: 'Git: Switch Branch', run: () => { openBranchPicker(); setOpen(false) } },
        ]
      : [
          { label: 'Git: Connect GitHub', run: () => { connectGitHub(); setOpen(false) } },
        ]),
  ], [settings, updateSettings, setNewItemModal, setOpen, runCurrentFile, setSettingsOpen, clearTerminal, setTerminalOpen, closeTab, showToast, auth, openRepoBrowser, openCommit, doPull, openBranchPicker, connectGitHub, setFindInProject, setHistoryBrowser, setSnippetsOpen, openGitLog, openPrs, openHome, exportProjectZip, setImportProjectOpen, cyclePreviewMode, setPreviewMode, formatActiveDocument, setGoToLineOpen, openBottomPanel])

  const files: FileNode[] = useMemo(() => Object.values(nodeMap).filter((n) => n.type === 'file'), [nodeMap])

  const pluginCmds = collectPluginCommands()
  const cmdResults = commands
    .map((c) => ({ type: 'cmd' as const, label: c.label, score: fuzzy(query, c.label), run: c.run }))
    .concat(pluginCmds.map((c) => ({ type: 'cmd' as const, label: c.label, score: fuzzy(query, c.label), run: c.run })))
    .filter((c) => c.score > 0)
  const fileResults = files
    .map((f) => ({ type: 'file' as const, label: f.path, score: fuzzy(query, f.path) * 0.9, id: f.id }))
    .filter((f) => f.score > 0)

  const results = [...cmdResults, ...fileResults].sort((a, b) => b.score - a.score).slice(0, 30)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => setOpen(false)} />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/60 bg-surface shadow-modal animate-palette-in dark:bg-panel">
        <div className="flex h-14 items-center gap-3 border-b border-border/60 px-4">
          <AiOutlineSearch className="shrink-0 text-ink-muted" size={22} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or file name…"
            className="flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted/60"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length ? (
            results.map((r) => (
              <button
                key={`${r.type}-${r.label}`}
                onClick={() => { if (r.type === 'file') { openFile(r.id); setOpen(false) } else r.run() }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[14px] text-ink active:bg-accent/10"
              >
                <span className={r.type === 'file' ? 'text-ink-muted' : 'text-accent'}>
                  {r.type === 'file' ? <AiOutlineFile size={18} /> : <VscSymbolMethod size={18} />}
                </span>
                <span className="truncate font-medium">{r.label}</span>
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-muted">No matching commands or files</p>
          )}
        </div>
      </div>
    </div>
  )
}
