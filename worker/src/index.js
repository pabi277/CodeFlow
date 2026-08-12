/**
 * CodeFlow — GitHub OAuth token exchange proxy (Cloudflare Worker).
 *
 * This is the ONLY place the GitHub OAuth **client secret** lives. It exchanges
 * the temporary authorization `code` (received on the /auth/callback page) for
 * an access token. Deploy it, then point `GITHUB_OAUTH.tokenProxyUrl` in
 * src/services/authService.ts at the deployed URL.
 *
 * Required environment variables (set via `wrangler secret put` or the Cloudflare
 * dashboard):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *   ALLOWED_ORIGIN   (e.g. https://your-app.vercel.app — for CORS)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const url = new URL(request.url)

    if (url.pathname === '/exchange' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Invalid request body' }, 400)
      }

      const { code, redirect_uri } = body
      if (!code) return json({ error: 'Missing code' }, 400)
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return json({ error: 'Proxy is not configured (missing client credentials).' }, 500)
      }

      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirect_uri || null,
          }),
        })
        const data = await tokenRes.json()
        if (data.access_token) return json({ access_token: data.access_token })
        return json({ error: data.error_description || data.error || 'Token exchange failed' }, 400)
      } catch (err) {
        return json({ error: 'Token exchange failed' }, 500)
      }
    }

    return json({ error: 'Not found' }, 404)
  },
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
