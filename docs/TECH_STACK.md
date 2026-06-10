# Valtrix Capital — Tech Stack & Architecture

> Single source of truth for all engineering choices.

---

## 1. High-level Architecture

```
+----------------------------+         +-----------------------------+
|   Browser (Next.js SSR)    | <-----> |  Next.js API Route Handlers |
|  - RainbowKit + wagmi      |  HTTPS  |  - SIWE auth                |
|  - lightweight-charts      |   WS    |  - Trade engine             |
|  - Zustand store           |         |  - Yield cron               |
+----------------------------+         +-----------------------------+
            |                                       |
            |                                       v
            |                          +-----------------------------+
            |                          |   PostgreSQL (Prisma)       |
            |                          +-----------------------------+
            |
            |   WebSocket (public)
            v
+----------------------------+
|  Binance WS / Bybit WS     |  (live candles + ticker)
+----------------------------+

+----------------------------+
|  BscScan / PolygonScan     |  (REST — tx verification)
+----------------------------+
```

---

## 2. Frontend

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR + RSC + route handlers in one runtime; great DX. |
| Language | **TypeScript (strict)** | Required for a finance product. |
| Styling | **Tailwind CSS v4** + design tokens | Fast, consistent, theme-able. |
| UI primitives | **shadcn/ui** (Radix) | Accessible, copy-in, fully owned. |
| Icons | **lucide-react** | Modern, consistent stroke. |
| Charts | **`lightweight-charts`** (TradingView) | Free, blazing fast, professional. |
| Web3 | **wagmi v2 + viem + RainbowKit** | Modern stack, multi-chain, wallet-agnostic. |
| State | **Zustand** | Tiny, no boilerplate. |
| Forms | **react-hook-form + zod** | Type-safe + ergonomic. |
| Realtime | **Native WebSocket** to Binance/Bybit public streams | No vendor lock-in. |
| Animations | **framer-motion** | Best React animation lib. |
| Notifications | **sonner** | Beautiful, minimal toast lib (works with shadcn). |
| Date / number | **date-fns + Intl** | Tree-shakeable. |

---

## 3. Backend

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Next.js Route Handlers (Node) | One repo, one deploy. |
| Auth | **NextAuth.js v5** with **SIWE** provider + Credentials fallback for admin | Standard, secure, wallet-first. |
| Sessions | JWT (HS256) in `httpOnly` cookies | Stateless; rotatable. |
| ORM | **Prisma** | Industry standard, generates types. |
| Database | **PostgreSQL 16** (Neon / Supabase in prod) | Reliable, mature. |
| Cron | **node-cron** locally; **Vercel Cron** in prod | Daily reset / yield accrual jobs. |
| Rate limit | **`@upstash/ratelimit`** (Redis-backed) | Protect auth & trade endpoints. |
| Validation | **zod** (shared between FE/BE) | Single schema source. |
| Email | **resend.com** | Modern, dev-friendly. |
| Logging | **pino** + Vercel logs | Structured. |
| Error tracking | **Sentry** | Standard. |

---

## 4. Web3 / Chains

- Supported: **BNB Smart Chain (chainId 56)** and **Polygon PoS (chainId 137)**.
- Wallet connectors via RainbowKit: MetaMask, WalletConnect v2, Coinbase Wallet, Trust Wallet, Rainbow.
- **Token contracts** (USDT):
  - BSC: `0x55d398326f99059fF775485246999027B3197955` (USDT BEP20, 18 decimals)
  - Polygon: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (USDT, 6 decimals)
- **Treasury wallet** (collects deposits; signed multisig in production — placeholder env var in dev).
- Deposit detection: poll BscScan / PolygonScan REST for incoming tx to treasury, match against user `intent` records.
- Withdrawals: admin-approved → server-side signer pushes tx → store hash.

---

## 5. Data Sources

| Source | Use | Auth |
|---|---|---|
| **Binance** WS `stream.binance.com:9443/ws/<symbol>@kline_1m` | Live candles for chart | Public |
| **Binance** REST `api.binance.com/api/v3/klines` | Historical candles backfill | API key (provided) |
| **Bybit** WS `stream.bybit.com/v5/public/spot` | Fallback / secondary feed | Public |
| **Bybit** REST | Optional secondary | API key (provided) |
| **BscScan** API `api.bscscan.com/api` | Tx verification | API key (free tier) |
| **PolygonScan** API `api.polygonscan.com/api` | Tx verification | API key (free tier) |

API keys are stored in `.env.local` (never committed).

---

## 6. Folder Structure (target)

```
/
├── app/                    # Next.js App Router
│   ├── (marketing)/        # Landing, about, terms
│   ├── (app)/              # Authenticated dashboard
│   │   ├── dashboard/
│   │   ├── trade/
│   │   ├── bot-trading/
│   │   ├── portfolio/
│   │   ├── history/
│   │   ├── referrals/
│   │   ├── wallet/
│   │   ├── profile/
│   │   └── support/
│   ├── admin/              # Admin panel (role-guarded)
│   └── api/                # Route handlers
│       ├── auth/[...nextauth]/
│       ├── trade/
│       ├── yield/
│       ├── stake/
│       ├── withdraw/
│       ├── referrals/
│       └── admin/
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── brand/              # Logo, marks
│   ├── charts/             # TradingView wrappers
│   ├── trade/              # Trade-specific
│   ├── dashboard/          # Dashboard widgets
│   └── layout/             # Header, sidebar
├── lib/
│   ├── auth.ts             # NextAuth + SIWE
│   ├── db.ts               # Prisma client
│   ├── wagmi.ts            # Web3 config
│   ├── exchanges/          # Binance/Bybit clients
│   ├── explorers/          # BscScan/PolygonScan
│   ├── yield/              # Daily accrual engine
│   ├── trade/              # Trade resolver
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
│   └── brand/              # Logo files
├── docs/                   # This folder
└── styles/
    └── globals.css
```

---

## 7. Environment Variables

```
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Web3
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_BSC_RPC=https://bsc-dataseed.binance.org
NEXT_PUBLIC_POLYGON_RPC=https://polygon-rpc.com
TREASURY_BSC_ADDRESS=0x...
TREASURY_POLYGON_ADDRESS=0x...

# Exchange APIs (server-side only — see lib/exchanges/)
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
BYBIT_API_KEY=...
BYBIT_API_SECRET=...

# Explorers
BSCSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...

# Email / errors
RESEND_API_KEY=...
SENTRY_DSN=...
```

> **Note**: The exchange API keys provided by the client are read-only / market-data only on Valtrix's side. No order placement is performed against the exchanges from this platform.

---

## 8. Build / Run

```bash
# install
pnpm install

# db
pnpm prisma migrate dev
pnpm prisma db seed

# dev
pnpm dev          # http://localhost:3000

# build
pnpm build && pnpm start
```

---

## 9. Security Notes

- **No private keys** for user wallets are ever stored. SIWE = user signs nonce.
- Server-side admin signer for payouts is held in env var (production: HSM / multisig).
- All write endpoints validate session + role; idempotency keys on financial mutations.
- Rate limit auth (5 req/min/IP), trades (max 7/day enforced server-side), withdraw (1 pending at a time).
- CSRF protection on form posts via NextAuth.
- All money math in **integer cents (USDT * 1e6)** — never floats.

---

End of tech stack — v1.0
