/**
 * Vercel Serverless Function — GitHub OAuth token exchange proxy.
 *
 * Exchanges the temporary authorization `code` for an access token.
 * The client secret lives ONLY here as an environment variable.
 *
 * NOTE: Vercel's default Node.js runtime loads `api/*.js` handlers via
 * CommonJS, so this file uses `module.exports` — not `export default`.
 *
 * Set these in Vercel Dashboard → Settings → Environment Variables:
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 */

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'OAuth proxy not configured (missing credentials).' });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirect_uri || undefined,
      }),
    });

    const data = await tokenRes.json();

    if (data.access_token) {
      return res.status(200).json({ access_token: data.access_token });
    }

    return res.status(400).json({
      error: data.error_description || data.error || 'Token exchange failed',
    });
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
};
