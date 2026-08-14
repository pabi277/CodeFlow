import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from '../Shared/BottomSheet'
import { AiOutlineCloudUpload, AiOutlineSearch, AiFillGithub, AiOutlineCheck } from 'react-icons/ai'

const REPO_NAME_RE = /^[a-zA-Z0-9._-]+$/

/**
 * Push ALL files of the current local project to GitHub in one tap.
 * Either creates a brand-new repo or fills an existing empty one.
 */
export function UploadModal() {
  const open = useStore((s) => s.uploadOpen)
  const close = useStore((s) => s.closeUpload)
  const uploading = useStore((s) => s.uploading)
  const cloneProgress = useStore((s) => s.cloneProgress)
  const uploadToGitHub = useStore((s) => s.uploadToGitHub)
  const repos = useStore((s) => s.repos)
  const loadRepos = useStore((s) => s.loadRepos)
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [message, setMessage] = useState('Initial commit')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(project?.name || '')
      setDescription('')
      setIsPrivate(false)
      setMessage('Initial commit')
      setQuery('')
      setSelected(null)
      void loadRepos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const emptyRepos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return repos
      .filter((r) => (r.size ?? 1) === 0)
      .filter((r) => !q || r.full_name.toLowerCase().includes(q))
  }, [repos, query])

  const nameValid =
    mode === 'existing' ||
    (name.trim().length > 0 &&
      REPO_NAME_RE.test(name.trim()) &&
      !name.trim().endsWith('.git') &&
      !name.trim().includes('..'))
  const canSubmit = !uploading && nameValid && (mode === 'new' || !!selected)

  const submit = () => {
    const msg = message.trim() || 'Initial commit'
    if (mode === 'new') {
      void uploadToGitHub({
        repoName: name.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        message: msg,
      })
    } else if (selected) {
      const repo = repos.find((r) => r.full_name === selected)
      if (repo) {
        void uploadToGitHub({
          owner: repo.full_name.split('/')[0],
          repo: repo.name,
          message: msg,
        })
      }
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="Upload to GitHub" full>
      {uploading ? (
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-[15px] font-medium text-ink">{cloneProgress?.label || 'Uploading…'}</p>
          {cloneProgress && cloneProgress.total > 0 && (
            <p className="mt-1 text-[12px] text-ink-muted">{Math.round((cloneProgress.done / cloneProgress.total) * 100)}%</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4 pb-8">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Push every file in this project to GitHub in one go — no staging, no fuss.
          </p>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setMode('new')}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${mode === 'new' ? 'bg-accent text-white' : 'text-ink'}`}
            >
              Create new repo
            </button>
            <button
              onClick={() => setMode('existing')}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${mode === 'existing' ? 'bg-accent text-white' : 'text-ink'}`}
            >
              Use empty repo
            </button>
          </div>

          {mode === 'new' ? (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Repository name (required)"
                className="w-full rounded-xl border border-ink/15 bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-xl border border-ink/15 bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              />
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
                <button
                  onClick={() => setIsPrivate(false)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium ${!isPrivate ? 'bg-accent text-white' : 'text-ink'}`}
                >
                  <AiOutlineCheck className={!isPrivate ? '' : 'invisible'} /> Public
                </button>
                <button
                  onClick={() => setIsPrivate(true)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium ${isPrivate ? 'bg-accent text-white' : 'text-ink'}`}
                >
                  <AiOutlineCheck className={isPrivate ? '' : 'invisible'} /> Private
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-input px-3 py-2">
                <AiOutlineSearch className="text-ink-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search empty repositories…"
                  className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {emptyRepos.length ? (
                  emptyRepos.map((r) => (
                    <button
                      key={r.full_name}
                      onClick={() => setSelected(selected === r.full_name ? null : r.full_name)}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${selected === r.full_name ? 'bg-accent/15 ring-1 ring-accent' : 'bg-white/5 active:bg-white/10'}`}
                    >
                      <span className="shrink-0 text-2xl text-ink-muted"><AiFillGithub /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-ink">{r.full_name}</div>
                        <div className="text-[11px] text-ink-muted">{r.private ? 'private' : 'public'} · empty</div>
                      </div>
                      {selected === r.full_name && <AiOutlineCheck className="shrink-0 text-accent" />}
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-center text-[13px] text-ink-muted">
                    {repos.length ? 'No empty repositories found — try “Create new repo”.' : 'Loading your repositories…'}
                  </p>
                )}
              </div>
            </>
          )}

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message (default: Initial commit)"
            className="w-full rounded-xl border border-ink/15 bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
          />

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white active:opacity-90 disabled:opacity-40"
          >
            {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <AiOutlineCloudUpload />}
            Upload to GitHub
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
