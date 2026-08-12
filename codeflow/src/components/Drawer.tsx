import { useStore } from '../store/useStore'
import { FileExplorer } from './FileExplorer/FileExplorer'
import { GitPanel } from './GitHub/GitPanel'
import { FiFile, FiGitBranch } from 'react-icons/fi'

export function Drawer() {
  const drawerOpen = useStore((s) => s.drawerOpen)
  const toggleDrawer = useStore((s) => s.toggleDrawer)
  const drawerTab = useStore((s) => s.drawerTab)
  const setDrawerTab = useStore((s) => s.setDrawerTab)

  if (!drawerOpen) return null

  return (
    <div className="fixed inset-0 z-[40]" role="dialog" aria-label="File explorer">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => toggleDrawer(false)} />
      <div className="absolute inset-y-0 left-0 flex w-[85vw] max-w-[400px] flex-col bg-surface shadow-drawer animate-drawer-in dark:bg-panel">
        <div className="flex h-12 border-b border-border/60 dark:border-white/10">
          <button
            onClick={() => setDrawerTab('files')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-[3px] text-sm font-semibold transition-colors duration-200 ${drawerTab === 'files' ? 'border-accent text-accent' : 'border-transparent text-ink-muted opacity-70'}`}
          >
            <FiFile /> Files
          </button>
          <button
            onClick={() => setDrawerTab('git')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-[3px] text-sm font-semibold transition-colors duration-200 ${drawerTab === 'git' ? 'border-accent text-accent' : 'border-transparent text-ink-muted opacity-70'}`}
          >
            <FiGitBranch /> Git
          </button>
        </div>
        <div className="min-h-0 flex-1">{drawerTab === 'files' ? <FileExplorer /> : <GitPanel />}</div>
      </div>
    </div>
  )
}
