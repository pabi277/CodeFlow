/* Round-trip test for ZIP export/import.
 * Run with: npx tsx scripts/zip.test.ts
 */
import 'fake-indexeddb/auto'
import { db } from '../src/db/db'
import * as filesDb from '../src/db/files'
import { buildProjectZip, buildSubtreeZip, storedContentToBlob, parseZipFile, entriesToSeed } from '../src/utils/zip'

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

  console.log('\n[storedContentToBlob — text and data-URL content]')
  const textBlob = storedContentToBlob('print("hi")\n', 'main.py')
  ok(textBlob instanceof Blob && (await textBlob.text()) === 'print("hi")\n', 'text content becomes a text Blob')
  const b64 = btoa('binary-bytes')
  const dataUrl = `data:image/png;base64,${b64}`
  const binBlob = storedContentToBlob(dataUrl, 'img.png')
  ok(binBlob.type === 'image/png', `data URL blob gets mime image/png (got ${binBlob.type})`)
  const roundtrip = new TextDecoder().decode(await binBlob.arrayBuffer())
  ok(roundtrip === 'binary-bytes', 'data URL content decodes back to original bytes')

  console.log('\n[buildSubtreeZip — folder-scoped archive]')
  const folderZip = await buildSubtreeZip('proj1', '/src')
  const folderBuf = await folderZip.arrayBuffer()
  const folderEntries = await parseZipFile(folderBuf)
  const folderPaths = folderEntries.map((e) => e.path)
  ok(folderPaths.length === 1 && folderPaths[0] === 'util.js', `folder zip only contains subtree with relative path (got ${JSON.stringify(folderPaths)})`)
  ok(folderEntries[0].content === 'export const x = 1;\n', 'folder zip content round-trips')
  const rootZip = await buildSubtreeZip('proj1', '/')
  const rootEntries = await parseZipFile(await rootZip.arrayBuffer())
  ok(rootEntries.length === 2, `root zip includes all files (got ${rootEntries.length})`)

  console.log('\n[deleted tombstone files are excluded from zips]')
  const doomed = await filesDb.createNode('proj1', src.id, 'secret.txt', 'file', 'should not leak', { isNew: false })
  await filesDb.markTrackedDeleted(doomed.id)
  const afterDelete = await parseZipFile(await (await buildProjectZip('proj1')).arrayBuffer())
  ok(!afterDelete.some((e) => e.path.includes('secret.txt')), 'deleted file excluded from project zip')
  const afterDeleteSub = await parseZipFile(await (await buildSubtreeZip('proj1', '/src')).arrayBuffer())
  ok(!afterDeleteSub.some((e) => e.path.includes('secret.txt')), 'deleted file excluded from folder zip')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
