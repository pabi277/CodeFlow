# CodeFlow OAuth proxy (Cloudflare Worker)

This worker exchanges the GitHub OAuth authorization **code** for an **access token**.
It is the only place the GitHub **client secret** lives — never ship it to the browser.

## Why

A GitHub OAuth `client_secret` can't be embedded in a PWA's frontend code. Instead:

1. The app redirects the user to GitHub with its `client_id` and scopes.
2. GitHub redirects back to `/auth/callback?code=...&state=...`.
3. The app POSTs the `code` to this worker's `/exchange` endpoint.
4. The worker (which holds the secret) asks GitHub for the token and returns it.
5. The app stores the token in **IndexedDB**.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler deploy
# then set secrets:
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Edit `wrangler.toml` to add your route/zone, and update the `ALLOWED_ORIGIN`
behaviour if you want stricter CORS than `*`.

## Frontend wiring

In `src/services/authService.ts` set:

```ts
clientId: 'YOUR_GITHUB_OAUTH_CLIENT_ID',
tokenProxyUrl: 'https://your-deployed-worker.workers.dev/exchange',
```

And register the GitHub OAuth App's callback URL to
`https://<your-pwa-origin>/auth/callback`.
