/**
 * Vercel Serverless Function — GitHub OAuth token exchange proxy.
 *
 * The GitHub client secret is kept in Vercel environment variables and never
 * sent to the browser. Configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in
 * the Vercel project settings.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body = req.body || {}
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  const { code, redirect_uri: redirectUri } = body
  if (!code) {
    return res.status(400).json({ error: 'Missing code' })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'OAuth proxy not configured (missing credentials).' })
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri || undefined,
      }),
    })
    const data = await tokenResponse.json()

    if (data.access_token) {
      return res.status(200).json({ access_token: data.access_token })
    }

    return res.status(400).json({
      error: data.error_description || data.error || 'Token exchange failed',
    })
  } catch (error) {
    console.error('Token exchange error:', error)
    return res.status(500).json({ error: 'Token exchange failed' })
  }
}
