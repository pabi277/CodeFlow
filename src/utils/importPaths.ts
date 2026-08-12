// Completions for relative import / from paths.

export interface ImportFile {
  path: string
  name: string
}

export interface ImportMatch {
  from: number
  prefix: string
  quote: string | null
  style: 'js' | 'python'
}

/** Look at the text before the cursor on the current line. */
export function matchImportContext(linePrefix: string): ImportMatch | null {
  const js = linePrefix.match(/(?:from|import)\s*(['"])(\.[^'"]*)$/)
  if (js) {
    return { from: linePrefix.length - js[2].length, prefix: js[2], quote: js[1], style: 'js' }
  }
  const pyRel = linePrefix.match(/(?:from|import)\s+(\.[\w./]*)$/)
  if (pyRel) {
    return { from: linePrefix.length - pyRel[1].length, prefix: pyRel[1], quote: null, style: 'python' }
  }
  const pyAbs = linePrefix.match(/(?:from|import)\s+([A-Za-z_][\w.]*)$/)
  if (pyAbs) {
    return { from: linePrefix.length - pyAbs[1].length, prefix: pyAbs[1], quote: null, style: 'python' }
  }
  return null
}

export function suggestImportPaths(
  currentPath: string,
  prefix: string,
  files: ImportFile[],
  style: 'js' | 'python',
): string[] {
  const dir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) || '/' : '/'
  const out: string[] = []
  const seen = new Set<string>()

  for (const f of files) {
    if (f.path === currentPath) continue
    const rel = relativeImport(dir, f.path, style)
    if (!rel) continue
    if (prefix && !rel.startsWith(prefix) && !rel.replace(/^\.\//, '').startsWith(prefix.replace(/^\.\//, ''))) {
      // also allow matching the basename
      if (!f.name.toLowerCase().startsWith(prefix.replace(/^\.\//, '').toLowerCase())) continue
    }
    if (seen.has(rel)) continue
    seen.add(rel)
    out.push(rel)
    if (out.length >= 30) break
  }
  return out.sort((a, b) => a.length - b.length || a.localeCompare(b))
}

function relativeImport(fromDir: string, targetPath: string, style: 'js' | 'python'): string {
  const fromParts = fromDir.split('/').filter(Boolean)
  const toParts = targetPath.replace(/^\//, '').split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i++
  const up = fromParts.length - i
  const down = toParts.slice(i)
  let spec: string
  if (up === 0) spec = './' + down.join('/')
  else spec = '../'.repeat(up) + down.join('/')

  if (style === 'js') {
    return spec.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, '')
  }
  // Python: drop .py and turn remaining slashes into dots for abs-looking specs
  const noExt = spec.replace(/\.py$/i, '')
  if (noExt.startsWith('.')) return noExt.replace(/\/+/g, '/')
  return noExt.replace(/^\.\//, '').replace(/\//g, '.')
}
