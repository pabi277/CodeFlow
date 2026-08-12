/* Integration test for the git flow (clone → edit → status → commit → pull)
 * plus the "upload to GitHub" features:
 *   - clone an EMPTY repo (no commits) → connected empty project
 *   - commit & push into an empty repo → creates the initial commit
 *   - uploadProjectToGitHub → create a new repo OR fill an existing empty one
 *   - mergeEntriesIntoProject → import a ZIP into the current project
 * Run with: npx tsx scripts/git.integration.test.ts
 * Uses fake-indexeddb for IndexedDB and a fake in-memory GitHub backend.
 */
import 'fake-indexeddb/auto'
import { github } from '../src/services/githubApi'
import * as gitService from '../src/services/gitService'
import * as fsDb from '../src/db/files'
import * as projectsDb from '../src/db/projects'
import { db } from '../src/db/db'
import { parseZipFile } from '../src/utils/zip'

// --- tiny sha1-ish hasher (deterministic) ---
function sha(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) {
    h = (h * 31 + content.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16).padStart(8, '0')
}

// --- error the real GitHub API returns for a brand-new repo with zero commits ---
class EmptyRepoError extends Error {
  isAxiosError = true
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
  meta: Record<string, { private: boolean; description: string | null }> = {}
  emptyRepos = new Set<string>()
  lastTreeBase: string | null | undefined
  lastCommitParents: string[] | undefined
  createRefCalls = 0
  updateRefCalls = 0

  addRepo(owner: string, repo: string, files: Record<string, string>) {
    const key = `${owner}/${repo}`
    this.repos[key] = files
    this.meta[key] = { private: false, description: null }
    this.branchShas[`${key}/main`] = 'initial-commit'
  }

  /** A repo that exists on GitHub but has NO commits yet. */
  addEmptyRepo(owner: string, repo: string) {
    const key = `${owner}/${repo}`
    this.repos[key] = {}
    this.meta[key] = { private: false, description: null }
    this.emptyRepos.add(key)
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
  getRepo = async (_t: string, owner: string, repo: string) => {
    const key = `${owner}/${repo}`
    if (!this.repos[key]) throw new Error('Not Found')
    const hasBranch = Object.keys(this.branchShas).some((k) => k.startsWith(`${key}/`))
    return {
      full_name: key,
      name: repo,
      description: this.meta[key]?.description ?? null,
      language: null,
      stargazers_count: 0,
      private: this.meta[key]?.private ?? false,
      updated_at: '',
      default_branch: 'main',
      clone_url: '',
      size: hasBranch ? 1 : 0,
    }
  }
  createRepo = async (_t: string, opts: { name: string; description?: string; private?: boolean }) => {
    const key = `dev/${opts.name}`
    this.repos[key] = {}
    this.meta[key] = { private: opts.private ?? false, description: opts.description ?? null }
    return {
      full_name: key,
      name: opts.name,
      description: opts.description ?? null,
      language: null,
      stargazers_count: 0,
      private: opts.private ?? false,
      updated_at: '',
      default_branch: 'main',
      clone_url: '',
      size: 0,
    }
  }
  getRef = async (_t: string, owner: string, repo: string, branch: string) => {
    if (this.emptyRepos.has(`${owner}/${repo}`)) throw new EmptyRepoError()
    const shaValue = this.branchShas[`${owner}/${repo}/${branch}`]
    if (!shaValue) throw new Error('Not Found')
    return { object: { sha: shaValue } }
  }
  getCommit = async (_t: string, _o: string, _r: string, shaValue: string) => ({
    tree: { sha: this.commits[shaValue] || 'base-tree' },
    message: 'x',
  })
  createTree = async (_t: string, _o: string, _r: string, base: string | null, entries: { path: string; sha: string | null }[]) => {
    this.lastTreeBase = base
    const ts = sha(JSON.stringify(entries))
    this.trees[ts] = entries
    return ts
  }
  createCommit = async (_t: string, _o: string, _r: string, message: string, treeSha: string, parents: string[]) => {
    this.lastCommitParents = parents
    const cs = sha(message + treeSha)
    this.commits[cs] = treeSha
    return { sha: cs }
  }
  applyRef = (owner: string, repo: string, branch: string, commitSha: string) => {
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
  updateRef = async (_t: string, owner: string, repo: string, branch: string, commitSha: string) => {
    this.updateRefCalls++
    this.applyRef(owner, repo, branch, commitSha)
  }
  createRef = async (_t: string, owner: string, repo: string, branch: string, commitSha: string) => {
    this.createRefCalls++
    this.applyRef(owner, repo, branch, commitSha)
  }
  listBranches = async (_t: string, owner: string, repo: string) => {
    const prefix = `${owner}/${repo}/`
    const names = Object.keys(this.branchShas)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
    return names.map((name) => ({ name }))
  }
  listCommits = async (_t: string, owner: string, repo: string) => {
    if (this.emptyRepos.has(`${owner}/${repo}`)) throw new EmptyRepoError()
    return []
  }
}

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

async function makeProject(name: string, files: Record<string, string>) {
  const project = await projectsDb.createProject(name, '')
  const root = await fsDb.createNode(project.id, null, name, 'folder', '', { isNew: false })
  await db.projects.update(project.id, { rootFolderId: root.id })
  await db.files.update(root.id, { path: '/' })
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    const fname = parts.pop()!
    let parentId: string | null = root.id
    let cur = ''
    for (const d of parts) {
      cur = cur ? `${cur}/${d}` : d
      const children = await fsDb.getChildren(parentId, project.id)
      const existing = children.find((c) => c.type === 'folder' && c.name === d)
      if (existing) { parentId = existing.id; continue }
      const folder = await fsDb.createNode(project.id, parentId, d, 'folder', '', { isNew: false })
      parentId = folder.id
    }
    await fsDb.createNode(project.id, parentId, fname, 'file', content)
  }
  return project
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
    getRepo: fake.getRepo,
    createRepo: fake.createRepo,
    getRef: fake.getRef,
    getCommit: fake.getCommit,
    createTree: fake.createTree,
    createCommit: fake.createCommit,
    updateRef: fake.updateRef,
    createRef: fake.createRef,
    listBranches: fake.listBranches,
    listCommits: fake.listCommits,
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

  console.log('\n[8] clone a brand-new (empty) repository')
  fake.addEmptyRepo('octocat', 'blank')
  const blank = await gitService.cloneRepository({ full_name: 'octocat/blank', name: 'blank', default_branch: 'main' } as any, 'blank')
  ok(blank.github.connected && blank.github.owner === 'octocat', 'empty repo cloned as connected project')
  ok(blank.github.branch === 'main', `empty repo uses default branch main (got ${blank.github.branch})`)
  const blankFiles = (await fsDb.listAllInProject(blank.id)).filter((n) => n.type === 'file')
  ok(blankFiles.length === 0, 'empty repo clone has no files')

  console.log('\n[9] push the first commit to an empty repository (Commit & Push)')
  const readme = await fsDb.createNode(blank.id, null, 'README.md', 'file', '# blank\n')
  const srcDir = await fsDb.createNode(blank.id, null, 'src', 'folder', '', { isNew: false })
  const appJs = await fsDb.createNode(blank.id, srcDir.id, 'app.js', 'file', 'console.log(1)\n')
  const updatesBeforeFirstCommit = fake.updateRefCalls
  const firstSha = await gitService.commitChanges(blank.id, { message: 'first commit', includeIds: [readme.id, appJs.id], push: true })
  ok(typeof firstSha === 'string' && firstSha.length > 0, 'initial commit succeeded on empty repo')
  ok(fake.repos['octocat/blank']['README.md'] === '# blank\n', 'file pushed to previously empty repo')
  ok(fake.repos['octocat/blank']['src/app.js'] === 'console.log(1)\n', 'nested file pushed to previously empty repo')
  ok(fake.lastTreeBase === null, 'first tree has no base tree')
  ok(fake.lastCommitParents?.length === 0, 'first commit has no parents')
  ok(fake.createRefCalls === 1, 'branch ref created exactly once for first commit')
  ok(fake.updateRefCalls === updatesBeforeFirstCommit, 'first commit does not try to update a missing ref')
  ok(fake.branchShas['octocat/blank/main'] != null, 'branch ref points to the first commit')
  ok(!fake.emptyRepos.has('octocat/blank'), 'repo no longer treated as empty after first push')
  const committedReadme = await fsDb.getNode(readme.id)!
  ok(committedReadme.isNew === false && committedReadme.gitSha != null, 'uploaded file synced with gitSha')

  console.log('\n[10] uploadProjectToGitHub — create a brand-new repo')
  const localProject = await makeProject('myapp', { 'main.py': 'print(1)\n', 'lib/util.py': 'def x(): pass\n' })
  const f1 = (await fsDb.listAllInProject(localProject.id)).find((n) => n.path === '/main.py')!
  const res = await gitService.uploadProjectToGitHub(localProject.id, { repoName: 'myapp', message: 'initial upload', private: true })
  ok(res.owner === 'dev' && res.repo === 'myapp' && res.branch === 'main', 'uploaded to brand-new repo dev/myapp')
  ok(fake.repos['dev/myapp']['main.py'] === 'print(1)\n', 'main.py uploaded')
  ok(fake.repos['dev/myapp']['lib/util.py'] === 'def x(): pass\n', 'nested util.py uploaded')
  ok(fake.meta['dev/myapp'].private === true, 'new repo created as private')
  const localFresh = await projectsDb.getProject(localProject.id)
  ok(localFresh!.github.connected && localFresh!.github.repo === 'myapp', 'project marked connected after upload')
  const uploadedF1 = await fsDb.getNode(f1.id)
  ok(uploadedF1!.isNew === false && uploadedF1!.gitSha != null, 'uploaded file tracked after upload')

  console.log('\n[11] upload into an existing EMPTY repo (+ reject non-empty)')
  fake.addEmptyRepo('octocat', 'blank2')
  const local2 = await makeProject('local2', { 'README.md': 'hi' })
  const res2 = await gitService.uploadProjectToGitHub(local2.id, { owner: 'octocat', repo: 'blank2', message: 'from zip' })
  ok(res2.repo === 'blank2', 'uploaded into existing empty repo')
  ok(fake.repos['octocat/blank2']['README.md'] === 'hi', 'existing empty repo now contains files')
  const local3 = await makeProject('local3', { 'a.txt': 'x' })
  let rejected = false
  try {
    await gitService.uploadProjectToGitHub(local3.id, { owner: 'octocat', repo: 'hello', message: 'x' })
  } catch {
    rejected = true
  }
  ok(rejected, 'uploading into a non-empty repo is rejected with an error')

  console.log('\n[12] mergeEntriesIntoProject (ZIP import into the current project)')
  const local4 = await makeProject('local4', { 'main.py': 'print("old")\n' })
  const merged = await gitService.mergeEntriesIntoProject(local4.id, [
    { path: 'main.py', content: 'print("new")\n' },
    { path: 'src/util.js', content: 'export const x = 1\n' },
    { path: 'src/extra/readme.txt', content: 'hello' },
    { path: '__MACOSX/._junk', content: 'junk' },
  ])
  ok(merged.created === 2 && merged.updated === 1, `zip merge created 2 updated 1 (got ${JSON.stringify(merged)})`)
  const all4 = await fsDb.listAllInProject(local4.id)
  ok(all4.find((n) => n.path === '/main.py')!.content === 'print("new")\n', 'existing file overwritten by zip')
  ok(!!all4.find((n) => n.path === '/src/util.js' && n.isNew), 'new zip file created as new')
  ok(!!all4.find((n) => n.path === '/src/extra/readme.txt'), 'nested zip structure created')
  ok(!all4.some((n) => n.path.includes('__MACOSX')), 'junk zip entries skipped')

  console.log('\n[13] zip overwrite of a TRACKED file → marked modified')
  const helloPy = (await fsDb.listAllInProject(project.id)).find((n) => n.path === '/main.py')!
  const before = helloPy.content
  const m2 = await gitService.mergeEntriesIntoProject(project.id, [{ path: 'main.py', content: 'print("zip changed")\n' }])
  ok(m2.updated === 1, 'tracked file updated by zip merge')
  const helloPy2 = (await fsDb.listAllInProject(project.id)).find((n) => n.path === '/main.py')!
  ok(helloPy2.content === 'print("zip changed")\n', 'tracked file content replaced')
  ok(before !== helloPy2.content, 'content actually changed')

  console.log('\n[14] edge: empty zip / root-level file entry')
  const m3 = await gitService.mergeEntriesIntoProject(local4.id, [])
  ok(m3.created === 0 && m3.updated === 0, `empty zip merge is a no-op (got ${JSON.stringify(m3)})`)
  const m4 = await gitService.mergeEntriesIntoProject(local4.id, [{ path: 'root_file.txt', content: 'hi' }])
  ok(m4.created === 1, 'root-level zip entry becomes a file')

  console.log('\n[15] edge: zip overwrite with identical content is idempotent')
  const mainContent = (await fsDb.listAllInProject(local4.id)).find((n) => n.path === '/main.py')!.content
  const m5 = await gitService.mergeEntriesIntoProject(local4.id, [{ path: 'main.py', content: mainContent }])
  ok(m5.updated === 0, 'identical zip content does not mark the file modified')

  console.log('\n[16] edge: upload a project with zero files')
  const emptyProj = await makeProject('emptyproj', {})
  const res3 = await gitService.uploadProjectToGitHub(emptyProj.id, { repoName: 'emptyproj' })
  ok(res3.repo === 'emptyproj', 'zero-file project still uploads (creates repo + empty initial commit)')
  ok(!!fake.branchShas['dev/emptyproj/main'], 'empty upload still creates the branch ref')

  console.log('\n[17] edge: upload rejects an already-connected project')
  let rejected2 = false
  try {
    await gitService.uploadProjectToGitHub(project.id, { repoName: 'nope' })
  } catch {
    rejected2 = true
  }
  ok(rejected2, 'upload to an already-connected project is rejected')

  console.log('\n[18] edge: empty repo with a non-"main" default branch')
  fake.addEmptyRepo('octocat', 'odd')
  const odd = await gitService.cloneRepository({ full_name: 'octocat/odd', name: 'odd', default_branch: 'trunk' } as any, 'odd')
  ok(odd.github.branch === 'trunk', 'empty repo cloned with its default branch (trunk)')
  const oddFile = await fsDb.createNode(odd.id, null, 'x.txt', 'file', 'x')
  await gitService.commitChanges(odd.id, { message: 'c', includeIds: [oddFile.id], push: true })
  ok(!!fake.branchShas['octocat/odd/trunk'], 'initial commit created ref refs/heads/trunk')

  console.log('\n[19] edge: pull on a cloned EMPTY repo returns cleanly')
  fake.addEmptyRepo('octocat', 'fresh')
  const fresh = await gitService.cloneRepository({ full_name: 'octocat/fresh', name: 'fresh', default_branch: 'main' } as any, 'fresh')
  const pr = await gitService.pullChanges(fresh.id)
  ok(pr.created === 0 && pr.updated === 0 && pr.conflicts.length === 0, 'pull on empty repo returns an empty result')
  const emptyLog = await gitService.getCommitLog(fresh.id)
  ok(emptyLog.length === 0, 'commit log on empty repo returns no commits')

  console.log('\n[20] edge: commit-only is rejected without losing local changes')
  const localOnlyFile = await fsDb.createNode(fresh.id, null, 'keep-local.txt', 'file', 'keep me\n')
  const blobsBeforeCommitOnly = Object.keys(fake.blobs).length
  let commitOnlyError = ''
  try {
    await gitService.commitChanges(fresh.id, { message: 'local only', includeIds: [localOnlyFile.id], push: false })
  } catch (err) {
    commitOnlyError = (err as Error).message
  }
  ok(commitOnlyError.includes('Commit Only is not supported'), 'commit-only reports why it is unavailable')
  ok(Object.keys(fake.blobs).length === blobsBeforeCommitOnly, 'commit-only performs no remote API writes')
  ok(fake.emptyRepos.has('octocat/fresh'), 'commit-only does not create a remote branch')
  const preservedLocalFile = await fsDb.getNode(localOnlyFile.id)
  ok(preservedLocalFile?.isNew === true, 'commit-only keeps the local file marked as new')

  console.log('\n[21] edge: zip merge file/folder name collisions are skipped safely')
  const m6 = await gitService.mergeEntriesIntoProject(local4.id, [{ path: 'src', content: 'i am a file but src is a folder' }])
  ok(m6.created === 0 && m6.updated === 0, 'file entry blocked by existing FOLDER of same name')
  const collProj = await makeProject('coll', { 'src': 'i am a file' })
  const m7 = await gitService.mergeEntriesIntoProject(collProj.id, [{ path: 'src/app.js', content: 'x' }])
  ok(m7.created === 0, 'folder path blocked by existing FILE segment of same name')

  console.log('\n[22] E2E: clone empty repo → import real ZIP → commit & push')
  fake.addEmptyRepo('octocat', 'e2e')
  const e2e = await gitService.cloneRepository({ full_name: 'octocat/e2e', name: 'e2e', default_branch: 'main' } as any, 'e2e')
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('index.html', '<h1>hi</h1>')
  zip.file('src/app.js', 'console.log(1)\n')
  zip.file('src/utils/helper.py', 'def h(): pass\n')
  zip.folder('emptyfolder') // dir-only entries should be dropped by parseZipFile
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipEntries = await parseZipFile(zipBlob)
  const mergedE2e = await gitService.mergeEntriesIntoProject(e2e.id, zipEntries)
  ok(mergedE2e.created === 3, `zip import created 3 files (got ${JSON.stringify(mergedE2e)})`)
  const e2eIds = (await fsDb.listAllInProject(e2e.id)).filter((n) => n.type === 'file' && !n.isDeleted).map((n) => n.id)
  await gitService.commitChanges(e2e.id, { message: 'import zip', includeIds: e2eIds, push: true })
  ok(fake.repos['octocat/e2e']['index.html'] === '<h1>hi</h1>', 'root zip file pushed to GitHub')
  ok(fake.repos['octocat/e2e']['src/utils/helper.py'] === 'def h(): pass\n', 'nested zip file pushed to GitHub')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
