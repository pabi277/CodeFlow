import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { VscChevronRight } from 'react-icons/vsc'

export function Breadcrumbs() {
  const enabled = useStore((s) => s.settings.showBreadcrumbs)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const projects = useStore((s) => s.projects)
  const activeProjectId = useStore((s) => s.activeProjectId)
  const revealInExplorer = useStore((s) => s.revealInExplorer)
  const openFile = useStore((s) => s.openFile)

  const crumbs = useMemo(() => {
    const file = activeTabId ? nodeMap[activeTabId] : undefined
    if (!file) return []
    const chain: { id: string; name: string; type: 'file' | 'folder' }[] = []
    let current: typeof file | undefined = file
    while (current) {
      const name = current.path === '/' ? (projects.find((p) => p.id === activeProjectId)?.name || current.name) : current.name
      chain.unshift({ id: current.id, name, type: current.type })
      current = current.parentId ? nodeMap[current.parentId] : undefined
    }
    return chain
  }, [activeTabId, nodeMap, projects, activeProjectId])

  if (!enabled || !crumbs.length) return null

  return (
    <nav aria-label="Breadcrumb" className="flex h-7 items-center gap-0.5 overflow-x-auto border-b border-border/40 bg-surface/80 px-2 text-[11px] dark:bg-panel [scrollbar-width:none]">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={c.id} className="flex shrink-0 items-center gap-0.5">
            {i > 0 && <VscChevronRight className="text-ink-muted/70" size={12} />}
            <button
              onClick={() => (c.type === 'folder' ? revealInExplorer(c.id) : openFile(c.id))}
              className={`max-w-[140px] truncate rounded px-1 py-0.5 ${last ? 'font-medium text-ink' : 'text-ink-muted active:bg-white/5'}`}
              aria-current={last ? 'page' : undefined}
            >
              {c.name}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
