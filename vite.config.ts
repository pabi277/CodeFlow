import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const require = createRequire(import.meta.url)

const PRETTIER_FILES: Record<string, string> = {
  'prettier/standalone': 'standalone.mjs',
  'prettier/plugins/babel': 'plugins/babel.mjs',
  'prettier/plugins/estree': 'plugins/estree.mjs',
  'prettier/plugins/typescript': 'plugins/typescript.mjs',
  'prettier/plugins/html': 'plugins/html.mjs',
  'prettier/plugins/postcss': 'plugins/postcss.mjs',
  'prettier/plugins/markdown': 'plugins/markdown.mjs',
}

function prettierRoot(): string | null {
  try {
    return path.dirname(require.resolve('prettier/package.json'))
  } catch {
    return null
  }
}

/** Resolve Prettier to real files, or a stub if `npm install` hasn't pulled it in. */
function optionalPrettier(): Plugin {
  const root = prettierRoot()
  return {
    name: 'optional-prettier',
    enforce: 'pre',
    resolveId(id) {
      const spec = id.split('?')[0]
      const file = PRETTIER_FILES[spec]
      if (!file) return null
      if (root) return path.join(root, file)
      return `\0missing:${spec}`
    },
    load(id) {
      if (!id.startsWith('\0missing:')) return null
      return `export const format = async () => { throw new Error('Prettier is not installed. From the project folder run: npm install') }\nexport default { format }\n`
    },
  }
}

/** Minimal shape of the /api/exchange handler's response object. */
interface OAuthRes {
  statusCode: number
  setHeader(key: string, value: string): void
  end(body?: string): void
  status(code: number): OAuthRes
  json(body: unknown): void
}

/** Dev-only middleware: serves the real api/exchange.js serverless function on
 *  the Vite dev server so the full GitHub OAuth flow works in `npm run dev`.
 *  Reads GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET from .env.local (server-side
 *  only — never exposed to the client bundle). */
function oauthExchangeProxy(): Plugin {
  const exchangePath = path.join(process.cwd(), 'api', 'exchange.js')
  return {
    name: 'oauth-exchange-proxy',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
        if (env[key]) process.env[key] = env[key]
      }
      server.middlewares.use('/api/exchange', (req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk })
        req.on('end', () => {
          let parsed: Record<string, unknown> = {}
          try { parsed = body ? JSON.parse(body) : {} } catch { parsed = {} }
          try {
            // The function is CommonJS (module.exports) while the root
            // package.json is "type": "module" — compile it like Vercel does.
            const Module = require('node:module') as typeof import('node:module')
            const mod = new Module(exchangePath)
            mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(path.dirname(exchangePath))
            ;(mod as unknown as { _compile(code: string, file: string): void })._compile(readFileSync(exchangePath, 'utf8'), exchangePath)
            const handler = mod.exports as (req: unknown, res: OAuthRes) => void
            // Node's http.ServerResponse lacks res.status()/res.json().
            const resAdapter = new Proxy(res, {
              get(target, prop) {
                if (prop === 'status') return (code: number) => { target.statusCode = code; return resAdapter }
                if (prop === 'json') return (obj: unknown) => {
                  target.setHeader('Content-Type', 'application/json')
                  target.end(JSON.stringify(obj))
                }
                return Reflect.get(target, prop, target)
              },
            }) as unknown as OAuthRes
            handler({ method: req.method, body: parsed }, resAdapter)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error).message || 'Token exchange failed' }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    optionalPrettier(),
    react(),
    tailwindcss(),
    oauthExchangeProxy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'og.png', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'CodeFlow',
        short_name: 'CodeFlow',
        description: 'Free open-source mobile IDE. Edit, run, preview, and push to GitHub from your phone.',
        lang: 'en',
        categories: ['developer', 'productivity', 'utilities'],
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1e1e2e',
        theme_color: '#1e1e2e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Open editor', url: '/', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.github\.com\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'github-api', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  optimizeDeps: {
    include: prettierRoot() ? Object.keys(PRETTIER_FILES) : [],
  },
})
