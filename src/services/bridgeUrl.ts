// Shared Termux origin so execution + preview stay in sync.

const DEFAULT_ORIGIN = 'http://127.0.0.1:8080'

let origin = DEFAULT_ORIGIN

export function normalizeBridgeOrigin(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '')
  if (!trimmed) return DEFAULT_ORIGIN
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return DEFAULT_ORIGIN
    return `${u.protocol}//${u.host}`
  } catch {
    return DEFAULT_ORIGIN
  }
}

export function setBridgeOrigin(url: string) {
  origin = normalizeBridgeOrigin(url)
}

export function getBridgeOrigin(): string {
  return origin
}

export function defaultBridgeOrigin(): string {
  return DEFAULT_ORIGIN
}
