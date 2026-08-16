/* Regression tests for the data-loss fixes:
 *   - edited files stay "modified" after a reload (git flag persisted + recomputed)
 *   - delete a tracked file -> tombstone + deleted status; delete a new file -> hard delete
 *   - rename a tracked file -> old path deleted + new path added
 *   - flushDirtyTabs() persists debounced edits immediately
 *   - session restore opens the most-recently-opened project and per-project editor state
 * Run with: npx tsx scripts/persist.test.ts
 * Uses fake-indexeddb + jsdom so the zustand store can run headlessly.
 */
import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'
import { db } from '../src/db/db'
import * as fsDb from '../src/db/files'
import * as projectsDb from '../src/db/projects'
import * as editorDb from '../src/db/editorState'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const g = global as any
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'SVGElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage']) {
  g[k] = dom.window[k]
}
g.customElements = dom.window.customElements
try {
  g.navigator = { ...dom.window.navigator, onLine: true }
} catch {
  Object.defineProperty(g, 'navigator', { configurable: true, value: { ...dom.window.navigator, onLine: true } })
}
g.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
g.visualViewport = { height: 600, addEventListener(){}, removeEventListener(){}, scroll: 0 }
g.window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} })
g.window.scrollTo = () => {}

const { useStore } = await import('../src/store/useStore')
const gitService = await import('../src/services/gitService')

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function sha(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) h = (h * 31 + content.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, '0')
}

async function makeProject(name: string, files: Array<{ path: string; content: string; tracked?: boolean }>) {
  const project = await projectsDb.createProject(name, '')
  const root = await fsDb.createNode(project.id, null, name, 'folder', '', { isNew: false })
  await db.projects.update(project.id, { rootFolderId: root.id })
  await db.files.update(root.id, { path: '/' })
  const ids: Record<string, string> = {}
  for (const f of files) {
    const parts = f.path.split('/')
    const fname = parts.pop()!
    let parentId: string | null = root.id
    for (const d of parts) {
      const children = await fsDb.getChildren(parentId, project.id)
      const existing = children.find((c) => c.type === 'folder' && c.name === d)
      if (existing) { parentId = existing.id; continue }
      const folder = await fsDb.createNode(project.id, parentId, d, 'folder', '', { isNew: false })
      parentId = folder.id
    }
    const node = f.tracked
      ? await fsDb.createNode(project.id, parentId, fname, 'file', f.content, { isNew: false, gitSha: sha(f.content), originalContent: f.content })
      : await fsDb.createNode(project.id, parentId, fname, 'file', f.content)
    ids[f.path] = node.id
  }
  return { project, ids }
}

function setStoreProject(projectId: string) {
  useStore.setState({
    activeProjectId: projectId,
    nodeMap: {},
    openTabs: [],
    activeTabId: null,
    pinnedTabs: [],
    dirtyTabs: {},
    expanded: {},
    gitStatus: [],
    diagnostics: [],
    cursorPositions: {},
    scrollPositions: {},
    lastSaved: {},
  })
}

async function reloadNodeMap(projectId: string): Promise<Record<string, any>> {
  const nodes = await fsDb.listAllInProject(projectId)
  useStore.setState({ nodeMap: Object.fromEntries(nodes.map((n) => [n.id, n])) })
  return useStore.getState().nodeMap
}

async function main() {
  await db.delete()
  await db.open()

  console.log('\n[1] edit a tracked file → persist → reload status → still modified (Bug 2)')
  const p1 = await makeProject('p1', [{ path: 'main.py', content: 'print(1)\n', tracked: true }])
  const fileId = p1.ids['main.py']
  setStoreProject(p1.project.id)
  await reloadNodeMap(p1.project.id)
  useStore.getState().saveContent(fileId, 'print(2)\n')
  await useStore.getState().persistContent(fileId)
  // Simulate an Android kill: drop all in-memory state and reload from IDB.
  useStore.setState({ nodeMap: {} })
  const reloaded = await reloadNodeMap(p1.project.id)
  ok(reloaded[fileId].isGitModified === true, 'isGitModified flag persisted to IDB')
  ok(reloaded[fileId].gitSha != null && reloaded[fileId].originalContent === 'print(1)\n', 'gitSha / originalContent left intact')
  const status1 = await gitService.computeGitStatus(p1.project.id, reloaded)
  ok(status1.some((s) => s.id === fileId && s.status === 'modified'), 'status recomputed as modified after reload')

  console.log('\n[2] content !== originalContent with isGitModified:false still counts (Bug 2)')
  await db.files.update(fileId, { content: 'print(3)\n', isGitModified: false })
  const reloaded2 = await reloadNodeMap(p1.project.id)
  ok(reloaded2[fileId].isGitModified === false, 'flag is explicitly false (stale)')
  const status2 = await gitService.computeGitStatus(p1.project.id, reloaded2)
  ok(status2.some((s) => s.id === fileId && s.status === 'modified'), 'modified detected from content, not the flag')

  console.log('\n[3] delete tracked file → tombstone + deleted status; delete new file → hard delete (Bug 3)')
  const p3 = await makeProject('p3', [
    { path: 'keep.py', content: 'x = 1\n', tracked: true },
    { path: 'new.txt', content: 'hello\n' },
  ])
  setStoreProject(p3.project.id)
  await reloadNodeMap(p3.project.id)
  const trackedId = p3.ids['keep.py']
  const newId = p3.ids['new.txt']
  await useStore.getState().deleteNode(trackedId)
  ok((await fsDb.getNode(trackedId))?.isDeleted === true, 'tracked delete leaves a tombstone in the DB')
  ok(useStore.getState().nodeMap[trackedId]?.isDeleted === true, 'tombstone still listed in the explorer map')
  const status3 = await gitService.computeGitStatus(p3.project.id, useStore.getState().nodeMap)
  ok(status3.some((s) => s.id === trackedId && s.status === 'deleted'), 'tracked delete shows as deleted')
  await useStore.getState().deleteNode(newId)
  ok(await fsDb.getNode(newId) === undefined, 'untracked (new) delete is a hard delete')
  ok(useStore.getState().nodeMap[newId] === undefined, 'new file removed from the explorer map')

  console.log('\n[4] rename a tracked file → old path deleted + new path added (Bug 3)')
  const p4 = await makeProject('p4', [{ path: 'old.py', content: 'a = 1\n', tracked: true }])
  setStoreProject(p4.project.id)
  await reloadNodeMap(p4.project.id)
  const oldId = p4.ids['old.py']
  await useStore.getState().renameNode(oldId, 'new.py')
  const map4 = useStore.getState().nodeMap
  ok(map4[oldId]?.path === '/new.py' && map4[oldId]?.isNew === true, 'renamed node keeps its id and becomes new')
  const tomb = Object.values(map4).find((n) => n.path === '/old.py' && n.isDeleted)
  ok(!!tomb, 'old path left as a tombstone')
  const status4 = await gitService.computeGitStatus(p4.project.id, map4)
  ok(status4.some((s) => s.path === '/old.py' && s.status === 'deleted'), 'old path listed as deleted')
  ok(status4.some((s) => s.path === '/new.py' && s.status === 'new'), 'new path listed as added')

  console.log('\n[5] flushDirtyTabs() persists debounced edits immediately (Bug 4)')
  const p5 = await makeProject('p5', [{ path: 'a.txt', content: 'one\n', tracked: true }])
  setStoreProject(p5.project.id)
  await reloadNodeMap(p5.project.id)
  const aId = p5.ids['a.txt']
  useStore.getState().saveContent(aId, 'two\n') // dirty, NOT yet persisted
  ok(useStore.getState().dirtyTabs[aId] === true, 'tab is dirty before flush')
  await useStore.getState().flushDirtyTabs()
  ok((await fsDb.getNode(aId))?.content === 'two\n', 'content written to IDB without waiting for the debounce')
  ok(useStore.getState().dirtyTabs[aId] === false, 'tab clean after flush')

  console.log('\n[6] listProjects returns the most recently opened project first (Bug 5)')
  const pa = await projectsDb.createProject('older', '')
  const pb = await projectsDb.createProject('newer', '')
  await db.projects.update(pb.id, { lastOpenedAt: Date.now() + 1000 })
  await db.projects.update(pa.id, { lastOpenedAt: Date.now() + 2000 })
  const list = await projectsDb.listProjects()
  ok(list[0]?.id === pa.id, 'lastOpenedAt sorts the latest project first')

  console.log('\n[7] editor state is namespaced per project (Bug 5)')
  await editorDb.saveEditorState({ openTabIds: ['fileX'], activeTabId: 'fileX', pinnedTabIds: [], cursorPositions: {}, scrollPositions: {}, terminalOpen: true, terminalHeight: 40 }, 'projA')
  const stateA = await editorDb.loadEditorState('projA')
  const stateB = await editorDb.loadEditorState('projB')
  ok(stateA.openTabIds.includes('fileX') && stateA.terminalOpen === true, 'saved state loads for the right project')
  ok(stateB.openTabIds.length === 0 && stateB.terminalOpen === false, 'other project has independent (empty) state')

  console.log('\n[8] bootstrap restores the latest project + its own tabs (Bug 5)')
  const recent = await makeProject('recent', [{ path: 'one.txt', content: '1\n', tracked: true }])
  const older = await makeProject('stale', [{ path: 'two.txt', content: '2\n', tracked: true }])
  await db.projects.update(older.project.id, { lastOpenedAt: Date.now() + 1000 })
  await db.projects.update(recent.project.id, { lastOpenedAt: Date.now() + 2000 }) // recent is the latest
  await editorDb.saveEditorState({ openTabIds: [recent.ids['one.txt']], activeTabId: recent.ids['one.txt'], pinnedTabIds: [recent.ids['one.txt']], cursorPositions: {}, scrollPositions: {}, terminalOpen: false, terminalHeight: 40 }, recent.project.id)
  // A stale global/foreign editor state must not leak into this project.
  await editorDb.saveEditorState({ openTabIds: [older.ids['two.txt']], activeTabId: older.ids['two.txt'], pinnedTabIds: [], cursorPositions: {}, scrollPositions: {}, terminalOpen: false, terminalHeight: 40 }, older.project.id)
  useStore.setState({ booted: false, projects: [], activeProjectId: null, nodeMap: {}, openTabs: [], activeTabId: null, pinnedTabs: [], dirtyTabs: {}, auth: null, toasts: [] })
  await useStore.getState().bootstrap()
  ok(useStore.getState().activeProjectId === recent.project.id, 'bootstrap opens the last-opened project')
  ok(useStore.getState().openTabs[0] === recent.ids['one.txt'], 'restored tabs belong to the restored project')
  ok(useStore.getState().pinnedTabs.includes(recent.ids['one.txt']), 'pinned tabs restored per project')

  console.log('\n[9] upload existing files directly into a selected folder')
  const uploadProject = await makeProject('uploads', [{ path: 'src/existing.txt', content: 'old\n' }])
  setStoreProject(uploadProject.project.id)
  const uploadMap = await reloadNodeMap(uploadProject.project.id)
  const srcFolder = Object.values(uploadMap).find((node) => node.type === 'folder' && node.path === '/src')
  const uploaded = await useStore.getState().uploadFilesToFolder(srcFolder!.id, [
    new File(['hello\n'], 'hello.txt', { type: 'text/plain' }),
    new File(['export const answer = 42;\n'], 'answer.ts', { type: 'text/typescript' }),
  ])
  const afterUpload = await fsDb.listAllInProject(uploadProject.project.id)
  ok(uploaded === 2, 'folder upload reports both created files')
  ok(afterUpload.some((node) => node.path === '/src/hello.txt' && node.content === 'hello\n'), 'uploaded text file is stored inside the chosen folder')
  ok(afterUpload.some((node) => node.path === '/src/answer.ts'), 'multiple selected files keep the chosen folder destination')
  ok(useStore.getState().expanded[srcFolder!.id] === true, 'destination folder expands after upload')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
