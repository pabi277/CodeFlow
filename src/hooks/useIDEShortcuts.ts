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
      if (e.key === 'Escape') {
        if (store.commandPaletteOpen) store.setCommandPalette(false)
        else if (store.goToLineOpen) store.setGoToLineOpen(false)
        else if (store.settingsOpen) store.setSettingsOpen(false)
        else if (store.drawerOpen) store.toggleDrawer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
