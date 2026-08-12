export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = 'B'
  for (const u of units) {
    value /= 1024
    unit = u
    if (value < 1024) break
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`
}

export function formatTimeMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.max(0, Math.round(ms))}ms`
}

export function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : ''
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
