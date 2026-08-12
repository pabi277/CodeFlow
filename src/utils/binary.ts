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
