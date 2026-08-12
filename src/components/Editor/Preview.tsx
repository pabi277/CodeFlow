import { useEffect, useMemo, useState } from 'react'
import { isHtmlPreview, isPreviewable, renderMarkdown } from '../../utils/markdown'
import { buildHtmlPreview, filesFromNodeMap } from '../../utils/htmlPreview'
import { previewUrlFor, syncTermuxWorkspace, termuxSupportsPreview } from '../../services/termuxPreview'
import { useStore } from '../../store/useStore'
import { AiOutlineReload, AiOutlineExport, AiOutlineClose } from 'react-icons/ai'
import { VscBroadcast } from 'react-icons/vsc'

interface Props {
  content: string
  path: string
  variant?: 'panel' | 'overlay'
  onClose?: () => void
}

export function Preview({ content, path, variant = 'panel', onClose }: Props) {
  const nodeMap = useStore((s) => s.nodeMap)
  const termuxAvailable = useStore((s) => s.termuxAvailable)
  const refreshTermuxStatus = useStore((s) => s.refreshTermuxStatus)
  const showToast = useStore((s) => s.showToast)
  const files = useMemo(() => {
    const map = filesFromNodeMap(nodeMap)
    map[path] = content
    return map
  }, [nodeMap, path, content])

  const bundled = useMemo(() => {
    if (!isHtmlPreview(path)) return null
    return buildHtmlPreview(content, path, files)
  }, [content, path, files])

  const markdown = useMemo(() => (isHtmlPreview(path) ? '' : renderMarkdown(content)), [content, path])

  const [live, setLive] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    void refreshTermuxStatus()
  }, [refreshTermuxStatus])

  useEffect(() => {
    if (!isHtmlPreview(path)) return
    let cancelled = false
    const run = async () => {
      const ok = termuxAvailable && await termuxSupportsPreview()
      if (!ok) {
        if (!cancelled) setLive(false)
        return
      }
      setSyncing(true)
      const synced = await syncTermuxWorkspace(files)
      if (!cancelled) {
        setLive(synced)
        setSyncing(false)
        if (synced) setTick((n) => n + 1)
      }
    }
    const t = setTimeout(() => { void run() }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [files, path, termuxAvailable])

  const openInNewTab = () => {
    if (live) {
      window.open(previewUrlFor(path), '_blank', 'noopener')
      return
    }
    if (!bundled) {
      showToast('Nothing to preview', 'info')
      return
    }
    const blob = new Blob([bundled.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
  }

  const refresh = async () => {
    if (termuxAvailable && await termuxSupportsPreview()) {
      setSyncing(true)
      const synced = await syncTermuxWorkspace(files)
      setLive(synced)
      setSyncing(false)
      if (synced) setTick((n) => n + 1)
      else showToast('Could not sync to Termux — using bundled preview', 'info')
    } else {
      setLive(false)
      setTick((n) => n + 1)
    }
  }

  const html = isHtmlPreview(path)
  const chrome = html || variant === 'overlay'

  return (
    <div className={`flex h-full min-h-0 flex-col bg-white dark:bg-panel ${variant === 'overlay' ? 'fixed inset-0 z-[52]' : ''}`}>
      {chrome && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border/60 bg-surface px-2 dark:bg-panel">
          <span className="min-w-0 flex-1 truncate px-1 text-[12px] font-medium text-ink">{path.slice(1) || path}</span>
          {html && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-ink-muted'}`}>
              {syncing ? 'Syncing…' : live ? <span className="inline-flex items-center gap-1"><VscBroadcast /> Termux server</span> : 'Bundled'}
            </span>
          )}
          <button onClick={() => void refresh()} aria-label="Refresh preview" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
            <AiOutlineReload />
          </button>
          {html && (
            <button onClick={openInNewTab} aria-label="Open in new tab" className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-ink-muted active:bg-white/10">
              <AiOutlineExport /> <span className="hidden sm:inline">New tab</span>
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close viewer" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
              <AiOutlineClose />
            </button>
          )}
        </div>
      )}

      {html && bundled ? (
        <>
          {!live && bundled.missing.length > 0 && (
            <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
              Missing {bundled.missing.length === 1 ? 'file' : 'files'}: {bundled.missing.join(', ')}
            </div>
          )}
          {live ? (
            <iframe
              key={`live-${tick}-${path}`}
              title="HTML live preview"
              src={`${previewUrlFor(path)}?t=${tick}`}
              className="min-h-0 w-full flex-1 border-0 bg-white"
            />
          ) : (
            <iframe
              key={`bundled-${tick}`}
              title="HTML preview"
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={bundled.html}
              className="min-h-0 w-full flex-1 border-0 bg-white"
            />
          )}
        </>
      ) : isPreviewable(path) ? (
        <div className="h-full overflow-y-auto px-4 py-3">
          {content.trim() ? (
            <article className="md-preview" dangerouslySetInnerHTML={{ __html: markdown }} />
          ) : (
            <p className="py-10 text-center text-[13px] text-ink-muted">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <p className="py-10 text-center text-[13px] text-ink-muted">This file type has no preview.</p>
      )}
    </div>
  )
}
