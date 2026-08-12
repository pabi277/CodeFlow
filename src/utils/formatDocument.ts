// Document formatter. JSON is pretty-printed locally; JS/TS/HTML/CSS/Markdown
// go through Prettier (lazy-loaded). Everything else gets trailing-whitespace
// stripped and a single trailing newline.

export type FormatResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

const PRETTIER_PARSERS: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'css',
  markdown: 'markdown',
  json: 'json',
}

function tidyWhitespace(content: string): string {
  const lines = content.split('\n').map((l) => l.replace(/[ \t]+$/g, ''))
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const text = lines.join('\n')
  return text.endsWith('\n') || text === '' ? text : text + '\n'
}

export async function formatDocument(content: string, language: string, tabSize = 2): Promise<FormatResult> {
  if (language === 'json') {
    const trimmed = content.trim()
    if (!trimmed) return { ok: true, text: content }
    try {
      const parsed = JSON.parse(content)
      return { ok: true, text: JSON.stringify(parsed, null, tabSize) + '\n' }
    } catch (err) {
      return { ok: false, error: (err as Error).message || 'Invalid JSON' }
    }
  }

  const parser = PRETTIER_PARSERS[language]
  if (parser) {
    try {
      const prettier = await import('prettier/standalone')
      const plugins = await loadPrettierPlugins(parser)
      const text = await prettier.format(content, {
        parser,
        plugins,
        tabWidth: tabSize,
        useTabs: false,
      })
      return { ok: true, text }
    } catch (err) {
      const msg = (err as Error).message || 'Prettier failed'
      if (/SyntaxError|Unexpected|Parse/i.test(msg)) return { ok: false, error: msg }
      return { ok: true, text: tidyWhitespace(content) }
    }
  }

  return { ok: true, text: tidyWhitespace(content) }
}

async function loadPrettierPlugins(parser: string): Promise<object[]> {
  if (parser === 'babel' || parser === 'json') {
    const [babel, estree] = await Promise.all([
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ])
    return [babel, estree]
  }
  if (parser === 'typescript') {
    const [typescript, estree] = await Promise.all([
      import('prettier/plugins/typescript'),
      import('prettier/plugins/estree'),
    ])
    return [typescript, estree]
  }
  if (parser === 'html') {
    const html = await import('prettier/plugins/html')
    return [html]
  }
  if (parser === 'css' || parser === 'scss') {
    const postcss = await import('prettier/plugins/postcss')
    return [postcss]
  }
  if (parser === 'markdown') {
    const markdown = await import('prettier/plugins/markdown')
    return [markdown]
  }
  return []
}
