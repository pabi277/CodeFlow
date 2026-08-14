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
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => toggleDrawer(false)} />
      <div className="glass absolute inset-y-0 left-0 flex w-[85vw] max-w-[400px] flex-col border-r border-border/50 shadow-drawer animate-drawer-in">
        <div className="p-3 pb-2">
          <div className="relative grid grid-cols-2 rounded-xl border border-border/40 bg-input/60 p-1">
            <span
              aria-hidden
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-accent shadow-glow transition-transform duration-200 ease-out"
              style={{ transform: drawerTab === 'files' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))', left: 0 }}
            />
            <button
              onClick={() => setDrawerTab('files')}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${drawerTab === 'files' ? 'text-white' : 'text-ink-muted'}`}
            >
              <FiFile /> Files
            </button>
            <button
              onClick={() => setDrawerTab('git')}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${drawerTab === 'git' ? 'text-white' : 'text-ink-muted'}`}
            >
              <FiGitBranch /> Git
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">{drawerTab === 'files' ? <FileExplorer /> : <GitPanel />}</div>
      </div>
    </div>
  )
}
