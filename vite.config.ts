import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
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

/** Local `/api/exchange` so GitHub OAuth works in `vite` / `vite preview`. */
function oauthExchange(): Plugin {
  const handle = async (req: { method?: string; on: (ev: string, cb: (c: Buffer) => void) => void }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void }) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end('ok'); return }
    if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return }
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', async () => {
      let body: { code?: string; redirect_uri?: string } = {}
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { body = {} }
      const clientId = process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID
      const clientSecret = process.env.GITHUB_CLIENT_SECRET
      if (!body.code) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing code' })); return }
      if (!clientId || !clientSecret) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'OAuth proxy not configured (missing credentials). Paste a personal access token instead.' }))
        return
      }
      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: body.code, redirect_uri: body.redirect_uri || undefined }),
        })
        const data = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string }
        if (data.access_token) { res.statusCode = 200; res.end(JSON.stringify({ access_token: data.access_token })); return }
        res.statusCode = 400
        res.end(JSON.stringify({ error: data.error_description || data.error || 'Token exchange failed' }))
      } catch {
        res.statusCode = 502
        res.end(JSON.stringify({ error: 'GitHub token exchange failed.' }))
      }
    })
  }
  return {
    name: 'oauth-exchange',
    configureServer(server) {
      server.middlewares.use('/api/exchange', handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/exchange', handle)
    },
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    oauthExchange(),
    optionalPrettier(),
    react(),
    tailwindcss(),
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
