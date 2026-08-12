/* Regression test: GitHub OAuth callback handling in useStore.bootstrap().
 * Covers: callback auth surviving the final set() (auth-overwrite bug),
 * error toasts instead of silent swallowing, and the ?code= query fallback.
 * Run with: npx tsx scripts/oauth.test.ts */
import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'
import axios from 'axios'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/auth/callback?code=testcode123&state=teststate' })
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
dom.window.sessionStorage.setItem('cf_oauth_state', 'teststate')

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

// --- Patch axios BEFORE importing modules that build clients at module eval ---
const fakeUser = { login: 'octocat', name: 'Octo Cat', avatar_url: 'https://example.com/avatar.png' }
axios.create = (() => ({
  defaults: { headers: { common: {} } },
  get: async (url: string) => {
    if (url === '/user') return { data: fakeUser }
    throw new Error('unexpected client.get ' + url)
  },
})) as any

let exchangeBehavior: () => any = () => ({ data: { access_token: 'gho_fake_token_123' }, status: 200 })
axios.post = (async (url: any) => {
  if (String(url).endsWith('/api/exchange')) return exchangeBehavior()
  throw new Error('unexpected axios.post ' + url)
}) as any

const { useStore } = await import('../src/store/useStore')

async function main() {
  console.log('\n[1] bootstrap with successful OAuth callback')
  await useStore.getState().bootstrap()
  const auth = useStore.getState().auth
  check('auth is set after bootstrap', auth !== null)
  check('username from callback is kept (Bug 2 regression)', auth?.username === 'octocat', `got ${auth?.username}`)
  check('token from callback is kept', auth?.token === 'gho_fake_token_123')
  check('no error toast on success', useStore.getState().toasts.filter((t) => t.type === 'error').length === 0)

  console.log('\n[2] bootstrap with failing exchange -> toast (Bug 3)')
  dom.window.history.replaceState({}, '', '/auth/callback?code=testcode123&state=teststate')
  useStore.setState({ auth: null, booted: false, toasts: [] })
  exchangeBehavior = () => {
    const e: any = new Error('Request failed with status code 400')
    e.isAxiosError = true
    e.response = { data: { error: 'bad_verification_code' } }
    throw e
  }
  await useStore.getState().bootstrap()
  const errToasts = useStore.getState().toasts.filter((t) => t.type === 'error')
  check('error toast shown (not swallowed)', errToasts.length === 1, `found ${errToasts.length}`)
  check('toast shows server error message', errToasts[0]?.message?.includes('bad_verification_code'), `got "${errToasts[0]?.message}"`)
  check('auth stays null on failure', useStore.getState().auth === null)
  check('callback URL left intact on failure (no replaceState)', dom.window.location.href.includes('code=testcode123'), dom.window.location.href)

  console.log('\n[3] bootstrap without /auth/callback pathname but with ?code= (fallback)')
  dom.window.history.replaceState({}, '', '/app?code=fallbackcode&state=teststate')
  dom.window.sessionStorage.setItem('cf_oauth_state', 'teststate')
  useStore.setState({ auth: null, booted: false, toasts: [] })
  exchangeBehavior = () => ({ data: { access_token: 'gho_fallback_token' } })
  await useStore.getState().bootstrap()
  check('callback processed via query fallback', useStore.getState().auth?.token === 'gho_fallback_token', `got ${useStore.getState().auth?.token}`)

  console.log('\n[4] plain boot (no code in URL) does not invoke exchange')
  dom.window.history.replaceState({}, '', '/')
  useStore.setState({ auth: null, booted: false, toasts: [] })
  let exchangeCalls = 0
  exchangeBehavior = () => { exchangeCalls++; return { data: {} } }
  await useStore.getState().bootstrap()
  check('no exchange call on plain boot', exchangeCalls === 0, `calls=${exchangeCalls}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
