// Small, dependency-free Markdown → HTML renderer.
// Escapes all user text first, then applies a focused CommonMark-ish subset.
// Links/images are restricted to http(s), mailto, and root-relative paths.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function safeUrl(url: string): string | null {
  const u = url.trim()
  if (!u) return null
  if (/^\s*javascript:/i.test(u) || /^\s*data:/i.test(u) || /^\s*vbscript:/i.test(u)) return null
  if (/^(https?:|mailto:)/i.test(u) || u.startsWith('/')) return u
  return null
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^```/.test(line)) {
      const lang = escapeHtml(line.slice(3).trim())
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^#+/)![0].length
      out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`)
      i++
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push('<hr/>')
      i++
      continue
    }

    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2))
        i++
      }
      out.push(`<blockquote>${buf.map((l) => `<p>${inline(l)}</p>`).join('')}</blockquote>`)
      continue
    }

    if (/^[-*+] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (line.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1])) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      const th = header.map((c) => `<th>${inline(c)}</th>`).join('')
      const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`)
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }

  return out.join('\n')
}

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^#{1,6} /.test(line) ||
    /^\s*([-*_])\1{2,}\s*$/.test(line) ||
    line.startsWith('> ') ||
    /^[-*+] /.test(line) ||
    /^\d+\. /.test(line) ||
    line.startsWith('|')
  )
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

export function inline(raw: string): string {
  let t = escapeHtml(raw)
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const href = safeUrl(url)
    return href ? `<img src="${escapeHtml(href)}" alt="${alt}" />` : _m
  })
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const href = safeUrl(url)
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : _m
  })
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>')
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return t
}

export function isPreviewable(path: string): boolean {
  return /\.(md|markdown|html?|svg)$/i.test(path)
}

export function isHtmlPreview(path: string): boolean {
  return /\.(html?|svg)$/i.test(path)
}
