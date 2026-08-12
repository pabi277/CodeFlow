/* Markdown renderer + preview helpers.
 * Run with: npx tsx scripts/markdown.test.ts
 */
import { escapeHtml, inline, isHtmlPreview, isPreviewable, renderMarkdown, safeUrl } from '../src/utils/markdown'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  console.log('\n[escape / urls]')
  ok(escapeHtml('<script>') === '&lt;script&gt;', 'escapes tags')
  ok(safeUrl('https://example.com') === 'https://example.com', 'allows https')
  ok(safeUrl('mailto:a@b.com') === 'mailto:a@b.com', 'allows mailto')
  ok(safeUrl('/local') === '/local', 'allows root-relative')
  ok(safeUrl('javascript:alert(1)') === null, 'blocks javascript:')
  ok(safeUrl('data:text/html,hi') === null, 'blocks data:')

  console.log('\n[inline]')
  ok(inline('**bold**').includes('<strong>bold</strong>'), 'bold')
  ok(inline('*em*').includes('<em>em</em>'), 'italic')
  ok(inline('`code`').includes('<code>code</code>'), 'inline code')
  ok(inline('[x](https://a.com)').includes('href="https://a.com"'), 'safe link')
  ok(!inline('[x](javascript:alert(1))').includes('href='), 'unsafe link stays text')
  ok(inline('<img>').includes('&lt;img&gt;'), 'raw HTML is escaped')

  console.log('\n[blocks]')
  const html = renderMarkdown('# Title\n\nHello **world**\n\n- a\n- b\n\n```js\nalert(1)\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n')
  ok(html.includes('<h1>Title</h1>'), 'heading')
  ok(html.includes('<strong>world</strong>'), 'paragraph inline')
  ok(html.includes('<ul>') && html.includes('<li>a</li>'), 'list')
  ok(html.includes('<pre><code class="language-js">alert(1)</code></pre>'), 'fenced code')
  ok(html.includes('<table>') && html.includes('<th>A</th>'), 'table')
  ok(!html.includes('<script>'), 'no raw script tags from code fence')

  console.log('\n[previewable]')
  ok(isPreviewable('/readme.md'), 'md is previewable')
  ok(isPreviewable('/page.HTML'), 'html is previewable')
  ok(isPreviewable('/icon.svg'), 'svg is previewable')
  ok(!isPreviewable('/main.py'), 'python is not previewable')
  ok(isHtmlPreview('/x.html') && !isHtmlPreview('/x.md'), 'html vs markdown preview')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
