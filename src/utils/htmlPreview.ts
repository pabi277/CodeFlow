// Resolve and inline project-local CSS / JS / images so HTML preview works
// inside a sandboxed srcDoc iframe (no real filesystem or HTTP server).

export type ProjectFiles = Record<string, string>

export interface HtmlPreviewResult {
  html: string
  missing: string[]
  inlined: string[]
}

const EXTERNAL = /^(https?:|data:|blob:|mailto:|javascript:|about:|\/\/)/i

export function normalizePath(path: string): string {
  const parts: string[] = []
  for (const p of path.replace(/\\/g, '/').split('/')) {
    if (!p || p === '.') continue
    if (p === '..') parts.pop()
    else parts.push(p)
  }
  return '/' + parts.join('/')
}

/** Resolve a href/src against the file that referenced it.
 *  Returns a project path, `'external'` for http(s)/data/cdn, or null. */
export function resolveHref(fromFile: string, href: string): string | 'external' | null {
  let raw = href.trim()
  if (!raw) return null
  try { raw = decodeURI(raw) } catch { /* keep raw */ }
  raw = raw.replace(/\\/g, '/').split('#')[0].split('?')[0].trim()
  if (!raw) return null
  if (EXTERNAL.test(raw)) return 'external'

  const slash = fromFile.lastIndexOf('/')
  const dir = slash <= 0 ? '/' : fromFile.slice(0, slash)
  if (raw.startsWith('/')) return normalizePath(raw)
  return normalizePath((dir === '/' ? '' : dir) + '/' + raw)
}

export function findProjectFile(files: ProjectFiles, path: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(files, path)) return files[path]
  const lower = path.toLowerCase()
  for (const [p, content] of Object.entries(files)) {
    if (p.toLowerCase() === lower) return content
  }
  return undefined
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = tag.match(re)
  if (!m) return null
  return m[1] ?? m[2] ?? m[3] ?? null
}

function hasRelStylesheet(tag: string): boolean {
  const rel = getAttr(tag, 'rel')
  return !!rel && /\bstylesheet\b/i.test(rel)
}

function stripCdata(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style')
}

function stripScriptClose(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script')
}

export function toDataUrl(path: string, content: string): string | null {
  const ext = (path.split('.').pop() || '').toLowerCase()
  const trimmed = content.trim()
  if (ext === 'svg' || trimmed.startsWith('<svg')) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(content)
  }
  if (trimmed.startsWith('data:')) return trimmed
  if (ext === 'css') return 'data:text/css;charset=utf-8,' + encodeURIComponent(content)
  if (['js', 'mjs', 'cjs', 'ts'].includes(ext)) return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'woff', 'woff2', 'ttf', 'otf'].includes(ext)) {
    // Binary assets aren't stored; only honor already-encoded data URLs.
    return null
  }
  return null
}

export function processCss(
  css: string,
  cssPath: string,
  files: ProjectFiles,
  missing: string[],
  inlined: string[],
  seen = new Set<string>(),
): string {
  let out = css.replace(
    /@import\s+(?:url\(\s*)?(?:'([^']+)'|"([^"]+)"|([^'")\s;]+))\s*\)?\s*;/g,
    (full, a, b, c) => {
      const href = a || b || c
      const resolved = resolveHref(cssPath, href)
      if (resolved === 'external' || resolved === null) return full
      if (seen.has(resolved)) return `/* circular @import ${resolved} */`
      const content = findProjectFile(files, resolved)
      if (content == null) {
        missing.push(resolved)
        return `/* missing @import ${resolved} */`
      }
      seen.add(resolved)
      inlined.push(resolved)
      return processCss(content, resolved, files, missing, inlined, seen)
    },
  )

  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (full, _q, href: string) => {
    if (EXTERNAL.test(href.trim())) return full
    const resolved = resolveHref(cssPath, href)
    if (resolved === 'external' || resolved === null) return full
    const content = findProjectFile(files, resolved)
    if (content == null) {
      missing.push(resolved)
      return full
    }
    const data = toDataUrl(resolved, content)
    return data ? `url("${data}")` : full
  })

  return out
}

const IMPORT_SPEC = /(?:import|export)(?:\s+type)?\s*(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

export function rewriteJsImports(
  code: string,
  filePath: string,
  files: ProjectFiles,
  missing: string[],
  inlined: string[],
  seen = new Set<string>(),
): string {
  return code.replace(IMPORT_SPEC, (full, spec1, spec2) => {
    const spec = spec1 || spec2
    if (!spec) return full
    const resolved = resolveHref(filePath, spec)
    if (resolved === 'external' || resolved === null) return full
    if (seen.has(resolved)) {
      return full.replace(spec, 'data:text/javascript;charset=utf-8,')
    }
    const content = findProjectFile(files, resolved)
    if (content == null) {
      missing.push(resolved)
      return full
    }
    seen.add(resolved)
    inlined.push(resolved)
    const nextSeen = new Set(seen)
    const rewritten = rewriteJsImports(content, resolved, files, missing, inlined, nextSeen)
    const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(rewritten)
    return full.replace(spec, url)
  })
}

function unique(list: string[]): string[] {
  return [...new Set(list)]
}

export function buildHtmlPreview(html: string, htmlPath: string, files: ProjectFiles): HtmlPreviewResult {
  const missing: string[] = []
  const inlined: string[] = []
  const allFiles: ProjectFiles = { ...files, [htmlPath]: html }

  let out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!hasRelStylesheet(tag)) return tag
    const href = getAttr(tag, 'href')
    if (!href) return tag
    const resolved = resolveHref(htmlPath, href)
    if (resolved === 'external' || resolved === null) return tag
    const content = findProjectFile(allFiles, resolved)
    if (content == null) {
      missing.push(resolved)
      return `<!-- CodeFlow: missing stylesheet ${resolved} -->`
    }
    inlined.push(resolved)
    const css = processCss(content, resolved, allFiles, missing, inlined, new Set([resolved]))
    return `<style data-codeflow-from="${resolved}">${stripCdata(css)}</style>`
  })

  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs: string, body: string) => {
    const src = getAttr(`<script${attrs}>`, 'src')
    if (!src) {
      const type = getAttr(`<script${attrs}>`, 'type') || ''
      if (/module/i.test(type)) {
        return `<script${attrs}>${stripScriptClose(rewriteJsImports(body, htmlPath, allFiles, missing, inlined, new Set([htmlPath])))}</script>`
      }
      return full
    }
    const resolved = resolveHref(htmlPath, src)
    if (resolved === 'external' || resolved === null) return full
    const content = findProjectFile(allFiles, resolved)
    if (content == null) {
      missing.push(resolved)
      return `<!-- CodeFlow: missing script ${resolved} -->`
    }
    inlined.push(resolved)
    const type = getAttr(`<script${attrs}>`, 'type') || ''
    const cleanedAttrs = attrs.replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
    let code = content
    if (/module/i.test(type)) {
      code = rewriteJsImports(content, resolved, allFiles, missing, inlined, new Set([resolved]))
    }
    return `<script${cleanedAttrs} data-codeflow-from="${resolved}">${stripScriptClose(code)}</script>`
  })

  out = out.replace(/<(img|source|video|audio|use)\b[^>]*>/gi, (tag) => {
    const src = getAttr(tag, 'src') || getAttr(tag, 'href') || getAttr(tag, 'xlink:href')
    if (!src) return tag
    const resolved = resolveHref(htmlPath, src)
    if (resolved === 'external' || resolved === null) return tag
    const content = findProjectFile(allFiles, resolved)
    if (content == null) {
      missing.push(resolved)
      return tag
    }
    const data = toDataUrl(resolved, content)
    if (!data) return tag
    inlined.push(resolved)
    return tag
      .replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ` src="${data}"`)
      .replace(/\shref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ` href="${data}"`)
  })

  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_full, attrs: string, body: string) => {
    const css = processCss(body, htmlPath, allFiles, missing, inlined, new Set([htmlPath]))
    return `<style${attrs}>${stripCdata(css)}</style>`
  })

  return { html: out, missing: unique(missing), inlined: unique(inlined) }
}

export function filesFromNodeMap(nodeMap: Record<string, { type: string; path: string; content: string; isDeleted?: boolean }>): ProjectFiles {
  const files: ProjectFiles = {}
  for (const n of Object.values(nodeMap)) {
    if (n.type === 'file' && !n.isDeleted) files[n.path] = n.content
  }
  return files
}
