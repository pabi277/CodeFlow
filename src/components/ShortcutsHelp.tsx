import { useStore } from '../store/useStore'
import { SHORTCUTS } from '../config/site'
import { VscClose } from 'react-icons/vsc'

export function ShortcutsHelp() {
  const open = useStore((s) => s.shortcutsOpen)
  const setOpen = useStore((s) => s.setShortcutsOpen)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[58] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => setOpen(false)} />
      <div className="relative m-3 w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-modal animate-sheet-up dark:bg-panel">
        <div className="flex items-center border-b border-border/50 px-4 py-3">
          <h2 className="flex-1 text-[16px] font-semibold text-ink">Keyboard shortcuts</h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
            <VscClose />
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-border/40 overflow-y-auto px-2 py-1">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-[14px] text-ink">{s.action}</span>
              <kbd className="shrink-0 rounded-md border border-border/60 bg-input px-2 py-1 font-mono text-[11px] text-ink-muted">{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <p className="border-t border-border/40 px-4 py-3 text-[11px] text-ink-muted">
          On a phone, use the command palette (tap the file name) and the ⋯ menu instead.
        </p>
      </div>
    </div>
  )
}
