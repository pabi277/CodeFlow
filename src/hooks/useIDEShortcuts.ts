import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { openFind } from '../utils/editorApi'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Desktop / hardware-keyboard shortcuts. Ignored while typing in form fields
 *  except for palette / find, which should work from anywhere. */
export function useIDEShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const store = useStore.getState()

      if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault()
        store.setCommandPalette(true)
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        store.setCommandPalette(true)
        return
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        store.setGoToLineOpen(true)
        return
      }
      if (mod && e.key.toLowerCase() === 'b') {
        if (isTypingTarget(e.target) && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor'))) return
        e.preventDefault()
        store.toggleDrawer()
        return
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        store.setTerminalOpen(!store.terminalOpen)
        return
      }
      if (mod && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        store.setSymbolSearchOpen(true)
        return
      }
      if (e.key === 'F12' && e.shiftKey) {
        e.preventDefault()
        void store.findReferences()
        return
      }
      if (e.key === 'F12') {
        e.preventDefault()
        void store.goToDefinition()
        return
      }
      if (e.key === 'F2' && !mod) {
        if (isTypingTarget(e.target) && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor'))) return
        e.preventDefault()
        store.openRename()
        return
      }
      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        // Wait for a follow-up Z for zen (VS Code style Ctrl+K Z)
        const onZ = (ev: KeyboardEvent) => {
          window.removeEventListener('keydown', onZ, true)
          if (ev.key.toLowerCase() === 'z') {
            ev.preventDefault()
            store.toggleZen()
          }
        }
        window.addEventListener('keydown', onZ, true)
        setTimeout(() => window.removeEventListener('keydown', onZ, true), 800)
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        store.setFindInProject(true)
        return
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFind()
        return
      }
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        store.formatActiveDocument()
        return
      }
      if (e.key === '?' && !mod && !isTypingTarget(e.target)) {
        e.preventDefault()
        store.setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (store.commandPaletteOpen) store.setCommandPalette(false)
        else if (store.shortcutsOpen) store.setShortcutsOpen(false)
        else if (store.welcomeOpen) store.setWelcomeOpen(false)
        else if (store.goToLineOpen) store.setGoToLineOpen(false)
        else if (store.settingsOpen) store.setSettingsOpen(false)
        else if (store.drawerOpen) store.toggleDrawer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
