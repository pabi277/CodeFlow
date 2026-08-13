import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { computeUnifiedDiff } from '../../utils/diff'
import { FiChevronLeft, FiRotateCcw } from 'react-icons/fi'

export function DiffViewer() {
  const diffFileId = useStore((s) => s.diffFileId)
  const close = useStore((s) => s.closeDiff)
  const nodeMap = useStore((s) => s.nodeMap)
  const discard = useStore((s) => s.discardFileChanges)
  const [side, setSide] = useState(true)

  const node = diffFileId ? nodeMap[diffFileId] : undefined

  const diff = useMemo(() => {
    if (!node) return []
    return computeUnifiedDiff(node.originalContent, node.content)
  }, [node])

  if (!node) return null

  const oldLines = (node.originalContent || '').split('\n')
  const newLines = (node.content || '').split('\n')

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Diff view">
      <div className="flex items-center gap-1 border-b border-ink/10 px-2 py-2 dark:border-white/10">
        <button onClick={close} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{node.name}</div>
          <div className="truncate text-[11px] text-ink-muted">{node.path}</div>
        </div>
        <button
          onClick={() => setSide((v) => !v)}
          className="rounded-lg bg-input px-3 py-2 text-[12px] font-medium text-ink"
        >
          {side ? 'Unified' : 'Side by side'}
        </button>
        {!node.isNew && !node.isDeleted && (
          <button
            onClick={() => { if (window.confirm('Discard all local changes to this file?')) discard(node.id) }}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] font-medium text-red-400 active:opacity-80"
          >
            <FiRotateCcw /> Revert
          </button>
        )}
      </div>

      {side ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden font-mono text-[12px]">
          <div className="overflow-auto border-r border-border/40 p-2">
            <div className="mb-2 text-[11px] font-semibold text-ink-muted">Incoming / last sync</div>
            {oldLines.map((l, i) => (
              <div key={i} className="flex whitespace-pre-wrap break-all text-ink-muted">
                <span className="mr-2 w-8 shrink-0 select-none text-right text-[10px] opacity-50">{i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="overflow-auto p-2">
            <div className="mb-2 text-[11px] font-semibold text-ink-muted">Local</div>
            {newLines.map((l, i) => (
              <div key={i} className="flex whitespace-pre-wrap break-all text-ink">
                <span className="mr-2 w-8 shrink-0 select-none text-right text-[10px] opacity-50">{i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-2 font-mono text-[12px] leading-relaxed">
          <div className="mb-2 flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="text-emerald-400">+ added</span>
            <span className="text-red-400">− removed</span>
            <span className="text-ink-muted">· {diff.filter((l) => l.type === 'add').length} added, {diff.filter((l) => l.type === 'del').length} removed</span>
          </div>
          {diff.map((l, i) => {
            const rowNo = l.oldNo ?? l.newNo
            return (
              <div
                key={i}
                className={`flex whitespace-pre-wrap break-all px-2 ${
                  l.type === 'add' ? 'bg-emerald-500/15 text-emerald-300'
                  : l.type === 'del' ? 'bg-red-500/15 text-red-300'
                  : 'text-ink-muted'
                }`}
              >
                <span className="mr-3 w-8 shrink-0 select-none text-right text-[10px] opacity-50">
                  {rowNo && rowNo > 0 ? rowNo : ''}
                </span>
                <span className="mr-2 w-4 shrink-0 select-none">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                <span>{l.text}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
