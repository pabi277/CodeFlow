/* Round-trip test for ZIP export/import.
 * Run with: npx tsx scripts/zip.test.ts
 */
import 'fake-indexeddb/auto'
import { db } from '../src/db/db'
import * as filesDb from '../src/db/files'
import { buildProjectZip, parseZipFile, entriesToSeed } from '../src/utils/zip'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function main() {
  await db.delete()
  await db.open()

  // build a project: root + folder + 2 files
  const root = await filesDb.createNode('proj1', null, 'proj1', 'folder', '', { isNew: false })
  await db.files.update(root.id, { path: '/' })
  const src = await filesDb.createNode('proj1', root.id, 'src', 'folder', '', { isNew: false })
  await filesDb.createNode('proj1', root.id, 'main.py', 'file', 'print("hi")\n', { isNew: false })
  await filesDb.createNode('proj1', src.id, 'util.js', 'file', 'export const x = 1;\n', { isNew: false })

  console.log('\n[export -> blob]')
  const blob = await buildProjectZip('proj1')
  ok(blob instanceof Blob && blob.size > 0, 'produced a non-empty zip blob')

  console.log('\n[parse zip back]')
  const buf = await blob.arrayBuffer()
  const entries = await parseZipFile(buf)
  const paths = entries.map((e) => e.path).sort()
  ok(paths.includes('main.py'), 'zip contains main.py')
  ok(paths.includes('src/util.js'), 'zip preserves folder structure src/util.js')
  ok(entries.find((e) => e.path === 'main.py')?.content === 'print("hi")\n', 'main.py content round-trips')
  ok(entries.find((e) => e.path === 'src/util.js')?.content === 'export const x = 1;\n', 'util.js content round-trips')

  console.log('\n[entriesToSeed strips common folder]')
  const seed = entriesToSeed(entries)
  ok(seed.some((s) => s.path === 'src/util.js'), 'common top-level folder stripped, keeps relative path')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
