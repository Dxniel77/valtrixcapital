# Valtrix Capitallll

> Web3 trading and yield platform on BNB Chain (BEP20) and Polygon.

This repository delivers the Valtrix Capital platform across a **6-week roadmap**. The full plan, design system, tech stack and database schema live in [`/docs`](./docs).

| Doc | What's inside |
|---|---|
| [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md) | Full 6-week plan, business logic spec, risks |
| [`docs/WEEKLY_BREAKDOWN.md`](./docs/WEEKLY_BREAKDOWN.md) | Per-week demo deliverables |
| [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) | Frameworks, infra, env vars, folder layout |
| [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Brand tokens, type, components, motion |
| [`docs/DB_SCHEMA.md`](./docs/DB_SCHEMA.md) | Prisma schema + invariants |

---

## What ships in Week 1

- Marketing landing page with hero, features, how-it-works, yield model, referrals and CTA
- Live-feel market ticker
- Web3 wallet connection on **BSC + Polygon** via RainbowKit (MetaMask, Trust, WalletConnect, Coinbase, Rainbow)
- **SIWE** (Sign-In With Ethereum) flow with JWT session cookies
- Dashboard shell with sidebar, header, mobile nav and 9 navigable sections
- Design system: tokens, typography, components (Button, Card, StatTile, Badge, Separator)
- Prisma schema covering every entity in the 6-week roadmap

---

## Getting started

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Configure (copy and edit)
cp .env.example .env.local

# 3. (Optional) start Postgres locally
#    OR set DATABASE_URL to your Neon / Supabase connection string

# 4. Generate Prisma client
npm run db:generate

# 5. Migrate the database (when DATABASE_URL is set)
npm run db:migrate
npm run db:seed

# 6. Run the dev server
npm run dev
# → http://localhost:3000
```

### Required environment variables (minimum to boot the UI)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Get a free id at [cloud.walletconnect.com](https://cloud.walletconnect.com) — without it WalletConnect modal will warn |
| `NEXTAUTH_SECRET` | Random 32-byte secret for JWT signing |
| `DATABASE_URL` | Postgres connection string (only required when you start writing to DB — Week 3 onwards) |

The wallet UI, landing page and dashboard shell run **without a database** in Week 1.

---

## Project structure

```
app/
  (marketing)/        # Public landing pages
  dashboard/          # Authenticated app shell + per-section pages
  api/auth/           # SIWE nonce + verify + session endpoints
components/
  brand/              # Logo
  marketing/          # Hero, sections, nav, footer, ticker
  dashboard/          # Sidebar, header, mobile nav, page header, coming-soon
  ui/                 # Button, Card, Badge, Separator, StatTile
  web3/               # Connect wallet button
lib/
  auth/               # SIWE + JWT session helpers
  hooks/              # Client hooks (useSiwe, …)
  wagmi.ts            # Wagmi config (BSC + Polygon)
  utils.ts            # Formatters, micro-USDT math, countdown
prisma/
  schema.prisma       # Full schema (all entities)
  seed.ts             # Demo data
public/
  brand/              # Logo assets
docs/                 # Plans, design, schema, tech stack
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript no-emit check |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations in dev |
| `npm run db:push` | Push schema without migrations |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed demo data |

---

## License

Proprietary © Valtrix Capital. All rights reserved.
