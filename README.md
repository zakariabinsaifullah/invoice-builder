# Invoice Builder

Clean, developer-styled invoices with reusable templates — **https://invoicebuilder.tinytools.work**

- **Guests:** create, preview, print and download PDF invoices. Nothing leaves the browser (the draft lives in the tab).
- **Signed in (GitHub / Google):** save invoices, save one or many as **templates**, start a quick invoice from a template, saved clients, business profile & defaults, automatic numbering, JSON export.

## Stack

| | |
|---|---|
| App | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query |
| API | Hono on Cloudflare Workers (`/api/*`), same Worker serves the SPA |
| Data | Cloudflare D1 (SQLite) via Drizzle ORM; logos content-addressed in D1, or R2 if a `LOGOS` bucket is bound |
| Auth | Better Auth (GitHub + Google OAuth), sessions in D1, cookie shareable across `*.tinytools.work` |
| PDF | @react-pdf/renderer, fonts embedded (JetBrains Mono / Geist + Noto fallbacks), lazy-loaded |

```
src/       React app (features/: editor, preview+pdf, invoices, templates, clients, settings, auth, command)
worker/    Hono API — routes/, auth.ts, logos.ts, db/schema.ts
shared/    Zod schemas + pure logic shared by both (money, numbering, templates)
migrations/ D1 SQL migrations (drizzle-kit)
```

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars        # fill BETTER_AUTH_SECRET (openssl rand -base64 32) + OAuth dev credentials
npm run db:migrate:local
npm run dev                           # http://localhost:5173 (D1 runs locally)
```

OAuth callback URLs: `<origin>/api/auth/callback/github` and `<origin>/api/auth/callback/google`.
GitHub OAuth apps allow one callback each — use a separate dev app for `http://localhost:5173`.

Schema changes: edit `worker/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate:local`.

## Deploy

```sh
npx wrangler login                    # once
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GITHUB_CLIENT_ID     # and GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run deploy                        # build → apply remote D1 migrations → wrangler deploy
```

### Automatic deploys (Workers Builds)

The Worker is connected to this repo in **Cloudflare → Workers & Pages → invoice-builder → Settings → Builds**:

| Setting | Value |
|---|---|
| Branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:ci` (applies pending D1 migrations, then `wrangler deploy`) |
| Root directory | `/` |

Every push to `main` builds and deploys; GitHub shows the result as a check on the commit.
If the deploy step fails on the D1 migration with an authorization error, give the build's API token **Account → D1 → Edit**.

The custom domain (`invoicebuilder.tinytools.work`) is declared in `wrangler.jsonc`; Cloudflare creates the DNS record on deploy.

> **Note:** if the project lives in an iCloud-synced folder (e.g. Desktop), iCloud can evict `node_modules` files and make builds hang. Keep it in a non-synced folder.

## Security

- Every data route requires a session and is scoped by `user_id`; numbers are unique per user (DB constraint).
- Rate limits: sign-in 20/min per IP, writes 120/min per user (Workers rate-limiting bindings).
- Strict CSP and security headers for the app (`public/_headers`); API responses are `no-store` + `nosniff`.
- Stored logos are public by unguessable SHA-256 key (they're printed on invoices).

Fonts: JetBrains Mono, Geist, Noto Sans — SIL Open Font License (see `public/fonts/OFL*.txt`).
