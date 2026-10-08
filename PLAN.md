# Invoice Builder — Build Plan

A fast, developer-styled invoice builder at **invoicebuilder.tinytools.work**.
Anyone can create and download invoices; signed-in users can also save invoices, templates and clients to Cloudflare.

---

## 1. Goals

- **Make an invoice in under a minute.** The form sits beside a live preview, with sensible defaults and automatic numbering.
- **Two tiers of access:**
  - **Guest (not signed in):** create, preview and download/print invoices. Nothing is saved to the server.
  - **Signed in:** everything a guest can do, plus saving invoices, saving one or many as **templates**, starting a quick invoice from a template, saved clients and a default business profile.
- **Developer look.** Monospace type, a terminal-inspired colour palette, and the invoice itself styled like a clean code file.
- **One Cloudflare deploy.** A single Worker serves the React app and the API, backed by D1 (database) and R2 (logo images).
- **Ready for the wider tinytools.work suite.** Sign-in is set up so later tools on other subdomains can share it.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + TypeScript + Vite** | Fast development, static build |
| Styling | **Tailwind CSS v4 + shadcn/ui** (Radix) | Accessible components we can fully restyle |
| Icons / motion | **lucide-react**, **Motion** (subtle only) | |
| Client state | **Zustand** (editor), **TanStack Query** (server data) | Caching, loading states, optimistic updates |
| Forms | **React Hook Form + Zod** | The same Zod schemas validate input on both client and server |
| Routing | **React Router** | |
| PDF | **@react-pdf/renderer**, with the brand fonts embedded | Selectable-text PDFs that match the preview |
| API | **Hono** on Cloudflare Workers, under `/api/*` | Small, typed, built for Workers |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** | Type-safe queries and migrations |
| File storage | **Cloudflare R2** | Business logo uploads |
| Auth | **Better Auth** (D1 adapter) | Works on Workers; sessions stored in D1 |
| Sign-in methods | **GitHub + Google OAuth** (email magic link later) | No passwords to manage; suits a developer audience |
| Build/deploy | **@cloudflare/vite-plugin + Wrangler** | One `npm run deploy` |

---

## 3. Architecture

```
invoicebuilder.tinytools.work
        │
        ▼
┌──────────────── Cloudflare Worker ────────────────┐
│  Static assets (React SPA)       /api/* (Hono)     │
│                                   ├─ /api/auth/*   │ ← Better Auth
│                                   ├─ /api/invoices │
│                                   ├─ /api/templates│
│                                   ├─ /api/clients  │
│                                   ├─ /api/profile  │
│                                   └─ /api/logo     │
└───────────────┬────────────────────────┬──────────┘
                ▼                        ▼
            D1 (SQLite)              R2 (logos)
```

- **Guest mode** runs entirely in the browser. The current draft is kept in `sessionStorage` only, so refreshing the tab doesn't lose work, but nothing goes to the server.
- **Save actions** (Save invoice, Save as template, Clients) are visible to guests but locked. Clicking one opens a "Sign in to save" dialog, and the draft carries over after sign-in.
- **Every API route except auth** requires a session, and every query is filtered by `user_id`.
- **Shared sign-in for future tools:** Better Auth is configured so cookies can be shared across `*.tinytools.work` (a cross-subdomain cookie on `.tinytools.work`). Later, sign-in can move to `auth.tinytools.work` and be shared by every tool. For now it lives inside this app.

---

## 4. Features

### Invoice editor (guests + signed-in users)
- **From:** your business name, logo, address, email and tax ID. Signed-in users get this auto-filled from their profile.
- **Bill to:** the client. Signed-in users can pick from saved clients.
- **Invoice details:** number (auto-increments for signed-in users, with a prefix like `INV-2026-0012`), issue date, payment terms (Net 7/15/30 or custom) and due date.
- **Line items:** description, quantity, rate and amount. Rows can be added, deleted, reordered by dragging and duplicated, and Enter adds a new row.
- **Totals:** a tax rate, a discount (percent or fixed amount) and shipping. Subtotal, tax, discount and total update live.
- **Other:** currency (formatted for the locale), notes, payment instructions and terms.
- **Output:** Download PDF and Print.

### Templates (signed-in only)
- **Save as template** from the editor, choosing which parts to keep: business info, client, items, notes, terms and style.
- **Bulk save:** select several invoices in the list and choose "Save as templates".
- **Template gallery:** cards with a mini preview, name, tags and when each was last used. Pin, rename, duplicate and delete.
- **Quick invoice:** pick a template to get a new invoice with the next number, today's date and a due date worked out from the template's payment terms.
- **⌘K → "New from template…"** for keyboard users.

### Invoices and clients (signed-in only)
- **Invoice list:** status (Draft, Sent, Paid, and Overdue worked out from the due date), search, filters and sorting.
- **Bulk actions:** save as templates, duplicate, mark paid, delete.
- **Saved clients:** stored for reuse, and auto-saved the first time you use a new one.
- **Settings:** business profile, logo, default currency, tax and terms, number prefix and next number.
- **Backup:** export all your data as JSON.

---

## 5. Data Model (D1)

The auth tables (`user`, `session`, `account`, `verification`) are created by Better Auth.

```sql
profiles   (user_id PK, business_json, currency, tax_rate, terms_days, number_prefix, next_number, logo_key, updated_at)
clients    (id PK, user_id, name, email, address, tax_id, phone, created_at)
invoices   (id PK, user_id, number, status, issue_date, due_date, currency, client_id,
            data_json, total_cents, template_id, created_at, updated_at)
templates  (id PK, user_id, name, tags_json, pinned, data_json, due_in_days, last_used_at, created_at)

-- indexes
invoices(user_id, updated_at), invoices(user_id, number) UNIQUE, templates(user_id, pinned, last_used_at), clients(user_id, name)
```

- `data_json` holds the full invoice payload (parties, line items, notes, style). It is validated with the same Zod schema the client uses.
- Searchable and sortable values (number, status, dates, total) get their own columns.
- Money is stored and calculated in **integer cents**, which avoids rounding errors.
- Invoice numbers come from `profiles.next_number`, which is incremented inside a D1 batch so two invoices never get the same number.

---

## 6. Design Direction: "terminal clean"

**Fonts**
- **Geist Sans** for the app interface.
- **JetBrains Mono** for numbers, labels, the invoice document and code-style details. Both are free, open-source fonts.
- Numbers use tabular figures so amounts line up.

**Colours** (dark-first, with a matching light theme)

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0B0D10` | `#FAFAF9` | page background |
| `surface` | `#12151A` | `#FFFFFF` | cards and panels |
| `border` | `#1F242C` | `#E7E5E4` | hairlines |
| `text` | `#E6EDF3` | `#1C1917` | primary text |
| `muted` | `#7D8590` | `#78716C` | secondary text |
| **`accent`** | **`#3DDC97`** | **`#0E9F6E`** | "signal green": buttons, focus, totals |
| `info` | `#79C0FF` | `#0969DA` | links, `sent` status |
| `warn` | `#E3B341` | `#9A6700` | `overdue` status |
| `danger` | `#FF7B72` | `#CF222E` | delete, errors |

**Interface details**
- A slim sidebar and a two-pane editor.
- Section headers styled like code comments, for example `// bill_to`.
- Keyboard-shortcut hints shown as `kbd` chips.
- Status badges styled like code, for example `status: paid`.
- Thin 1px borders, 8px corners, no heavy shadows.
- A blinking caret on empty fields.

**The invoice document** (the preview and the PDF use the same style)
- Monospace header: `INVOICE  #INV-2026-0012`, followed by a `$ issued 2026-10-08 · due 2026-10-22` line.
- Line items laid out as a table with faint row numbers down the side, like an editor gutter.
- Labels muted, values in the main text colour, the total in the accent colour.
- Clean on white paper for printing. The dark terminal look is optional on screen.
- Two document styles at launch: **Mono** (the default developer style) and **Minimal** (a neutral fallback for clients who prefer it).

---

## 7. Project Structure

```
invoice-builder/
├─ src/                    # React app
│  ├─ app/                 # routes, layout, sidebar, auth guard
│  ├─ features/
│  │  ├─ editor/           # InvoiceForm, LineItems, Totals
│  │  ├─ preview/          # HTML preview + pdf/ (react-pdf docs, font registration)
│  │  ├─ invoices/  templates/  clients/  settings/  auth/
│  ├─ components/ui/       # shadcn components (restyled)
│  └─ lib/                 # api client, money, dates, numbering
├─ worker/                 # Cloudflare Worker
│  ├─ index.ts             # Hono app; serves /api/*
│  ├─ auth.ts              # Better Auth config
│  ├─ routes/              # invoices, templates, clients, profile, logo
│  └─ db/schema.ts         # Drizzle schema
├─ shared/                 # Zod schemas + types used by both app and worker
├─ migrations/             # D1 SQL migrations (drizzle-kit)
├─ wrangler.jsonc
└─ vite.config.ts
```

---

## 8. Cloudflare Setup

`wrangler.jsonc`:
```jsonc
{
  "name": "invoice-builder",
  "main": "worker/index.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "not_found_handling": "single-page-application", "run_worker_first": ["/api/*"] },
  "routes": [{ "pattern": "invoicebuilder.tinytools.work", "custom_domain": true }],
  "d1_databases": [{ "binding": "DB", "database_name": "invoice-builder", "database_id": "<id>" }],
  "r2_buckets": [{ "binding": "LOGOS", "bucket_name": "invoice-builder-logos" }],
  "observability": { "enabled": true }
}
```

**Secrets** (set with `wrangler secret put`): `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`.

**OAuth redirect URLs:** `https://invoicebuilder.tinytools.work/api/auth/callback/{github,google}`, plus a localhost version for development.

**Scripts:**
- `npm run dev`: Vite with the Cloudflare plugin. D1 and R2 run locally, so no cloud account is needed while developing.
- `npm run db:migrate:local` / `npm run db:migrate:remote`
- `npm run deploy`: build, apply migrations, then `wrangler deploy`.

**Protection:** use Cloudflare's rate-limiting binding on the auth and write endpoints, and cap logo uploads at 1 MB, PNG/JPEG/SVG only.

---

## 9. Build Milestones

| # | Milestone | Outcome |
|---|---|---|
| 1 | **Scaffold + deploy check** | Vite, React, Tailwind and shadcn set up, the Worker answering `/api/health`, design tokens and fonts in place, and a first deploy to `invoicebuilder.tinytools.work` to confirm the pipeline works. |
| 2 | **Editor + live preview (guest mode)** | Full form, line items, totals and the Mono document style. Works with no backend. |
| 3 | **PDF + print** | react-pdf document matching the preview, with fonts embedded. |
| 4 | **Auth** | Better Auth tables in D1, GitHub and Google sign-in, session hook, locked save actions and the "Sign in to save" dialog. |
| 5 | **Data API** | Drizzle schema and migrations, Hono routes, Zod validation, profile and settings. |
| 6 | **Templates** | Save-as-template dialog, bulk save, gallery and the quick-invoice flow. |
| 7 | **Invoice list + clients** | Table, statuses, filters, bulk actions, saved clients, logo upload to R2. |
| 8 | **Polish** | ⌘K menu, keyboard shortcuts, Minimal style, empty states, responsive and accessibility pass, light/dark toggle. |
| 9 | **Production** | Rate limits, JSON export, final deploy. |

Later possibilities: email magic-link sign-in, a shareable public invoice link, emailing invoices, and moving sign-in to `auth.tinytools.work` to share with other tools.

---

## 10. Needed From You (by milestone 4)

- A GitHub OAuth app and a Google OAuth client. I'll give step-by-step instructions when we get there.
- `wrangler login` run once in your terminal (`! npx wrangler login`).
