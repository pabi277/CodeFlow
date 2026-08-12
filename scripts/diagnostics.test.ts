/* Diagnostics engine + go-to-line parser.
 * Run with: npx tsx scripts/diagnostics.test.ts
 */
import { collectDrafts, diagnoseFile, diagnoseProject, jsonErrorLocation, offsetToLineCol } from '../src/services/diagnostics'
import { parseLineCol } from '../src/utils/editorApi'
import type { FileNode } from '../src/types'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function file(partial: Partial<FileNode> & { path: string; content: string }): FileNode {
  return {
    id: partial.id || partial.path,
    name: partial.path.split('/').pop() || partial.path,
    type: 'file',
    path: partial.path,
    content: partial.content,
    parentId: null,
    childIds: [],
    createdAt: 0,
    modifiedAt: 0,
    isGitModified: false,
    gitSha: null,
    originalContent: '',
    isNew: true,
    isDeleted: false,
    projectId: 'p',
  }
}

function main() {
  console.log('\n[json]')
  const bad = collectDrafts('{ "a": ', '/data.json')
  ok(bad.length === 1 && bad[0].severity === 'error', 'invalid JSON is an error')
  ok(collectDrafts('{ "a": 1 }', '/data.json').length === 0, 'valid JSON is clean')
  ok(collectDrafts('', '/empty.json').length === 0, 'empty JSON is not an error')

  console.log('\n[json location]')
  const loc = jsonErrorLocation('Unexpected token a in JSON at position 4', '{\n  a')
  ok(loc.line === 2, `position 4 maps to line 2 (got ${loc.line})`)
  const loc2 = jsonErrorLocation('Expected property name or \'}\' in JSON at position 4 (line 2 column 3)', '{}')
  ok(loc2.line === 2 && loc2.col === 3, 'parses line/column from V8 message')
  const oc = offsetToLineCol('ab\ncd', 4)
  ok(oc.line === 2 && oc.col === 2, 'offsetToLineCol handles newlines')

  console.log('\n[brackets]')
  const unclosed = collectDrafts('function f() {\n  return 1\n', '/a.js')
  ok(unclosed.some((d) => d.message.includes('Unclosed')), 'reports unclosed brace in JS')
  const extra = collectDrafts('const x = ]', '/a.js')
  ok(extra.some((d) => d.message.includes('Unmatched')), 'reports unmatched closer')
  ok(collectDrafts('const s = "{ not a brace"', '/a.js').every((d) => d.source !== 'brackets' || !d.message.includes('Unclosed')), 'ignores braces inside strings')
  ok(collectDrafts('// {\nconst x = 1', '/a.js').length === 0, 'ignores braces in line comments')
  ok(collectDrafts('def f(\n    x\n', '/a.py').some((d) => d.source === 'brackets'), 'python unclosed paren')
  ok(collectDrafts('const r = /foo(bar)/; const c = /[a-z]+/;', '/a.js').length === 0, 'ignores parens and classes inside JS regex')
  ok(collectDrafts('const s = `a ${b} (${c})`;', '/a.js').length === 0, 'ignores braces inside template literals')
  ok(collectDrafts('def greet(name: str) -> str:\n    return f"Hello, {name}!"\n', '/util.py').length === 0, 'python f-string and type hints are clean')

  console.log('\n[no false positives on markup]')
  ok(collectDrafts('<p>It\'s fine (really)</p>\n<script src="app.js"></script>\n', '/i.html').every((d) => d.source !== 'brackets'), 'HTML is not bracket-scanned')
  ok(collectDrafts('See [docs](https://x.com) and a list [1, 2].', '/n.md').every((d) => d.source !== 'brackets'), 'Markdown links are not bracket errors')
  ok(collectDrafts('body { color: red; }\n.card { box-shadow: rgba(0,0,0,.35); }\n', '/a.css').length === 0, 'balanced CSS is clean')

  console.log('\n[markdown]')
  const fence = collectDrafts('# hi\n```js\nconst x = 1\n', '/n.md')
  ok(fence.some((d) => d.message.includes('Unclosed fenced')), 'unclosed fence is an error')
  ok(collectDrafts('[empty]()', '/n.md').some((d) => d.severity === 'warning'), 'empty link is a warning')
  ok(collectDrafts('# ok\n```\ncode\n```\n', '/n.md').length === 0, 'balanced fence is clean')

  console.log('\n[html / yaml]')
  ok(collectDrafts('<!-- oops', '/i.html').some((d) => d.message.includes('comment')), 'unclosed HTML comment')
  ok(collectDrafts('<script>alert(1)', '/i.html').some((d) => d.message.includes('script')), 'unclosed script warning')
  ok(collectDrafts('foo:\n\tbar: 1', '/c.yaml').some((d) => d.message.includes('tabs')), 'YAML tabs are a warning')

  console.log('\n[project]')
  const nodes = {
    a: file({ id: 'a', path: '/ok.js', content: 'const x = 1' }),
    b: file({ id: 'b', path: '/bad.json', content: '{nope' }),
    c: { ...file({ id: 'c', path: '/folder', content: '' }), type: 'folder' as const },
  }
  const project = diagnoseProject(nodes)
  ok(project.some((d) => d.fileId === 'b'), 'project scan includes JSON error')
  ok(project.every((d) => d.fileId !== 'c'), 'folders are skipped')
  ok(diagnoseFile(nodes.a).length === 0, 'clean file has no diagnostics')

  console.log('\n[go to line parser]')
  ok(parseLineCol('12')?.line === 12 && parseLineCol('12')?.col === 1, 'parses line only')
  ok(parseLineCol('12:4')?.line === 12 && parseLineCol('12:4')?.col === 4, 'parses line:col')
  ok(parseLineCol('12, 8')?.col === 8, 'parses line, col')
  ok(parseLineCol('nope') === null, 'rejects garbage')
  ok(parseLineCol('0') === null, 'rejects line 0')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
