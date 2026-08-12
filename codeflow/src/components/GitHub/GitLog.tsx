import { useStore } from '../../store/useStore'
import { FiChevronLeft, FiX, FiGitCommit } from 'react-icons/fi'
import { relativeTime } from '../../utils/format'

export function GitLog() {
  const open = useStore((s) => s.gitLogOpen)
  const close = useStore((s) => s.closeGitLog)
  const commits = useStore((s) => s.gitLog)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[50] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Git history">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={() => close()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">Git History</h1>
        <button onClick={() => close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/5 dark:active:bg-white/5">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {commits.length ? (
          commits.map((c) => (
            <div key={c.sha} className="mb-2 flex gap-3 rounded-xl bg-white/5 p-3">
              <span className="mt-0.5 text-accent"><FiGitCommit /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium leading-snug text-ink">{c.commit.message.split('\n')[0]}</div>
                <div className="mt-1 text-[12px] text-ink-muted">
                  {c.commit.author.name} · {relativeTime(new Date(c.commit.author.date).getTime())}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-muted/70">{c.sha.slice(0, 7)}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[13px] text-ink-muted">
            No commit history available for this project.
          </p>
        )}
      </div>
    </div>
  )
}
