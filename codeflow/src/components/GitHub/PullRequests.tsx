import { useStore } from '../../store/useStore'
import { FiChevronLeft, FiX, FiExternalLink } from 'react-icons/fi'
import { relativeTime } from '../../utils/format'

export function PullRequests() {
  const open = useStore((s) => s.prsOpen)
  const close = useStore((s) => s.closePrs)
  const prs = useStore((s) => s.prs)

  if (!open) return null

  const openExternal = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-[50] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Pull requests">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={() => close()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">Pull Requests</h1>
        <button onClick={() => close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/5 dark:active:bg-white/5">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {prs.length ? (
          prs.map((pr) => (
            <div key={pr.number} className="mb-2 rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase ${pr.state === 'open' ? 'text-emerald-400' : 'text-ink-muted'}`}>{pr.state}</span>
                <span className="text-[11px] text-ink-muted">#{pr.number}</span>
              </div>
              <div className="mt-1 text-[14px] font-medium leading-snug text-ink">{pr.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted">
                <img src={pr.user.avatar_url} alt="" className="h-5 w-5 rounded-full bg-white/10" />
                <span>@{pr.user.login}</span>
                <span>· {relativeTime(new Date(pr.created_at).getTime())}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="truncate rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-ink-muted">{pr.head.label}</span>
                <button
                  onClick={() => openExternal(pr.html_url)}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white active:opacity-90"
                >
                  <FiExternalLink /> View
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[13px] text-ink-muted">No open pull requests.</p>
        )}
      </div>
    </div>
  )
}
