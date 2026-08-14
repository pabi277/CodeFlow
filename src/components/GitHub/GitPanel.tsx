import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { isOAuthConfigured } from '../../services/authService'
import { AiFillGithub, AiOutlineDownload, AiOutlineLink, AiOutlineCloudUpload, AiOutlineUpload, AiOutlineKey } from 'react-icons/ai'
import { VscGitCommit, VscCloudDownload, VscGitBranch, VscRefresh, VscGitPullRequest, VscHistory } from 'react-icons/vsc'
import { FaPowerOff } from 'react-icons/fa'

const STATUS_LABEL: Record<string, string> = { modified: 'M', new: 'A', deleted: 'D' }
const STATUS_COLOR: Record<string, string> = { modified: 'text-yellow-400', new: 'text-emerald-400', deleted: 'text-red-400' }

export function GitPanel() {
  const auth = useStore((s) => s.auth)
  const connect = useStore((s) => s.connectGitHub)
  const connectWithToken = useStore((s) => s.connectWithToken)
  const disconnect = useStore((s) => s.disconnectGitHub)
  const openRepoBrowser = useStore((s) => s.openRepoBrowser)
  const openUpload = useStore((s) => s.openUpload)
  const importZipIntoCurrentProject = useStore((s) => s.importZipIntoCurrentProject)
  const openCommit = useStore((s) => s.openCommit)
  const doPull = useStore((s) => s.doPull)
  const openBranchPicker = useStore((s) => s.openBranchPicker)
  const openDiff = useStore((s) => s.openDiff)
  const gitStatus = useStore((s) => s.gitStatus)
  const pulling = useStore((s) => s.pulling)
  const openGitLog = useStore((s) => s.openGitLog)
  const openPrs = useStore((s) => s.openPrs)
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const gitConflicts = useStore((s) => s.gitConflicts)
  const openConflict = useStore((s) => s.openConflict)
  const zipRef = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const connected = !!project?.github.connected && !!auth

  if (!auth) {
    const oauthReady = isOAuthConfigured()
    const submitToken = async () => {
      if (!token.trim() || tokenBusy) return
      setTokenBusy(true)
      try {
        await connectWithToken(token)
        setToken('')
      } catch {
        // toast already shown
      } finally {
        setTokenBusy(false)
      }
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl text-ink-muted"><AiFillGithub /></div>
        <h3 className="text-base font-semibold text-ink">Connect GitHub</h3>
        <p className="text-sm text-ink-muted">Clone, commit, and push right from CodeFlow.</p>
        {oauthReady && (
          <button
            onClick={connect}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white active:opacity-90"
          >
            <AiOutlineLink /> Connect with GitHub
          </button>
        )}
        <div className="w-full max-w-sm space-y-2 text-left">
          <p className="text-center text-[12px] text-ink-muted">
            {oauthReady ? 'Or paste a personal access token' : 'Paste a GitHub personal access token to connect'}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-input px-3 py-2">
            <AiOutlineKey className="shrink-0 text-ink-muted" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitToken() }}
              placeholder="ghp_… or github_pat_…"
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted/60"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => void submitToken()}
            disabled={!token.trim() || tokenBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-[13px] font-semibold text-ink active:bg-white/5 disabled:opacity-40"
          >
            {tokenBusy ? 'Connecting…' : 'Connect with token'}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-ink-muted">
            Create a token at github.com/settings/tokens with the <span className="font-mono">repo</span> scope. It stays on this device.
          </p>
        </div>
      </div>
    )
  }

  const statusCount = gitStatus.length
  const branch = project?.github.branch || ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-ink/10 p-3 dark:border-white/10">
        <img src={auth.avatarUrl} alt="" className="h-10 w-10 rounded-full bg-white/10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{auth.displayName}</div>
          <div className="truncate text-[12px] text-ink-muted">@{auth.username}</div>
        </div>
        <button onClick={() => { if (window.confirm('Disconnect GitHub?')) disconnect() }} aria-label="Disconnect" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
          <FaPowerOff />
        </button>
      </div>

      <div className="border-b border-ink/10 p-3 dark:border-white/10">
        {connected ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">{project!.github.owner}/{project!.github.repo}</div>
              <button onClick={openBranchPicker} className="mt-0.5 flex items-center gap-1 text-[12px] text-accent">
                <VscGitBranch /> {branch || 'no branch'}
              </button>
            </div>
            <button onClick={openRepoBrowser} className="flex items-center gap-1.5 rounded-lg bg-input px-3 py-2 text-[12px] font-medium text-ink active:opacity-80">
              <AiOutlineDownload /> Clone
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <button onClick={openUpload} className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-3 text-[13px] font-semibold text-white active:opacity-90">
              <AiOutlineCloudUpload /> Upload to GitHub
            </button>
            <button onClick={openRepoBrowser} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink/20 px-3 py-3 text-[13px] font-medium text-ink-muted active:bg-white/5">
              <AiOutlineDownload /> Clone repo
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <ActionBtn icon={<VscGitCommit />} label={`Commit (${statusCount})`} onPress={openCommit} disabled={!connected || statusCount === 0} />
        <ActionBtn icon={<VscCloudDownload />} label="Pull" onPress={doPull} disabled={!connected || pulling} loading={pulling} />
        <ActionBtn icon={<VscRefresh />} label="Refresh" onPress={useStore.getState().refreshGitStatus} />
      </div>

      {connected && (
        <div className="grid grid-cols-3 gap-2 px-3 pb-1">
          <ActionBtn icon={<VscHistory />} label="History" onPress={openGitLog} />
          <ActionBtn icon={<VscGitPullRequest />} label="Pull Requests" onPress={openPrs} />
          <ActionBtn icon={<AiOutlineUpload />} label="Import ZIP" onPress={() => zipRef.current?.click()} />
        </div>
      )}
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importZipIntoCurrentProject(file)
        }}
      />

      {gitConflicts.length > 0 && (
        <div className="border-b border-ink/10 px-3 py-2 dark:border-white/10">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-400">Conflicts</p>
          {gitConflicts.map((c) => (
            <button
              key={c.fileId}
              onClick={() => openConflict(c.fileId)}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-red-300 active:bg-white/5"
            >
              <span className="w-5 text-center font-bold">!</span>
              <span className="min-w-0 flex-1 truncate">{c.path}</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Changes</p>
        {statusCount ? (
          gitStatus.map((g) => (
            <button
              key={g.id}
              onClick={() => openDiff(g.id)}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left active:bg-white/5"
            >
              <span className={`w-5 text-center text-[13px] font-bold ${STATUS_COLOR[g.status]}`}>{STATUS_LABEL[g.status]}</span>
              <span className={`min-w-0 flex-1 truncate text-[13px] ${g.status === 'deleted' ? 'text-red-400 line-through' : 'text-ink'}`}>{g.path}</span>
            </button>
          ))
        ) : (
          <p className="py-6 text-center text-[12px] text-ink-muted">
            {connected ? 'No local changes' : 'No repository connected — tap “Upload to GitHub” above'}
          </p>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onPress, disabled, loading }: {
  icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean; loading?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl bg-white/5 px-2 py-3 text-[11px] font-medium text-ink active:bg-white/10 disabled:opacity-40"
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <span className="text-lg">{icon}</span>}
      {label}
    </button>
  )
}
