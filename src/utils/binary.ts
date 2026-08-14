const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i
const BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif|pdf|woff2?|ttf|eot|zip|gz|7z|exe|dll|so|wasm|mp3|mp4|webm|ogg)$/i

export function isImagePath(path: string): boolean {
  return IMAGE_EXT.test(path)
}

export function isBinaryPath(path: string): boolean {
  return BINARY_EXT.test(path)
}

export function isDataUrl(content: string): boolean {
  return /^data:[^;]+;base64,/i.test(content.slice(0, 80))
}

/** Decode a base64 string into its raw bytes as a latin1 string (char code === byte value). */
export function base64ToBytes(s: string): string {
  try {
    return atob(s.replace(/\s/g, ''))
  } catch {
    return ''
  }
}

/** Encode a latin1 byte string (char code === byte value) as base64. */
export function bytesToBase64(bin: string): string {
  let out = ''
  const chunk = 0x8000
  for (let i = 0; i < bin.length; i += chunk) {
    const slice = bin.slice(i, i + chunk)
    const bytes = new Uint8Array(slice.length)
    for (let j = 0; j < slice.length; j++) bytes[j] = slice.charCodeAt(j) & 0xff
    out += btoa(String.fromCharCode(...bytes))
  }
  return out
}

/** Decode base64-encoded UTF-8 text into a JS string (emoji and all non-ASCII included). */
export function base64ToText(s: string): string {
  const bin = base64ToBytes(s)
  try {
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return bin
  }
}

/** Encode a JS string as base64-encoded UTF-8 text. Handles emoji, CJK, accents, and lone surrogates. */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** If `content` is a stored `data:<mime>;base64,<payload>` URL, return its mime and payload. */
export function dataUrlBase64(content: string): { mime: string; data: string } | null {
  const head = content.slice(0, 256)
  const m = /^data:([^,]*);base64,/i.exec(head)
  if (!m) return null
  return { mime: m[1], data: content.slice(m[0].length) }
}

export function mimeForPath(path: string): string {
  const ext = (path.split('.').pop() || '').toLowerCase()
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  }
  return map[ext] || 'application/octet-stream'
}

export function imageSrcFromContent(content: string, path: string): string | null {
  if (!content) return null
  if (isDataUrl(content)) return content
  if (content.trimStart().startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
  }
  // Treat as latin1 bytes (how we store binary imported via ZIP).
  try {
    const bytes = new Uint8Array(content.length)
    for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i) & 0xff
    const blob = new Blob([bytes], { type: mimeForPath(path) })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export async function fileToStoredContent(file: File): Promise<string> {
  if (isImagePath(file.name) || isBinaryPath(file.name)) {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return `data:${mimeForPath(file.name)};base64,${btoa(bin)}`
  }
  return file.text()
}
