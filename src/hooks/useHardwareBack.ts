import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/**
 * Android hardware Back (and the swipe gesture) closes the topmost open layer —
 * Settings, drawer, palette, modal, … — instead of quitting the PWA outright.
 *
 * Model: one history guard entry per open layer. Opening a layer pushes a state;
 * a real Back (popstate) closes the top layer; closing a layer from the UI pops
 * its guard entry back off the history. When the stack is empty, the next Back
 * leaves the app — so unsaved edits are flushed first (PR 1's flushDirtyTabs).
 *
 * This is purely internal plumbing: no new UI is added.
 */

interface Layer {
  key: string
  isOpen: () => boolean
  close: () => void
}

// Bottom → top. The order only matters to break ties when several layers are
// open at once; the last one in the list is treated as the topmost.
const LAYERS: Layer[] = [
  { key: 'drawer', isOpen: () => useStore.getState().drawerOpen, close: () => useStore.getState().toggleDrawer(false) },
  { key: 'palette', isOpen: () => useStore.getState().commandPaletteOpen, close: () => useStore.getState().setCommandPalette(false) },
  { key: 'settings', isOpen: () => useStore.getState().settingsOpen, close: () => useStore.getState().setSettingsOpen(false) },
  { key: 'context-menu', isOpen: () => !!useStore.getState().contextMenu, close: () => useStore.getState().closeContextMenu() },
  { key: 'new-item', isOpen: () => !!useStore.getState().newItemModal, close: () => useStore.getState().setNewItemModal(null) },
  { key: 'find', isOpen: () => useStore.getState().findInProjectOpen, close: () => useStore.getState().setFindInProject(false) },
  { key: 'import', isOpen: () => useStore.getState().importProjectOpen, close: () => useStore.getState().setImportProjectOpen(false) },
  { key: 'repo-browser', isOpen: () => useStore.getState().repoBrowserOpen, close: () => useStore.getState().closeRepoBrowser() },
  { key: 'upload', isOpen: () => useStore.getState().uploadOpen, close: () => useStore.getState().closeUpload() },
  { key: 'commit', isOpen: () => useStore.getState().commitOpen, close: () => useStore.getState().closeCommit() },
  { key: 'branch-picker', isOpen: () => useStore.getState().branchPickerOpen, close: () => useStore.getState().closeBranchPicker() },
  { key: 'history', isOpen: () => useStore.getState().historyBrowserOpen, close: () => useStore.getState().setHistoryBrowser(false) },
  { key: 'snippets', isOpen: () => useStore.getState().snippetsOpen, close: () => useStore.getState().setSnippetsOpen(false) },
  { key: 'git-log', isOpen: () => useStore.getState().gitLogOpen, close: () => useStore.getState().closeGitLog() },
  { key: 'prs', isOpen: () => useStore.getState().prsOpen, close: () => useStore.getState().closePrs() },
  { key: 'plugin', isOpen: () => !!useStore.getState().activePluginPanel, close: () => useStore.getState().closePluginPanel() },
  { key: 'goto-line', isOpen: () => useStore.getState().goToLineOpen, close: () => useStore.getState().setGoToLineOpen(false) },
  { key: 'shortcuts', isOpen: () => useStore.getState().shortcutsOpen, close: () => useStore.getState().setShortcutsOpen(false) },
  { key: 'welcome', isOpen: () => useStore.getState().welcomeOpen, close: () => useStore.getState().setWelcomeOpen(false) },
  { key: 'symbol-search', isOpen: () => useStore.getState().symbolSearchOpen, close: () => useStore.getState().setSymbolSearchOpen(false) },
  { key: 'rename', isOpen: () => useStore.getState().renameOpen, close: () => useStore.getState().closeRename() },
  { key: 'references', isOpen: () => useStore.getState().referencesOpen, close: () => useStore.getState().setReferencesOpen(false) },
  { key: 'viewer', isOpen: () => useStore.getState().viewerOpen, close: () => useStore.getState().setViewerOpen(false) },
  { key: 'diff', isOpen: () => !!useStore.getState().diffFileId, close: () => useStore.getState().closeDiff() },
  { key: 'conflict', isOpen: () => !!useStore.getState().conflictFileId, close: () => useStore.getState().closeConflict() },
  { key: 'input-wizard', isOpen: () => !!useStore.getState().inputWizard, close: () => useStore.getState().setInputWizard(null) },
]

let depth = 0
let suppress = 0
let inBack = false

function openCount(): number {
  return LAYERS.reduce((n, l) => (l.isOpen() ? n + 1 : n), 0)
}

function closeTop(): boolean {
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    if (LAYERS[i].isOpen()) {
      LAYERS[i].close()
      return true
    }
  }
  return false
}

export function useHardwareBack() {
  useEffect(() => {
    const push = () => {
      try { window.history.pushState({ codeflow: true }, '') } catch { /* ignore */ }
    }
    const go = (n: number) => {
      try { window.history.go(n) } catch { /* ignore */ }
    }

    // Reconcile the guard entries with the number of open layers whenever the
    // store changes (open or close, regardless of how the close happened).
    const sync = () => {
      const d = openCount()
      const prev = depth
      if (inBack) {
        depth = d
        return
      }
      if (d > prev) {
        for (let i = prev; i < d; i++) push()
      } else if (d < prev) {
        // A layer closed from the UI — drop its guard entry. The popstate
        // events fired by history.go() are swallowed by the suppress counter.
        suppress += prev - d
        go(-(prev - d))
      }
      depth = d
    }

    const onPop = () => {
      if (suppress > 0) {
        suppress--
        return
      }
      inBack = true
      const closed = closeTop()
      if (closed) {
        depth = openCount()
      } else {
        // Last layer closed — the next Back leaves the app. Flush unsaved edits.
        const s = useStore.getState()
        void s.flushDirtyTabs()
        void s.persistEditorState()
      }
      inBack = false
    }

    window.addEventListener('popstate', onPop)
    const unsub = useStore.subscribe(sync)
    // Prime against layers already open at mount (e.g. the welcome tour).
    sync()
    return () => {
      window.removeEventListener('popstate', onPop)
      unsub()
    }
  }, [])
}
