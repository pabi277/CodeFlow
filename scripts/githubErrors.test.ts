import { friendlyGitHubError } from '../src/utils/errors'

let pass = 0
let fail = 0
function check(label: string, actual: string, expected: string) {
  if (actual === expected) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.error(`  ❌ ${label}\n     expected: ${expected}\n     actual:   ${actual}`) }
}
function githubError(status: number, message: string) {
  return Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } })
}

console.log('\n[GitHub error messages]')
check('409 empty repository', friendlyGitHubError(githubError(409, 'Git Repository is empty.')), 'This GitHub repository has no commits yet. Add a file, then use Commit & Push to create its first commit.')
check('409 branch conflict', friendlyGitHubError(githubError(409, 'Reference update failed')), 'GitHub has newer changes on this branch. Pull first, resolve any conflicts, then push again.')
check('403 permissions', friendlyGitHubError(githubError(403, 'Resource not accessible by integration')), 'GitHub denied permission for this action. Reconnect with a token that can access this repository and push to this branch.')
check('404 repository', friendlyGitHubError(githubError(404, 'Not Found')), 'GitHub could not find this repository or your account cannot access it. Check the repository and reconnect GitHub if needed.')
check('422 duplicate', friendlyGitHubError(githubError(422, 'Repository creation failed: name already exists')), 'That GitHub repository or branch already exists. Choose a different name, or connect to the existing repository.')
check('server failure', friendlyGitHubError(githubError(502, 'Bad Gateway')), 'GitHub is having a temporary problem. Your local changes are safe; try again shortly.')
console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
process.exit(fail ? 1 : 0)
