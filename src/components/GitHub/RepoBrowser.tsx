import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from '../Shared/BottomSheet'
import { AiOutlineSearch, AiFillGithub, AiOutlineDownload, AiFillStar } from 'react-icons/ai'

export function RepoBrowser() {
  const open = useStore((s) => s.repoBrowserOpen)
  const close = useStore((s) => s.closeRepoBrowser)
  const repos = useStore((s) => s.repos)
  const loading = useStore((s) => s.reposLoading)
  const loadRepos = useStore((s) => s.loadRepos)
  const cloneRepo = useStore((s) => s.cloneRepo)
  const cloneProgress = useStore((s) => s.cloneProgress)
  const projects = useStore((s) => s.projects)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const filtered = query.trim()
    ? repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))
    : repos

  const clonedNames = new Set(projects.map((p) => p.github.connected ? `${p.github.owner}/${p.github.repo}` : ''))

  return (
    <BottomSheet open={open} onClose={close} title="Clone a repository" full>
      {cloneProgress ? (
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-[15px] font-medium text-ink">{cloneProgress.label}</p>
          {cloneProgress.total > 0 && (
            <p className="mt-1 text-[12px] text-ink-muted">{Math.round((cloneProgress.done / cloneProgress.total) * 100)}%</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-input px-3 py-2">
              <AiOutlineSearch className="text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your repositories…"
                className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
              />
            </div>
            <button onClick={() => loadRepos()} className="rounded-lg bg-input px-3 py-2 text-sm text-ink active:opacity-80">Refresh</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
              </div>
            ) : filtered.length ? (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => cloneRepo(r)}
                  disabled={clonedNames.has(r.full_name)}
                  className="mb-2 flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-left active:bg-white/10 disabled:opacity-40"
                >
                  <span className="shrink-0 text-2xl text-ink-muted"><AiFillGithub /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{r.full_name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                      {r.language && <span className="rounded bg-white/10 px-1.5 py-0.5">{r.language}</span>}
                      {r.private ? <span className="text-amber-400">private</span> : <span>public</span>}
                      {r.size === 0 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-emerald-300">empty</span>}
                      <span className="flex items-center gap-0.5"><AiFillStar /> {r.stargazers_count}</span>
                    </div>
                  </div>
                  {clonedNames.has(r.full_name) ? (
                    <span className="shrink-0 text-[11px] text-emerald-400">Cloned</span>
                  ) : (
                    <span className="shrink-0 text-accent"><AiOutlineDownload /></span>
                  )}
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-[13px] text-ink-muted">No repositories found</p>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
