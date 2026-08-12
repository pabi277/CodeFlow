// Tiny .editorconfig reader — indent + line endings only.

export interface EditorConfigProps {
  indentWithSpaces?: boolean
  tabSize?: number
  endOfLine?: 'lf' | 'crlf' | 'cr'
}

interface Section {
  glob: string
  props: Record<string, string>
}

export function parseEditorConfig(text: string): Section[] {
  const sections: Section[] = []
  let current: Section = { glob: '*', props: {} }
  sections.push(current)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[#;].*$/, '').trim()
    if (!line) continue
    const header = line.match(/^\[(.+)]$/)
    if (header) {
      current = { glob: header[1].trim(), props: {} }
      sections.push(current)
      continue
    }
    const kv = line.match(/^([^=]+?)\s*=\s*(.*)$/)
    if (kv) current.props[kv[1].trim().toLowerCase()] = kv[2].trim().toLowerCase()
  }
  return sections
}

export function matchEditorConfig(path: string, sections: Section[]): EditorConfigProps {
  const name = path.replace(/^.*\//, '')
  const rel = path.replace(/^\//, '')
  const out: EditorConfigProps = {}
  for (const s of sections) {
    if (!globMatch(s.glob, name) && !globMatch(s.glob, rel)) continue
    const style = s.props.indent_style
    if (style === 'space') out.indentWithSpaces = true
    if (style === 'tab') out.indentWithSpaces = false
    const size = Number(s.props.indent_size || s.props.tab_width)
    if (size === 2 || size === 4 || size === 8) out.tabSize = size
    const eol = s.props.end_of_line
    if (eol === 'lf' || eol === 'crlf' || eol === 'cr') out.endOfLine = eol
  }
  return out
}

function globMatch(glob: string, name: string): boolean {
  if (glob === '*' || glob === '**') return true
  const re = new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DS::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DS::/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    'i',
  )
  return re.test(name)
}

export function editorConfigForProject(
  files: { path: string; content: string; type: string }[],
  filePath: string,
): EditorConfigProps {
  const cfg = files.find((f) => f.type === 'file' && /(^|\/)\.editorconfig$/i.test(f.path))
  if (!cfg) return {}
  return matchEditorConfig(filePath, parseEditorConfig(cfg.content))
}
