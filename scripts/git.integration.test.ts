/* Integration test for the Phase 2 git flow (clone → edit → status → commit → pull).
 * Run with: npx tsx scripts/git.integration.test.ts
 * Uses fake-indexeddb for IndexedDB and a fake in-memory GitHub backend.
 */
import 'fake-indexeddb/auto'
import { github } from '../src/services/githubApi'
import * as gitService from '../src/services/gitService'
import * as fsDb from '../src/db/files'
import { db } from '../src/db/db'

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
  emptyRepos = new Set<string>()

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
  getCommit = async (_t: string, _o: string, _r: string, sha: string) => ({
    tree: { sha: this.commits[sha] || 'base-tree' },
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
    this.applyRef(owner, repo, branch, commitSha)
  }
  createRef = async (_t: string, owner: string, repo: string, branch: string, commitSha: string) => {
    this.applyRef(owner, repo, branch, commitSha)
  }
  listBranches = async () => [{ name: 'main' }]
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
    createRef: fake.createRef,
    listBranches: fake.listBranches,
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

  console.log('\n[8] clone a brand-new (empty) repository')
  fake.addEmptyRepo('octocat', 'brandnew')
  const emptyProject = await gitService.cloneRepository(
    { full_name: 'octocat/brandnew', name: 'brandnew', default_branch: 'main' } as any,
    'brandnew',
  )
  const emptyAll = await fsDb.listAllInProject(emptyProject.id)
  const emptyFiles = emptyAll.filter((n) => n.type === 'file')
  ok(emptyProject.github.connected && emptyProject.github.owner === 'octocat', 'empty repo cloned as connected project')
  ok(emptyProject.github.branch === 'main', `empty repo uses default branch main (got ${emptyProject.github.branch})`)
  ok(emptyFiles.length === 0, `empty repo clone has no files (got ${emptyFiles.length})`)

  console.log('\n[9] push the first commit to an empty repository (upload)')
  const firstFile = await fsDb.createNode(emptyProject.id, null, 'hello.txt', 'file', 'hello world\n')
  await gitService.commitChanges(emptyProject.id, { message: 'first commit', includeIds: [firstFile.id], push: true })
  ok(fake.repos['octocat/brandnew']['hello.txt'] === 'hello world\n', 'first file uploaded to empty repo')
  ok(fake.branchShas['octocat/brandnew/main'] != null, 'branch ref created for first commit')
  ok(!fake.emptyRepos.has('octocat/brandnew'), 'repo no longer treated as empty after first push')
  const committedFirst = await fsDb.getNode(firstFile.id)!
  ok(committedFirst.isNew === false, 'uploaded file no longer marked new')
  ok(committedFirst.gitSha != null && committedFirst.gitSha !== '', 'uploaded file synced with gitSha')

  console.log('\n[10] pull on an empty repository is a no-op (no crash)')
  fake.addEmptyRepo('octocat', 'empty2')
  const emptyProject2 = await gitService.cloneRepository(
    { full_name: 'octocat/empty2', name: 'empty2', default_branch: 'main' } as any,
    'empty2',
  )
  const emptyPull = await gitService.pullChanges(emptyProject2.id)
  ok(emptyPull.updated === 0 && emptyPull.created === 0 && emptyPull.conflicts.length === 0, 'pull on empty repo returns no changes')

  await db.delete()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
