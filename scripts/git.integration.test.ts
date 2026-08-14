/* Integration test for the Phase 2 git flow (clone → edit → status → commit → pull).
 * Run with: npx tsx scripts/git.integration.test.ts
 * Uses fake-indexeddb for IndexedDB and a fake in-memory GitHub backend.
 */
import 'fake-indexeddb/auto'
import { github } from '../src/services/githubApi'
import * as gitService from '../src/services/gitService'
import * as fsDb from '../src/db/files'
import * as projectsDb from '../src/db/projects'
import { getAuth, setAuth, clearAuth } from '../src/db/gitHub'
import { db } from '../src/db/db'

// --- tiny sha1-ish hasher (deterministic) ---
function sha(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) {
    h = (h * 31 + content.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16).padStart(8, '0')
}

class EmptyRepoError extends Error {
  response = { status: 409, data: { message: 'Git Repository is empty.' } }
  constructor() { super('Git Repository is empty.') }
}

// --- fake GitHub backend ---
class FakeGitHub {
  repos: Record<string, Record<string, string>> = {}
  blobs: Record<string, string> = {}
  trees: Record<string, { path: string; sha: string | null }[]> = {}
  commits: Record<string, string> = {}
  branchShas: Record<string, string> = {}
  emptyRepos = new Set<string>()
  createOrUpdateFileCalls = 0

  addRepo(owner: string, repo: string, files: Record<string, string>) {
    this.repos[`${owner}/${repo}`] = files
    this.branchShas[`${owner}/${repo}/main`] = 'initial-commit'
  }

  addEmptyRepo(owner: string, repo: string) {
    this.repos[`${owner}/${repo}`] = {}
    this.emptyRepos.add(`${owner}/${repo}`)
  }

  getTree = async (_t: string, owner: string, repo: string) => {
    if (this.emptyRepos.has(`${owner}/${repo}`)) throw new EmptyRepoError()
    const r = this.repos[`${owner}/${repo}`]
    const dirs = new Set<string>()
    for (const p of Object.keys(r)) {
      const parts = p.split('/').slice(0, -1)
      let cur = ''
      for (const d of parts) { cur = cur ? `${cur}/${d}` : d; dirs.add(cur) }
    }
    const tree: any[] = []
    for (const d of dirs) tree.push({ path: d, type: 'tree', sha: sha(d), url: `blob:tree` })
    for (const [path, content] of Object.entries(r)) {
      const s = sha(content)
      this.blobs[s] = content
      tree.push({ path, type: 'blob', sha: s, url: `blob:${s}` })
    }
    return { tree, sha: 'tree-sha', truncated: false }
  }
  getFileContent = async (_t: string, url: string) => {
    const s = url.split(':')[1]
    return this.blobs[s] ?? ''
  }
  createBlob = async (_t: string, _o: string, _r: string, content: string) => {
    const s = sha(content)
    this.blobs[s] = content
    return s
  }
  getRef = async (_t: string, owner: string, repo: string, branch: string) => {
    if (this.emptyRepos.has(`${owner}/${repo}`)) throw new EmptyRepoError()
    return { object: { sha: this.branchShas[`${owner}/${repo}/${branch}`] } }
  }
  getCommit = async (_t: string, _o: string, _r: string, shaVal: string) => ({
    tree: { sha: this.commits[shaVal] || 'base-tree' },
    message: 'x',
  })
  createTree = async (_t: string, _o: string, _r: string, _base: string | null, entries: { path: string; sha: string | null }[]) => {
    const ts = sha(JSON.stringify(entries))
    this.trees[ts] = entries
    return ts
  }
  createCommit = async (_t: string, _o: string, _r: string, message: string, treeSha: string) => {
    const cs = sha(message + treeSha)
    this.commits[cs] = treeSha
    return { sha: cs }
  }
  updateRef = async (_t: string, owner: string, repo: string, branch: string, commitSha: string) => {
    const treeSha = this.commits[commitSha]
    const entries = this.trees[treeSha] || []
    const r = this.repos[`${owner}/${repo}`]
    for (const e of entries) {
      if (e.sha === null) delete r[e.path]
      else r[e.path] = this.blobs[e.sha]
    }
    this.branchShas[`${owner}/${repo}/${branch}`] = commitSha
    this.emptyRepos.delete(`${owner}/${repo}`)
  }
  listBranches = async (_t: string, owner: string, repo: string) => {
    if (this.emptyRepos.has(`${owner}/${repo}`)) throw new EmptyRepoError()
    return [{ name: 'main' }]
  }
  createOrUpdateFile = async (_t: string, owner: string, repo: string, path: string, content: string, _msg: string, branch = 'main') => {
    this.createOrUpdateFileCalls++
    const key = `${owner}/${repo}`
    if (!this.repos[key]) this.repos[key] = {}
    this.repos[key][path] = content
    const s = sha(content)
    this.blobs[s] = content
    const cs = sha('init' + path + content)
    this.commits[cs] = 'init-tree'
    this.branchShas[`${key}/${branch}`] = cs
    this.emptyRepos.delete(key)
    return { commitSha: cs, blobSha: s }
  }
  createRepo = async (_t: string, opts: { name: string; private?: boolean }) => {
    const owner = 'dev'
    this.addEmptyRepo(owner, opts.name)
    return { full_name: `${owner}/${opts.name}`, name: opts.name, default_branch: 'main', private: !!opts.private }
  }
  getRepo = async (_t: string, owner: string, repo: string) => {
    if (!this.repos[`${owner}/${repo}`] && !this.emptyRepos.has(`${owner}/${repo}`)) {
      throw new Error('Not Found')
    }
    return { full_name: `${owner}/${repo}`, name: repo, default_branch: 'main', size: this.emptyRepos.has(`${owner}/${repo}`) ? 0 : 1 }
  }
}

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function main() {
  await db.delete()
  await db.open()
  // seed a fake auth token (primary key is the token value 'auth')
  await db.gitHubAuth.put({ token: 'auth', username: 'dev', displayName: 'Dev', avatarUrl: '', tokenExpiry: null, scopes: ['repo'] })

  const fake = new FakeGitHub()
  fake.addRepo('octocat', 'hello', {
    'main.py': 'print("hi")\n',
    'src/util.js': 'export const x = 1;\n',
  })
  // override the client used by gitService
  Object.assign(github, {
    getTree: fake.getTree,
    getFileContent: fake.getFileContent,
    createBlob: fake.createBlob,
    getRef: fake.getRef,
    getCommit: fake.getCommit,
    createTree: fake.createTree,
    createCommit: fake.createCommit,
    updateRef: fake.updateRef,
    listBranches: fake.listBranches,
    createOrUpdateFile: fake.createOrUpdateFile,
    createRepo: fake.createRepo,
    getRepo: fake.getRepo,
  })

  console.log('\n[1] cloneRepository')
  const project = await gitService.cloneRepository(
    { full_name: 'octocat/hello', name: 'hello', default_branch: 'main' } as any,
    'hello',
  )
  const all = await fsDb.listAllInProject(project.id)
  const files = all.filter((n) => n.type === 'file')
  ok(project.github.connected && project.github.owner === 'octocat', 'project marked connected with owner')
  ok(files.length === 2, `cloned 2 files (got ${files.length})`)
  const py = files.find((f) => f.path === '/main.py')
  ok(!!py && py.gitSha != null, 'main.py has gitSha')
  ok(!!py && py.isNew === false, 'cloned file not marked as new')
  ok(!!py && py.content === 'print("hi")\n', 'main.py content correct')
  ok(!!py && py.originalContent === py.content, 'originalContent equals cloned content')
  const nested = files.find((f) => f.path === '/src/util.js')
  ok(!!nested, 'nested file created under folder')

  console.log('\n[2] git status — clean')
  let status = await gitService.computeGitStatus(project.id, Object.fromEntries(all.map((n) => [n.id, n])))
  ok(status.length === 0, `clean tree has no changes (got ${status.length})`)

  console.log('\n[3] modify a file → detected')
  await fsDb.syncGitFile(py!.id, 'print("hi")\n', py!.gitSha!) // baseline original
  await db.files.update(py!.id, { content: 'print("changed")\n', isGitModified: true }) // the edit
  const all2 = await fsDb.listAllInProject(project.id)
  status = await gitService.computeGitStatus(project.id, Object.fromEntries(all2.map((n) => [n.id, n])))
  ok(status.some((s) => s.path === '/main.py' && s.status === 'modified'), 'main.py appears as modified')

  console.log('\n[4] commitChanges (push)')
  const modifiedNode = await fsDb.getNode(py!.id)!
  const sha = await gitService.commitChanges(project.id, { message: 'update main', includeIds: [py!.id], push: true })
  ok(typeof sha === 'string' && sha.length > 0, `commit returned sha ${sha.slice(0, 7)}`)
  // remote should now reflect the change
  ok(fake.repos['octocat/hello']['main.py'] === 'print("changed")\n', 'remote file updated after push')
  const afterCommit = await fsDb.getNode(py!.id)!
  ok(afterCommit.isGitModified === false, 'file no longer modified after commit')
  ok(afterCommit.originalContent === 'print("changed")\n', 'originalContent updated to committed content')

  console.log('\n[5] new file → status new + commit adds it')
  const newFile = await fsDb.createNode(project.id, null, 'NEW.js', 'file', 'console.log("new")\n')
  const all3 = await fsDb.listAllInProject(project.id)
  status = await gitService.computeGitStatus(project.id, Object.fromEntries(all3.map((n) => [n.id, n])))
  ok(status.some((s) => s.path === '/NEW.js' && s.status === 'new'), 'new file appears as A')
  await gitService.commitChanges(project.id, { message: 'add NEW.js', includeIds: [newFile.id], push: true })
  ok(fake.repos['octocat/hello']['NEW.js'] === 'console.log("new")\n', 'new file pushed to remote')
  const committedNew = await fsDb.getNode(newFile.id)!
  ok(committedNew.isNew === false, 'committed file no longer marked new')

  console.log('\n[6] pull with remote conflict')
  fake.repos['octocat/hello']['main.py'] = 'print("remote change")\n'
  await db.files.update(py!.id, { content: 'print("local change")\n', isGitModified: true })
  const result = await gitService.pullChanges(project.id)
  ok(result.conflicts.length === 1 && result.conflicts[0] === '/main.py', 'conflict flagged for double-modified file')
  ok(result.updated === 0, 'no silent overwrite on conflict')

  console.log('\n[7] pull clean update (remote only)')
  fake.addRepo('octocat', 'hello2', { 'main.py': 'print("hi")\n' })
  const cleanProject = await gitService.cloneRepository({ full_name: 'octocat/hello2', name: 'hello2', default_branch: 'main' } as any, 'hello2')
  fake.repos['octocat/hello2']['util_new.py'] = 'print("brand new")\n'
  const result2 = await gitService.pullChanges(cleanProject.id)
  ok(result2.created === 1, `pull created 1 new remote file (got ${result2.created})`)

  console.log('\n[8] rename a folder → old path deleted, new path added on push')
  const srcFolder = (await fsDb.listAllInProject(project.id)).find((n) => n.type === 'folder' && n.name === 'src')
  ok(!!srcFolder, 'src folder exists')
  await fsDb.renameNode(srcFolder!.id, 'lib')
  const afterRename = await fsDb.listAllInProject(project.id)
  const renamedFile = afterRename.find((n) => n.path === '/lib/util.js' && !n.isDeleted)
  const oldTomb = afterRename.find((n) => n.path === '/src/util.js' && n.isDeleted)
  ok(!!renamedFile && renamedFile.isNew, 'file under renamed folder is marked new at /lib/util.js')
  ok(!!oldTomb, 'tombstone recorded for /src/util.js')
  const renameStatus = await gitService.computeGitStatus(project.id, Object.fromEntries(afterRename.map((n) => [n.id, n])))
  ok(renameStatus.some((s) => s.path === '/src/util.js' && s.status === 'deleted'), 'status lists old folder path as deleted')
  ok(renameStatus.some((s) => s.path === '/lib/util.js' && s.status === 'new'), 'status lists new folder path as added')
  await gitService.commitChanges(project.id, {
    message: 'rename src -> lib',
    includeIds: renameStatus.map((s) => s.id),
    push: true,
  })
  ok(!('src/util.js' in fake.repos['octocat/hello']), 'old folder path removed from GitHub')
  ok(fake.repos['octocat/hello']['lib/util.js'] === 'export const x = 1;\n', 'file exists at new folder path on GitHub')
  const afterFolderPush = await fsDb.getNode(renamedFile!.id)
  ok(afterFolderPush?.isNew === false && afterFolderPush.gitSha != null, 'renamed file tracked after commit')

  console.log('\n[9] rename a single file → old path deleted on GitHub')
  const liveUtil = await fsDb.getNode(renamedFile!.id)
  await fsDb.renameNode(liveUtil!.id, 'helpers.js')
  const afterFileRename = await fsDb.listAllInProject(project.id)
  const fileStatus = await gitService.computeGitStatus(project.id, Object.fromEntries(afterFileRename.map((n) => [n.id, n])))
  ok(fileStatus.some((s) => s.path === '/lib/util.js' && s.status === 'deleted'), 'old file path deleted')
  ok(fileStatus.some((s) => s.path === '/lib/helpers.js' && s.status === 'new'), 'new file path added')
  await gitService.commitChanges(project.id, { message: 'rename util', includeIds: fileStatus.map((s) => s.id), push: true })
  ok(!('lib/util.js' in fake.repos['octocat/hello']), 'old file name gone from GitHub')
  ok(fake.repos['octocat/hello']['lib/helpers.js'] === 'export const x = 1;\n', 'renamed file pushed')

  console.log('\n[10] delete a tracked file → tombstone → commit deletes remotely')
  const delMe = await fsDb.createNode(project.id, null, 'gone.txt', 'file', 'bye\n')
  await gitService.commitChanges(project.id, { message: 'add gone', includeIds: [delMe.id], push: true })
  ok(fake.repos['octocat/hello']['gone.txt'] === 'bye\n', 'file exists before delete')
  await fsDb.deleteNodeGitAware(delMe.id)
  const delStatus = await gitService.computeGitStatus(project.id, Object.fromEntries((await fsDb.listAllInProject(project.id)).map((n) => [n.id, n])))
  ok(delStatus.some((s) => s.id === delMe.id && s.status === 'deleted'), 'tracked delete shows as deleted')
  await gitService.commitChanges(project.id, { message: 'delete gone', includeIds: [delMe.id], push: true })
  ok(!('gone.txt' in fake.repos['octocat/hello']), 'deleted file removed from GitHub')
  ok(await fsDb.getNode(delMe.id) === undefined, 'tombstone hard-deleted after commit')

  console.log('\n[11] clone an empty repo + first commit')
  fake.addEmptyRepo('octocat', 'blank')
  const blank = await gitService.cloneRepository({ full_name: 'octocat/blank', name: 'blank', default_branch: 'main' } as any, 'blank')
  ok(blank.github.connected && blank.github.owner === 'octocat', 'empty repo cloned as connected project')
  const readme = await fsDb.createNode(blank.id, null, 'README.md', 'file', '# blank\n')
  const firstSha = await gitService.commitChanges(blank.id, { message: 'init', includeIds: [readme.id], push: true })
  ok(typeof firstSha === 'string' && firstSha.length > 0, 'initial commit succeeded on empty repo')
  ok(fake.repos['octocat/blank']['README.md'] === '# blank\n', 'file pushed to previously empty repo')

  console.log('\n[12] uploadProjectToGitHub — create a brand-new repo')
  const localProject = await projectsDb.createProject('myapp', '')
  const localRoot = await fsDb.createNode(localProject.id, null, 'myapp', 'folder', '', { isNew: false })
  await db.projects.update(localProject.id, { rootFolderId: localRoot.id })
  await db.files.update(localRoot.id, { path: '/' })
  const f1 = await fsDb.createNode(localProject.id, localRoot.id, 'main.py', 'file', 'print(1)\n')
  const res = await gitService.uploadProjectToGitHub(localProject.id, { repoName: 'myapp', message: 'initial upload', private: true })
  ok(res.owner === 'dev' && res.repo === 'myapp', 'uploaded to brand-new repo dev/myapp')
  ok(fake.repos['dev/myapp']['main.py'] === 'print(1)\n', 'main.py uploaded')
  const localFresh = await projectsDb.getProject(localProject.id)
  ok(localFresh!.github.connected && localFresh!.github.repo === 'myapp', 'project marked connected after upload')
  const uploadedF1 = await fsDb.getNode(f1.id)
  ok(uploadedF1!.isNew === false && uploadedF1!.gitSha != null, 'uploaded file tracked after upload')

  console.log('\n[13] Commit Only is rejected (no silent local-only commit)')
  let commitOnlyRejected = false
  try {
    await gitService.commitChanges(project.id, { message: 'nope', includeIds: [py!.id], push: false })
  } catch (e) {
    commitOnlyRejected = /Commit Only is not supported/i.test((e as Error).message)
  }
  ok(commitOnlyRejected, 'commit-only throws instead of marking files clean')

  console.log('\n[14] auth persistence survives a reload')
  await setAuth({ token: 'ghp_real_token', username: 'octo', displayName: 'Octo', avatarUrl: '', tokenExpiry: null, scopes: ['repo'] })
  const stored = await getAuth()
  ok(stored?.token === 'ghp_real_token' && stored.username === 'octo', 'auth is readable after store (not keyed as "auth")')
  await clearAuth()
  ok((await getAuth()) === null, 'sign-out clears stored auth')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
