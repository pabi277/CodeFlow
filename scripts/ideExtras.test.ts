/* Tests for indent detection, ANSI, problem matchers, symbols, imports, themes.
 * Run with: npx tsx scripts/ideExtras.test.ts
 */
import { detectIndent } from '../src/utils/detectIndent'
import { parseAnsi, stripAnsi } from '../src/utils/ansi'
import { matchProblems, extractTerminalLinks } from '../src/utils/problemMatchers'
import { wordAt, findDefinitions, findReferences, renameInText, filterSymbols } from '../src/utils/symbolNav'
import { matchImportContext, suggestImportPaths } from '../src/utils/importPaths'
import { parseThemeText } from '../src/utils/themeImport'
import { indentPasted } from '../src/editor/pasteIndent'
import { detectLineEnding, convertLineEnding } from '../src/utils/lineEnding'
import { parseEditorConfig, matchEditorConfig } from '../src/utils/editorConfig'
import { toCmSnippet } from '../src/utils/snippets'
import { normalizeBridgeOrigin } from '../src/services/bridgeUrl'
import { runLocalJavaScript } from '../src/services/mockRunner'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function main() {
  console.log('\n[detectIndent]')
  const two = detectIndent('function x() {\n  return 1\n  if (true) {\n    return 2\n  }\n}\n')
  ok(!!two && two.indentWithSpaces && two.tabSize === 2, `detects 2-space indent (got ${JSON.stringify(two)})`)
  const four = detectIndent('def f():\n    return 1\n    if True:\n        return 2\n')
  ok(!!four && four.tabSize === 4, `detects 4-space indent (got ${JSON.stringify(four)})`)
  const tabs = detectIndent('\tdef f():\n\t\treturn 1\n\t\tpass\n')
  ok(!!tabs && !tabs.indentWithSpaces, `detects tabs (got ${JSON.stringify(tabs)})`)
  ok(detectIndent('x = 1\n') === null, 'too little data returns null')

  console.log('\n[ansi]')
  ok(stripAnsi('\x1b[31mred\x1b[0m') === 'red', 'strips SGR')
  const spans = parseAnsi('\x1b[31merr\x1b[0m ok')
  ok(spans.some((s) => s.text === 'err' && s.className.includes('text-red-400')), `colors red (got ${JSON.stringify(spans)})`)
  ok(parseAnsi('plain')[0].text === 'plain', 'plain text is one span')

  console.log('\n[problemMatchers]')
  const py = matchProblems('Traceback (most recent call last):\n  File "main.py", line 12, in <module>')
  ok(py.some((p) => p.path === 'main.py' && p.line === 12), 'parses Python traceback')
  const gcc = matchProblems('src/app.c:10:4: error: expected ;')
  ok(gcc.some((p) => p.path === 'src/app.c' && p.line === 10 && p.col === 4), 'parses gcc errors')
  const links = extractTerminalLinks('see https://example.com and ./src/app.ts:4')
  ok(links.some((l) => l.kind === 'url' && l.value.startsWith('https://')), 'finds URLs')
  ok(links.some((l) => l.kind === 'path'), 'finds file paths')

  console.log('\n[symbolNav]')
  const files = [
    { id: 'a', path: '/main.py', content: 'def greet():\n    return 1\n\nx = greet()\n' },
    { id: 'b', path: '/util.py', content: 'from main import greet\nprint(greet())\n' },
  ]
  ok(wordAt(files[0].content, 4, 6) === 'greet', 'wordAt finds greet')
  const defs = findDefinitions('greet', files, 'b')
  ok(defs[0]?.fileId === 'a' && defs[0].line === 1, `definition prefers def (got ${JSON.stringify(defs[0])})`)
  const refs = findReferences('greet', files)
  ok(refs.length >= 3, `finds references (got ${refs.length})`)
  const renamed = renameInText(files[0].content, 'greet', 'hello')
  ok(renamed.count === 2 && renamed.text.includes('hello()'), 'renames word-boundary matches')
  ok(filterSymbols(defs, 'gre').length === 1, 'filters symbols by prefix')

  console.log('\n[importPaths]')
  const jsCtx = matchImportContext("import x from './util")
  ok(!!jsCtx && jsCtx.style === 'js' && jsCtx.prefix === './util', `js import context (got ${JSON.stringify(jsCtx)})`)
  const pyCtx = matchImportContext('from util')
  ok(!!pyCtx && pyCtx.style === 'python', 'python import context')
  const sugg = suggestImportPaths('/src/app.ts', './', [{ path: '/src/util.ts', name: 'util.ts' }, { path: '/src/app.ts', name: 'app.ts' }], 'js')
  ok(sugg.includes('./util'), `suggests relative js path (got ${JSON.stringify(sugg)})`)

  console.log('\n[themeImport]')
  const theme = parseThemeText(JSON.stringify({
    name: 'My Dark',
    type: 'dark',
    colors: { 'editor.background': '#111111', 'editor.foreground': '#eeeeee', 'focusBorder': '#00aaff' },
  }))
  ok(theme.palette.name === 'My Dark' && theme.palette.bg === '#111111' && theme.palette.accent === '#00aaff', 'imports vscode theme')
  let threw = false
  try { parseThemeText('not-json') } catch { threw = true }
  ok(threw, 'rejects invalid JSON')

  console.log('\n[pasteIndent]')
  const pasted = indentPasted('    foo()\n    bar()\n', '  ')
  ok(pasted === 'foo()\n  bar()\n', `reindents pasted block (got ${JSON.stringify(pasted)})`)

  console.log('\n[lineEnding]')
  ok(detectLineEnding('a\r\nb\r\n') === 'crlf', 'detects CRLF')
  ok(detectLineEnding('a\nb\n') === 'lf', 'detects LF')
  ok(convertLineEnding('a\nb', 'crlf') === 'a\r\nb', 'converts to CRLF')
  ok(convertLineEnding('a\r\nb', 'lf') === 'a\nb', 'converts to LF')

  console.log('\n[editorConfig]')
  const sections = parseEditorConfig('[*]\nindent_style = space\nindent_size = 2\n[*.py]\nindent_size = 4\n')
  ok(matchEditorConfig('app.js', sections).tabSize === 2, 'js gets * indent 2')
  ok(matchEditorConfig('main.py', sections).tabSize === 4, 'py overrides to 4')

  console.log('\n[snippets]')
  ok(toCmSnippet('foo${cursor}bar').includes('${}'), 'converts ${cursor}')
  ok(toCmSnippet('hello$0').includes('${}'), 'converts $0')

  console.log('\n[bridgeUrl]')
  ok(normalizeBridgeOrigin('http://127.0.0.1:9090/') === 'http://127.0.0.1:9090', 'normalizes origin')
  ok(normalizeBridgeOrigin('not a url') === 'http://127.0.0.1:8080', 'falls back on junk')

  console.log('\n[async js sandbox]')
  const r = await runLocalJavaScript('await Promise.resolve(1); console.log("ok", 1+1)', '')
  ok(r.status === 'accepted' && r.stdout.includes('ok 2'), `top-level await works (got ${JSON.stringify(r)})`)

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
