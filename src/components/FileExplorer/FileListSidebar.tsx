import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { detectLanguage } from '../../utils/language'
import { FiFile, FiMoreVertical } from 'react-icons/fi'

const LANG_COLORS: Record<string, string> = {
  python: 'text-blue-400', javascript: 'text-yellow-400', typescript: 'text-blue-300',
  c: 'text-slate-300', cpp: 'text-pink-400', java: 'text-orange-400', go: 'text-cyan-300',
  rust: 'text-orange-300', html: 'text-orange-400', css: 'text-sky-400', json: 'text-yellow-300',
  markdown: 'text-slate-300', sql: 'text-emerald-400', shell: 'text-green-400', yaml: 'text-red-300',
}

/**
 * Compact flat list of all project files (for the landscape split view).
 * Tapping a file opens it. Active file is highlighted.
 */
export function FileListSidebar() {
  const nodeMap = useStore((s) => s.nodeMap)
  const activeTabId = useStore((s) => s.activeTabId)
  const openFile = useStore((s) => s.openFile)
  const openContextMenu = useStore((s) => s.openContextMenu)

  const files = useMemo(
    () => Object.values(nodeMap).filter((n) => n.type === 'file' && !n.isDeleted).sort((a, b) => a.path.localeCompare(b.path)),
    [nodeMap],
  )

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border/60 bg-surface dark:bg-panel">
      <div className="border-b border-border/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Files</div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((f) => {
          const lang = detectLanguage(f.path)
          const active = f.id === activeTabId
          return (
            <div
              key={f.id}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${active ? 'bg-accent/15' : 'active:bg-white/5'}`}
            >
              <button onClick={() => openFile(f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className={LANG_COLORS[lang] || 'text-ink-muted'}><FiFile /></span>
                <span className={`truncate text-[12.5px] ${active ? 'text-accent' : 'text-ink'}`}>{f.path.slice(1)}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); try { navigator.vibrate?.(12) } catch {}; openContextMenu({ nodeId: f.id, x: e.clientX, y: e.clientY, clientX: e.clientX, clientY: e.clientY }) }}
                aria-label={`Options for ${f.name}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted/70 active:bg-white/10"
              >
                <FiMoreVertical size={15} />
              </button>
            </div>
          )
        })}
        {!files.length && <p className="px-3 py-4 text-[12px] text-ink-muted">No files</p>}
      </div>
    </div>
  )
}
