# Valtrix Capital — 6-Week Development Plan

> **Project**: Valtrix Capital — Web3 Trading & Staking Platform
> **Networks**: BNB Smart Chain (BEP20) + Polygon
> **Timeline**: 6 weeks (1 demo milestone per week)
> **Document version**: 1.0

---

## 1. Executive Summary

Valtrix Capital is a Web3-native trading and yield platform where users:

1. Connect a wallet (MetaMask, Trust Wallet, WalletConnect-compatible) on **BSC (BEP20)** and **Polygon**.
2. Lock capital into **flexible stakes** (no fixed packages) from **$15 to $100,000** (USDT/USDC).
3. Participate in **live trading operations** on multiple pairs (BTC, ETH, SOL, XRP, etc.) sourced from **Binance + Bybit** market data.
4. Earn a **base yield of 0.3% per day** + up to **0.7% bonus** from winning their **7 daily trades** (cap **1%/day**).
5. Capital remains **locked until 200% ROI** (100% capital + 100% profit) is reached.
6. Build a **7-level referral network** that accelerates the daily yield.
7. Withdraw profits at any time (3% fee), with on-chain transactions verifiable on **BscScan / PolygonScan**.

The product also features a **Bot Trading** module that surfaces simulated/mirrored institutional operations (drawn from real exchange data) with BscScan-style transaction hashes — purely a presentation/transparency layer; **the actual trading is real market-data driven** as clarified by the client.

---

## 2. Clarifications from Client Conversation

| Topic | Client Decision |
|---|---|
| Investment packages | **No fixed packages** — user decides the amount. Multiple stakes per user are **summed** to form the trading capital base. |
| Single active investment | Only **one active investment plan** per person; new stakes are added to the same active plan. |
| Trading | **Real-market data** (not simulated). 7 quick trades/day across user-selected pairs. |
| Pairs | Multiple: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT, MATIC/USDT, and more. |
| Networks | **BSC + Polygon**. |
| Bot Trading | Public feed of trades extracted from external exchanges with **BscScan verification links**. |
| Branding | "Valtrix Capital" — silver + gold dark theme, modern & clean (more polished than reference mock). |

---

## 3. Business Logic Specification

### 3.1 Staking Logic

- **Minimum stake**: 15 USDT
- **Maximum stake**: 100,000 USDT
- **One active investment per user**; additional deposits are merged into the active plan.
- **Lock condition**: total capital is locked until cumulative profit reaches **+100%** of total deposits (so payout cap = 2× total deposits).
- **Stake currency**: USDT (BEP20) and USDT (Polygon) at launch; USDC optional later.

### 3.2 Daily Yield Logic

| Component | Value |
|---|---|
| Base daily yield | **0.3 %** of total active capital |
| Bonus per winning trade | **+0.1 %** of total active capital |
| Max trades per day | **7** |
| Max daily yield (all 7 won) | **1.0 %** |
| Min daily yield (all 7 lost / not played) | **0.3 %** |
| Reset cadence | Every 24h (UTC) the trade counter and bonuses reset |

**Examples**:
- User stakes 1,000 USDT. Wins 3 of 7 trades → daily yield = `0.3% + 3 × 0.1% = 0.6%` → **6 USDT** credited.
- User stakes 5,000 USDT spread across 3 stakes (100 + 900 + 4,000). Wins 7/7 → daily yield = `1%` on **5,000 USDT** = **50 USDT** credited.

### 3.3 Referral System (7 Levels)

- Each user gets a unique referral link.
- Only **active referrals** (users with ≥ minimum stake AND ≥1 trade in the last X days) generate commissions.
- Commission rates are configurable; **default proposal** (admin-editable in panel):

| Level | Default Commission |
|---|---|
| 1 | 7 % |
| 2 | 3 % |
| 3 | 2 % |
| 4 | 1 % |
| 5 | 1 % |
| 6 | 0.5 % |
| 7 | 0.5 % |

- Commissions are paid out **on referral's daily yield** (not on their deposit principal), routed to the upline's **earnings balance** which counts toward the 200% cap acceleration.

### 3.4 Withdrawals

- Available anytime from **earnings balance**.
- **3% withdrawal fee**.
- Minimum withdrawal: 10 USDT.
- Settled on-chain (BSC or Polygon, user's choice).
- Each withdrawal generates a transaction record + on-chain tx hash visible on BscScan / PolygonScan.

### 3.5 Admin Capabilities

- Full user CRUD: view, activate, deactivate, ban.
- Manual balance adjustments (audit-logged).
- View all deposits, withdrawals, trades, referrals.
- Configure: yield rates, commission tiers, fees, allowed pairs.
- Bot-trading feed control: pause / resume / configure visible volume/cadence.

---

## 4. Tech Stack

### 4.1 Frontend
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + custom design tokens
- **UI primitives**: shadcn/ui (Radix-based, accessible)
- **Charts**: `lightweight-charts` by TradingView (free, professional)
- **Icons**: lucide-react
- **State**: Zustand (lightweight, no boilerplate)
- **Forms**: react-hook-form + zod
- **Web3**: wagmi v2 + viem + RainbowKit
- **Realtime**: Native WebSocket (Binance/Bybit public streams)
- **Animations**: framer-motion

### 4.2 Backend
- **Runtime**: Next.js Route Handlers (Node.js)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js with **SIWE** (Sign-In With Ethereum) + JWT sessions
- **Job scheduler**: node-cron (daily reset, yield accrual)
- **Exchange data**: Binance REST + WS, Bybit REST + WS
- **Block explorer**: BscScan API, PolygonScan API

### 4.3 Infra (recommended deploy targets)
- **App**: Vercel (Next.js native)
- **DB**: Neon / Supabase Postgres
- **Cron**: Vercel Cron or external (e.g., Upstash QStash)
- **Secrets**: `.env.local` (dev), Vercel env vars (prod)

---

## 5. Design System (high-level)

**Inspiration**: client's reference dashboard (dark theme, neon green/red trades) + the Valtrix logo (silver gradient + gold accent).

### Palette
| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0A0A0F` | Page background |
| `--bg-elevated` | `#11131A` | Cards, sidebar |
| `--bg-hover` | `#1A1D27` | Hover, dividers |
| `--border-subtle` | `#23262F` | 1px lines |
| `--text-primary` | `#F5F5F7` | Headings |
| `--text-secondary` | `#9CA0AB` | Body |
| `--text-muted` | `#5C606B` | Captions |
| `--gold` | `#D4AF37` | Primary brand accent |
| `--gold-bright` | `#F0C75E` | Hover on gold |
| `--silver` | `#C0C5CE` | Secondary brand |
| `--success` | `#22C55E` | Buy, profit |
| `--danger` | `#EF4444` | Sell, loss |
| `--info` | `#3B82F6` | Info chips |
| `--warning` | `#F59E0B` | Warnings |

### Typography
- **Display / brand**: `Sora` (geometric, premium)
- **UI**: `Inter` (highly readable)
- **Monospace (numbers/hashes)**: `JetBrains Mono`

### Components (week-1 scope)
- Button (primary gold, secondary silver, ghost, danger, success)
- Card / SurfaceCard
- Stat tile (label + value + delta)
- Input, Select, Toggle, Tabs
- Sidebar with active state
- Header with wallet pill
- Modal / Drawer
- Toast notifications

---

## 6. Database Schema (summary)

Core entities (full Prisma schema delivered in Week 1):

- `User` — id, walletAddress, email?, isActive, role (USER/ADMIN), referrerId, createdAt
- `Stake` — userId, amount, currency, network, startedAt, lockedUntilROI=2.0, status
- `Investment` — aggregates a user's stakes: totalCapital, totalEarned, cap=2× totalCapital
- `Trade` — userId, pair, direction (UP/DOWN), entryPrice, exitPrice, durationSec, result (WIN/LOSS), yieldBonusApplied, openedAt
- `DailyYieldRecord` — userId, date, baseYield, bonusYield, totalCredited
- `Referral` — userId, uplineId, level (1-7)
- `Commission` — userId, fromUserId, level, amount, sourceTradeId, sourceYieldId
- `Deposit` — userId, network, txHash, amount, status (PENDING/CONFIRMED/FAILED)
- `Withdrawal` — userId, network, toAddress, amount, fee, status, txHash
- `BotOperation` — pair, direction, amount, pnl, txHash (fake/mirror), bscScanUrl, executedAt
- `AdminAction` — adminId, targetUserId, action, payload, createdAt

---

## 7. 6-Week Roadmap

Each week ends with a demo to the client. Deliverables are cumulative.

### Week 1 — Foundation, Design System, Wallet & Auth

**Goal**: A live URL where the client can connect MetaMask, see the landing page, sign in, and land on an empty dashboard shell with the proper visual identity.

**Deliverables**:
- Repo bootstrapped (Next.js 15 + TS + Tailwind + shadcn/ui + Prisma).
- Design tokens + Tailwind theme + base components.
- Marketing landing page (hero, how-it-works, stats, footer) using the Valtrix logo.
- Web3 connect (BSC + Polygon) via RainbowKit, with chain switcher.
- SIWE auth flow → JWT session.
- Dashboard shell: sidebar (Dashboard, Bot Trading, Trade, Portfolio, History, Referrals, Wallet, Profile, Support), header with wallet pill + balance, light/dark switch (default dark).
- DB schema migrated locally; seed script for demo users.
- Deployed to Vercel staging.

### Week 2 — Live Trading Module

**Goal**: Functional Trade screen with real candles and the 7-trade daily mechanic.

**Deliverables**:
- TradingView `lightweight-charts` integration with **multiple pairs**: BTC, ETH, SOL, XRP, BNB, MATIC (configurable).
- Timeframes: 1m / 5m / 15m / 1h / 4h / 1D.
- Live price stream via Binance WebSocket (primary) + Bybit fallback.
- Trade panel: Buy ↑ / Sell ↓ with duration selector (1 / 2 / 3 / 5 min).
- 7-daily-trades counter with countdown to UTC reset.
- Trade outcome resolved by comparing entry vs. exit price at duration end.
- Open positions list + trade results in History tab.
- Daily yield engine: applies +0.1% per win, base 0.3%, caps at 1%/day.

### Week 3 — Staking, Portfolio & Yield Engine

**Goal**: Users can deposit, see capital working, and watch profits accrue daily.

**Deliverables**:
- Deposit flow on BSC + Polygon (USDT BEP20, USDT Polygon). For Week 3 we'll use on-chain transfer to a project wallet (treasury) with confirmation watcher; smart-contract escrow is scoped for Week 6 / post-launch.
- "New Stake" modal with amount selector (slider + input), min 15 / max 100k.
- Portfolio screen: total active capital (sum of stakes), cumulative profit, % to 200% cap, days active, next yield ETA.
- Cron job (UTC 00:00): close yesterday's accruals → write `DailyYieldRecord` → credit `earningsBalance` → check 200% cap (auto-close if reached).
- Stake history + investment progress bar.
- Lock state UI ("Locked until 200%").

### Week 4 — Referrals & Bot Trading Feed

**Goal**: Viral mechanic + the transparency module.

**Deliverables**:
- Referral system: 7 levels, configurable rates, only active referrals count.
- Referral link generator + QR + share buttons.
- Network tree view (downline by level, counts + earnings per level).
- Commission credit engine fires on every daily yield event.
- Bot Trading screen: live feed of operations (BTC/ETH/SOL...) with fake-but-deterministic tx hashes and clickable BscScan links; configurable cadence/volume; designed to look like a hedge-fund desk.
- Public stats: company profits (today / week / all-time) visible on dashboard top strip.

### Week 5 — Withdrawals, Wallet, History & Admin Panel

**Goal**: Money in, money out — fully auditable.

**Deliverables**:
- Wallet screen: deposit addresses (BSC/Polygon) + transaction history.
- Withdrawal flow: amount → 3% fee preview → confirm → admin-approval queue (configurable: auto-approve below threshold) → on-chain payout → tx hash stored.
- Full transaction History page with filters (deposits, withdrawals, trades, commissions, yield).
- **Admin panel** (separate route `/admin`, role-guarded):
  - User list with search, filter, sort, actions (activate/deactivate, adjust balance, view details).
  - Movements explorer (all deposits/withdrawals/trades).
  - Network browser (referral trees, top earners).
  - Settings: yield rates, commission tiers, fees, allowed pairs, bot-feed config.
  - Audit log of admin actions.

### Week 6 — Polish, Security, Notifications, Launch Prep

**Goal**: Production-ready.

**Deliverables**:
- Full mobile responsiveness across every screen (320px → 4K).
- Notifications: in-app toasts + email (resend.com) for deposit confirmed, withdrawal status, trade result digest, referral milestones.
- Support: in-app ticket form + Telegram/WhatsApp link.
- Security pass: rate limiting, CSRF, input validation, signed admin actions, secrets rotation.
- Performance pass: image optimization, code-splitting, ISR for marketing pages, Lighthouse ≥ 90.
- KYC stub (Sumsub-ready integration point; off by default).
- 2FA (TOTP) for admin accounts.
- E2E test suite (Playwright) covering: connect, sign-in, stake, trade, withdraw, refer.
- Final QA, bug bash, production deploy.

---

## 8. Weekly Demo Checklist

Each Friday the client receives:

1. Staging URL.
2. Short video walkthrough (≤ 3 min).
3. Changelog with screenshots.
4. List of items moved to next week + risks.
5. Open questions / decisions needed.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Exchange API rate limits | Cache prices via Redis (or in-memory LRU for dev); use multi-exchange fallback. |
| On-chain confirmations slow | Show pending state with optimistic UI; poll until N confirmations. |
| Regulatory ambiguity (yield product) | Marketing copy avoids guarantees; T&Cs disclaimer; admin can pause yield. |
| Wallet UX friction | Support multiple connectors via RainbowKit; clear chain-switch prompts. |
| Smart-contract custody | Defer to post-launch; Week 3 uses signed-treasury-wallet deposits with full audit trail. |

---

## 10. What's NOT in scope for the 6 weeks

- Native mobile apps (PWA only).
- Smart-contract escrow / vault contracts (planned for v2).
- Token issuance (VLX token roadmap is separate).
- Multi-currency stake (USDT only at launch; USDC/BUSD scoped for v2).
- Multi-language (Spanish + English at launch; more languages later).

---

End of plan — v1.0
