# Security policy

## Supported versions

Please report issues against the latest `main` branch.

## Reporting a vulnerability

**Do not** open a public issue for security problems.

Email the maintainers or use GitHub's **Private vulnerability reporting** on [pabi277/CodeFlow](https://github.com/pabi277/CodeFlow) if it is enabled.

Include:

- What the issue is and how to reproduce it
- Impact (token leak, XSS in preview, path traversal on the Termux bridge, etc.)
- Your suggested fix, if you have one

We will acknowledge the report and work on a fix before any public disclosure.

## Hard rules in this codebase

- Never put a GitHub OAuth **client secret** in frontend code. Use the Cloudflare worker in `/worker`.
- Store tokens in IndexedDB only — not localStorage, cookies, or the URL.
- The Termux bridge must bind to `127.0.0.1` only and must not run arbitrary shell strings.
- HTML preview must not execute `javascript:` or `data:` URLs from user markdown.
