# EventDesk

A multi-company web app for event management companies: customers, quotations, customer accept/decline,
automatic bookings, WhatsApp booking confirmations, calendar, and staff crews with attendance and wages.

Built with Next.js 15 (App Router, server actions), PostgreSQL (Neon) with Drizzle ORM, and Auth.js (Google + email/password).

## Plans

| | Basic ₹799 | Pro ₹1,999 | Enterprise ₹4,999 |
|---|---|---|---|
| Bookings, quotations (customer accepts online), GST invoices, customers, My services, core service tools | ✓ | ✓ | ✓ |
| Active events / team logins | 10 / owner only | Unlimited / 5 | Unlimited / unlimited |
| Calendar, Finance (payments, expenses with bill photo, profit, compare), Staff & crews, Team and roles (ready roles), all tool tabs, 3 document designs + own terms, WhatsApp sharing and reminders | – | ✓ | ✓ |
| Vendors, Customize (app name, any colour, rename/hide menu, own fields and statuses, document titles/numbering/GST rate, build your own tools, branches, own roles), Activity log | – | – | ✓ |

The full comparison is in `src/lib/plans.ts` and on Settings → Plan inside the app.
Locked features show a short explanation and a **Request upgrade** button.

### Platform owner (admin panel)
The sidebar shows **Admin panel** for platform owners: every company with its plan (change it from the drop-down),
logins, events, suspend / activate, and pending upgrade requests (approve / decline).
Make someone a platform owner with either:
- `UPDATE users SET platform_admin = true WHERE email = '...'` in the Neon SQL editor, or
- the `PLATFORM_ADMIN_EMAILS` environment variable (comma-separated emails).

## What works

| Area | What it does |
|---|---|
| Sign-in | Email + password sign-up/sign-in, Google sign-in (shown only when Google keys are set), forgot/reset password by email, sign out. Each company sees only its own data. |
| Quotations | Create/edit with line items, discount and live totals. Share the customer review link (copy, or open WhatsApp with the message filled in). Mark as sent. Full history timeline. Print / save as PDF. |
| Accept / decline | The customer opens `/q/<link>` (no login) and accepts or declines (with an optional reason). Staff can also record a decision made by phone. A quotation can be decided only once, and only while it is Draft/Sent. Expired quotations cannot be accepted. |
| Bookings | Confirmed events only. Accepting a quotation (✓ Accept on the Quotations list, or the customer's link) moves it into Bookings automatically, exactly once (database `UNIQUE` on `bookings.quotation_id` plus a conditional status update), and creates its invoice. Declined quotations (✗ Decline) stay in Quotations and never appear in Bookings. A booking agreed directly can also be added with “New booking”. Mark completed / cancel. |
| WhatsApp | On acceptance a booking confirmation is sent through the Meta WhatsApp Cloud API. Every message is stored first (outbox). Failures are saved with the error and can be retried from the booking page or Settings, or the phone number corrected and resent. A daily job retries failed messages (up to 5 attempts). |
| Staff & crews | Permanent employees (team leaders) and the helper boys they bring. Assign a leader (and their helpers) to a booking, mark attendance, track wages due, record payments, see balances and paid/part-paid/unpaid status. |
| Calendar, dashboard, customers | Month calendar of bookings, dashboard with money tiles, notifications, income vs spending chart, mini calendar; customer list with search and history. |
| Invoices & finance | GST invoices (CGST/SGST, amount in words, numbered per financial year), advance/installment/final payments with live before→after, expenses with bill photo, profit per event, compare events, WhatsApp reminders and receipts. |
| Services & tools | 15 services with your prices. Every tool starts empty; you add your own recipes, ingredients, designs, stock and packages. Tools: catering (recipes, ingredients, menus, purchase generator and lists), decoration (designs, stock with shortage warnings, setups, flower orders), photo & video, entertainment, planning (standard checklist), makeup, invitations. |
| Team, vendors, customize | Team logins with roles, vendors, Enterprise customisation and activity log. |

## Run locally

```bash
npm install
cp .env.example .env.local        # fill in at least DATABASE_URL and AUTH_SECRET
npm run db:apply                  # creates the tables (safe to run again)
npm run dev                       # http://localhost:3000
```

`DATABASE_URL` can be a Neon URL or any Postgres URL (`postgresql://user@localhost:5432/eventdesk`).

## Deploy on Cloudflare Workers

The app runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare); the database stays on Neon.
`wrangler.jsonc` and `worker.ts` hold the setup, including the daily WhatsApp retry (cron trigger, 09:00 IST).
Use the **Workers Paid** plan ($5/month): the free plan's 10 ms CPU limit is too small for server-rendered pages and password checks.

**From GitHub (recommended):** Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick this repo.
Build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`.
The Worker name in `wrangler.jsonc` must match the Worker's name in Cloudflare (`event-management`), and `AUTH_URL` there must be its address.
Then add the variables below under the Worker's Settings → Variables and Secrets (as *Secret* for passwords and keys) and redeploy.

**From your computer:** `npx wrangler login`, then `npx wrangler secret put DATABASE_URL` (and the other secrets), then `npm run cf:deploy`.

Apply the schema once: `DATABASE_URL=<neon url> npm run db:apply` (or run `db/schema.sql` in the Neon SQL editor).
`npm run cf:preview` runs the Cloudflare build locally (settings in `.dev.vars`, same format as `.env.local`).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (`...neon.tech/eventdesk?sslmode=require`) |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `AUTH_URL` | yes | Your live address, e.g. `https://eventdesk.<your-subdomain>.workers.dev` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | for Google sign-in | Google Cloud Console → Credentials → OAuth client (Web). Redirect URI: `<AUTH_URL>/api/auth/callback/google` |
| `RESEND_API_KEY`, `EMAIL_FROM` | for password reset | https://resend.com (verify your sending domain) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | for WhatsApp | Meta for Developers → WhatsApp → API setup. Use a permanent System User token. |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | optional | Default `booking_confirmation` / `en` |
| `CRON_SECRET` | yes | Any long random string; the Cloudflare cron trigger sends it to `/api/cron/notifications` |
| `PLATFORM_ADMIN_EMAILS` | optional | Emails that get the Admin panel (or set `users.platform_admin`) |

Settings → Connections in the app shows which of these are set up.

## WhatsApp template

Business-initiated WhatsApp messages must use a template approved by Meta. Create a **Utility** template named
`booking_confirmation`, language English, with this body (7 variables, in this order):

```
Vanakkam {{1}}, your booking for {{2}} on {{3}}, {{4}} at {{5}} is confirmed with {{6}}. {{7}}
```

1 customer name · 2 event title · 3 date · 4 time · 5 venue · 6 company name · 7 note.
Customer numbers are stored as 10-digit Indian mobiles and sent as `91XXXXXXXXXX`.

## Tests

`tests/decide_test.py` covers the quotation workflow: the list has only ✓ Accept / ✗ Decline, accepted quotations move to
Bookings (confirmed, invoiced), declined ones never appear there. All tests take `BASE=<url>` to run against `npm start`
or the Cloudflare preview (`wrangler dev`).


`tests/e2e2.py` covers plans and limits, the admin panel, upgrade requests, invoices, payments, expenses with bill photos,
profit/compare, confirmed-only bookings and date clashes, empty tools, catering purchase lists, planning checklists, staff wages as expenses,
Enterprise customisation, team roles (accountant cannot open staff), suspension and tenant isolation.

The end-to-end test (`tests/e2e.py`, Playwright) runs against a production build with a local Postgres and a mock
WhatsApp API (`tests/mock_wa.py`, set `WHATSAPP_API_BASE=http://127.0.0.1:3999/v21.0`). It covers sign-up, onboarding,
validation messages, customer and quotation creation, totals, the public accept/decline page, double-accept and two-tab
races (one booking only), declined quotes (no booking), WhatsApp payload, failure → logged → manual retry → sent,
the cron retry, staff/helpers/attendance/wages/payments, calendar, filters, tenant isolation, sign out, and the
password reset (single-use link). `EVENTDESK_TEST=1` makes reset links print to the server log instead of email.
