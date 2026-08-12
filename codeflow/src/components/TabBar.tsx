import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { VscClose } from 'react-icons/vsc'

export function TabBar() {
  const openTabs = useStore((s) => s.openTabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const dirtyTabs = useStore((s) => s.dirtyTabs)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)
  const showToast = useStore((s) => s.showToast)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll the active tab into view when it changes (e.g. auto-opened new file)
  useEffect(() => {
    if (!activeTabId) return
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeTabId])

  if (!openTabs.length) return null

  const handleClose = (id: string, name: string) => {
    if (dirtyTabs[id]) {
      const choice = window.confirm(`"${name}" has unsaved changes. Close anyway?`)
      if (!choice) return
    }
    closeTab(id)
    showToast(`Closed ${name}`, 'info')
  }

  return (
    <div ref={scrollRef} className="flex h-10 items-stretch gap-0.5 overflow-x-auto border-b border-border/60 bg-surface px-1 dark:bg-panel [scrollbar-width:none]" style={{ scrollbarWidth: 'none' }}>
      {openTabs.map((id) => {
        const node = nodeMap[id]
        if (!node) return null
        const active = id === activeTabId
        return (
          <div
            key={id}
            data-tab-id={id}
            onClick={() => setActiveTab(id)}
            className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-3 text-[13px] transition-colors duration-200 ${
              active
                ? 'bg-surface font-medium text-ink dark:bg-panel'
                : 'bg-transparent text-ink-muted hover:bg-white/5'
            }`}
            style={active ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
            role="tab"
            aria-selected={active}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dirtyTabs[id] ? 'animate-pulse bg-[#fb8500]' : 'bg-transparent'}`}
            />
            <span className="max-w-[110px] truncate font-medium">{node.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleClose(id, node.name) }}
              aria-label={`Close ${node.name}`}
              className={`flex h-7 w-7 items-center justify-center rounded text-ink-muted transition-opacity ${active ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
            >
              <VscClose size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
