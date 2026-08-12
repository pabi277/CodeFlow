import { useStore } from '../store/useStore'
import { getPlugin } from '../plugins/registry'
import { FiChevronLeft, FiX } from 'react-icons/fi'

/**
 * Renders the active plugin's Panel as a full-screen overlay.
 * This is the generic hosting shell for plugin-provided screens.
 */
export function PluginHost() {
  const activePanel = useStore((s) => s.activePluginPanel)
  const close = useStore((s) => s.closePluginPanel)

  if (!activePanel) return null
  const plugin = getPlugin(activePanel)
  if (!plugin?.Panel) return null

  const Panel = plugin.Panel
  return (
    <div className="fixed inset-0 z-[50] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label={plugin.name}>
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={close} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">{plugin.name}</h1>
        <button onClick={close} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/5 dark:active:bg-white/5">
          <FiX />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Panel />
      </div>
    </div>
  )
}
