import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { FileIcon } from '../utils/getFileIcon'
import { VscClose, VscChevronLeft, VscChevronRight, VscPinned } from 'react-icons/vsc'

export function TabBar() {
  const openTabs = useStore((s) => s.openTabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const dirtyTabs = useStore((s) => s.dirtyTabs)
  const pinnedTabs = useStore((s) => s.pinnedTabs)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)
  const showToast = useStore((s) => s.showToast)
  const togglePinTab = useStore((s) => s.togglePinTab)
  const closeOtherTabs = useStore((s) => s.closeOtherTabs)
  const closeTabsToTheRight = useStore((s) => s.closeTabsToTheRight)
  const closeSavedTabs = useStore((s) => s.closeSavedTabs)
  const revealInExplorer = useStore((s) => s.revealInExplorer)
  const reorderTabs = useStore((s) => s.reorderTabs)
  const zenMode = useStore((s) => s.zenMode)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    if (!activeTabId) return
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    updateScroll()
  }, [activeTabId, openTabs.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
      updateScroll()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', updateScroll, { passive: true })
    updateScroll()
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', updateScroll)
    }
  }, [openTabs.length])

  if (!openTabs.length || zenMode) return null

  const handleClose = (id: string, name: string) => {
    if (dirtyTabs[id]) {
      const choice = window.confirm(`"${name}" has unsaved changes. Close anyway?`)
      if (!choice) return
    }
    void closeTab(id)
    showToast(`Closed ${name}`, 'info')
  }

  const menuNode = menuId ? nodeMap[menuId] : undefined

  return (
    <div className="bar-glass relative flex h-10 items-stretch border-b border-border/60">
      {canLeft && (
        <button
          onClick={() => { scrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' }) }}
          aria-label="Scroll tabs left"
          className="flex w-7 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
        >
          <VscChevronLeft />
        </button>
      )}
      <div ref={scrollRef} className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]" style={{ scrollbarWidth: 'none' }}>
        {openTabs.map((id) => {
          const node = nodeMap[id]
          if (!node) return null
          const active = id === activeTabId
          const pinned = pinnedTabs.includes(id)
          return (
            <div
              key={id}
              data-tab-id={id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/tab-id', id); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => {
                e.preventDefault()
                const from = e.dataTransfer.getData('text/tab-id')
                if (from) reorderTabs(from, id)
              }}
              onClick={() => setActiveTab(id)}
              onContextMenu={(e) => { e.preventDefault(); setMenuId(id) }}
              className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-2.5 text-[13px] transition-all duration-200 ${
                active
                  ? 'bg-surface font-medium text-ink dark:bg-white/10'
                  : 'bg-transparent text-ink-muted hover:bg-white/5 hover:text-ink'
              }`}
              style={active
                ? { boxShadow: 'inset 0 -2px 0 var(--accent), 0 6px 14px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }
                : undefined}
              role="tab"
              aria-selected={active}
            >
              <span className={`h-1.5 w-1.5 rounded-full transition-all ${dirtyTabs[id] ? 'animate-pulse bg-[#fb8500] shadow-[0_0_6px_#fb8500]' : 'bg-transparent'}`} />
              <FileIcon name={node.name} type="file" size={14} />
              <span className="max-w-[110px] truncate font-medium">{node.name}</span>
              {pinned ? (
                <VscPinned size={12} className="text-accent" />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleClose(id, node.name) }}
                  aria-label={`Close ${node.name}`}
                  className={`flex h-7 w-7 items-center justify-center rounded text-ink-muted transition-opacity ${active ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                >
                  <VscClose size={15} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {canRight && (
        <button
          onClick={() => { scrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' }) }}
          aria-label="Scroll tabs right"
          className="flex w-7 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
        >
          <VscChevronRight />
        </button>
      )}

      {menuNode && menuId && (
        <div className="fixed inset-0 z-[40]" onClick={() => setMenuId(null)}>
          <div className="glass animate-pop absolute left-1/2 top-12 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-border/60 py-1 shadow-modal">
            <MenuRow label={pinnedTabs.includes(menuId) ? 'Unpin' : 'Pin'} onClick={() => { togglePinTab(menuId); setMenuId(null) }} />
            <MenuRow label="Close" onClick={() => { handleClose(menuId, menuNode.name); setMenuId(null) }} />
            <MenuRow label="Close others" onClick={() => { void closeOtherTabs(menuId); setMenuId(null) }} />
            <MenuRow label="Close to the right" onClick={() => { void closeTabsToTheRight(menuId); setMenuId(null) }} />
            <MenuRow label="Close saved" onClick={() => { void closeSavedTabs(); setMenuId(null) }} />
            <MenuRow label="Reveal in explorer" onClick={() => { revealInExplorer(menuId); setMenuId(null) }} />
            <MenuRow
              label="Copy path"
              onClick={() => {
                try { navigator.clipboard?.writeText(menuNode.path) } catch {}
                showToast('Path copied', 'success')
                setMenuId(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full px-3 py-2 text-left text-[13px] text-ink active:bg-white/5">
      {label}
    </button>
  )
}
