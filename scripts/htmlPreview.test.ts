/* HTML preview bundler — inlines project CSS/JS/images.
 * Run with: npx tsx scripts/htmlPreview.test.ts
 */
import {
  buildHtmlPreview,
  findProjectFile,
  normalizePath,
  processCss,
  resolveHref,
  rewriteJsImports,
  toDataUrl,
} from '../src/utils/htmlPreview'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  console.log('\n[resolveHref]')
  ok(resolveHref('/index.html', 'style.css') === '/style.css', 'same-folder css')
  ok(resolveHref('/pages/index.html', '../css/app.css') === '/css/app.css', 'parent-relative')
  ok(resolveHref('/pages/index.html', './js/app.js') === '/pages/js/app.js', './ relative')
  ok(resolveHref('/pages/a.html', '/lib/x.js') === '/lib/x.js', 'root-absolute')
  ok(resolveHref('/index.html', 'https://cdn.example/a.css') === 'external', 'https is external')
  ok(resolveHref('/index.html', '//cdn.example/a.css') === 'external', 'protocol-relative is external')
  ok(resolveHref('/index.html', 'app.js?v=2#hash') === '/app.js', 'strips query and hash')
  ok(normalizePath('/a/b/../c/./d') === '/a/c/d', 'normalizes .. and .')

  console.log('\n[lookup]')
  const files = { '/Css/App.css': 'body{}', '/js/app.js': 'console.log(1)' }
  ok(findProjectFile(files, '/css/app.css') === 'body{}', 'case-insensitive lookup')
  ok(findProjectFile(files, '/missing.js') === undefined, 'missing file')

  console.log('\n[inline css + js]')
  const html = `<!doctype html>
<html><head>
<link rel="stylesheet" href="css/style.css">
<link href="https://cdn.example/x.css" rel="stylesheet">
</head><body>
<h1>Hi</h1>
<script src="js/app.js"></script>
<script src="https://cdn.example/x.js"></script>
</body></html>`
  const project = {
    '/preview.html': html,
    '/css/style.css': 'h1 { color: tomato; }',
    '/js/app.js': 'document.body.dataset.ready = "1"',
  }
  const result = buildHtmlPreview(html, '/preview.html', project)
  ok(result.html.includes('h1 { color: tomato; }'), 'inlines local stylesheet')
  ok(result.html.includes('data-codeflow-from="/css/style.css"'), 'marks inlined css source')
  ok(result.html.includes('document.body.dataset.ready'), 'inlines local script')
  ok(result.html.includes('https://cdn.example/x.css'), 'leaves CDN stylesheet')
  ok(result.html.includes('https://cdn.example/x.js'), 'leaves CDN script')
  ok(!result.html.includes('href="css/style.css"'), 'removes local link href')
  ok(!result.html.includes('src="js/app.js"'), 'removes local script src')
  ok(result.inlined.includes('/css/style.css') && result.inlined.includes('/js/app.js'), 'reports inlined paths')
  ok(result.missing.length === 0, 'no missing files')

  console.log('\n[missing + nested]')
  const nested = buildHtmlPreview(
    '<link rel="stylesheet" href="../theme.css"><script src="missing.js"></script>',
    '/pages/index.html',
    { '/theme.css': 'body{margin:0}' },
  )
  ok(nested.html.includes('body{margin:0}'), 'resolves ../ stylesheet')
  ok(nested.missing.includes('/pages/missing.js'), `reports missing script (got ${nested.missing.join(',')})`)

  console.log('\n[@import + url()]')
  const missing: string[] = []
  const inlined: string[] = []
  const css = processCss(
    '@import "more.css";\n.hero { background: url(logo.svg); }',
    '/css/app.css',
    { '/css/more.css': '.ok{color:red}', '/css/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
    missing,
    inlined,
  )
  ok(css.includes('.ok{color:red}'), 'inlines @import')
  ok(css.includes('data:image/svg+xml'), 'inlines svg url()')
  ok(toDataUrl('/a.svg', '<svg></svg>')?.startsWith('data:image/svg+xml') === true, 'svg data url')

  console.log('\n[module imports]')
  const rewritten = rewriteJsImports(
    'import { greet } from "./lib.js";\ngreet()',
    '/js/main.js',
    { '/js/lib.js': 'export function greet(){ return 1 }' },
    [],
    [],
  )
  ok(rewritten.includes('data:text/javascript'), 'rewrites relative module import to data url')
  ok(rewritten.includes(encodeURIComponent('export function greet')), 'keeps imported module source')

  const modHtml = buildHtmlPreview(
    '<script type="module" src="./main.js"></script>',
    '/index.html',
    { '/main.js': 'import "./dep.js"', '/dep.js': 'window.DEP=1' },
  )
  ok(modHtml.html.includes('data:text/javascript'), 'module src file has rewritten imports')
  ok(modHtml.inlined.includes('/dep.js'), 'module dependency is inlined')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
