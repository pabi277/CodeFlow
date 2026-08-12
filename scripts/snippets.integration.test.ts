/* Tests for the Phase 4 snippet store + DB schema v2 migration.
 * Run with: npx tsx scripts/snippets.integration.test.ts
 */
import 'fake-indexeddb/auto'
import { db } from '../src/db/db'
import * as snippetsDb from '../src/db/snippets'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function main() {
  await db.delete()
  await db.open()

  // snippets table exists (schema v2)
  const id = await snippetsDb.addSnippet({ name: 'for-loop', description: 'Python for loop', language: 'python', body: 'for i in range(${cursor}):\n    pass' })
  ok(!!id, 'added a snippet')

  const list = await snippetsDb.listSnippets()
  ok(list.length === 1 && list[0].name === 'for-loop', 'listed 1 snippet with correct name')
  ok(list[0].language === 'python', 'snippet language stored')
  ok(list[0].body.includes('${cursor}'), 'snippet body preserved cursor placeholder')

  // update
  await snippetsDb.updateSnippet(id, { description: 'updated' })
  const after = await snippetsDb.listSnippets()
  ok(after[0].description === 'updated', 'updated snippet description')

  // delete
  await snippetsDb.deleteSnippet(id)
  ok((await snippetsDb.listSnippets()).length === 0, 'deleted snippet')

  // persistence across close/open
  const id2 = await snippetsDb.addSnippet({ name: 'persist', description: '', language: '', body: 'x' })
  db.close()
  await db.open()
  const reloaded = await snippetsDb.listSnippets()
  ok(reloaded.length === 1 && reloaded[0].id === id2, 'snippet persisted across db reopen')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
