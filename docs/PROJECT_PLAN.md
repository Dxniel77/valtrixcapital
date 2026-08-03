# Valtrix Capital — 6-Week Development Plan

> **Project**: Valtrix Capital — Web3 Trading & Staking Platform
> **Networks**: BNB Smart Chain (BEP20) + Polygon
> **Timeline**: 6 weeks (1 demo milestone per week)
> **Document version**: 1.1 (reconciled with shipped implementation)

---

## 1. Executive Summary

Valtrix Capital is a Web3-native trading and yield platform where users:

1. Connect a wallet (MetaMask, Trust Wallet, WalletConnect-compatible) on **BSC (BEP20)** and **Polygon**.
2. Commit capital into **flexible stakes** (no fixed packages) from **$15 to $100,000** (USDT). Deposited capital is sent to a **project treasury wallet** and recorded as the user's locked capital — this is a **treasury-backed managed model, not on-chain escrow/staking**.
3. Participate in **live trading operations** on multiple pairs (BTC, ETH, SOL, XRP, etc.) sourced from **Binance + Bybit** market data.
4. Earn a **base yield of 0.3% per day** on their locked capital, plus a **+0.1% bonus per winning trade** (cap **1%/day** when all 7 are won).
5. Locked capital is **never returned to the user's withdrawable balance** — it stays working. Earnings accrue into the **earnings balance** up to a **payout cap of 2× locked capital** (`totalEarned ≤ 2× lockedCapital`), at which point active stakes flip to `COMPLETED`.
6. Build an **8-level referral network** that earns commissions on downline earnings.
7. Withdraw **earnings** at any time (default **4% fee**), settled from the treasury with an automatic on-chain payout, verifiable on **BscScan / PolygonScan**.

The product also features a **Bot Trading** module that surfaces simulated/mirrored institutional operations (drawn from real exchange data) with BscScan-style transaction hashes — purely a presentation/transparency layer; **the actual trading is real market-data driven** as clarified by the client.

> **Model note:** There is no user-facing "unstake" or principal-withdrawal flow. Withdrawals draw exclusively from `earningsBalance`. Principal (`lockedCapital`) is only reduced/returned through a deliberate admin/treasury operation; it is not automatically released when the payout cap is reached.

---

## 2. Clarifications from Client Conversation

| Topic | Client Decision |
|---|---|
| Investment packages | **No fixed packages** — user decides the amount. Multiple stakes per user are **summed** to form the trading capital base. |
| Custody model | **Treasury-backed managed model** (Week 3 decision, retained): deposits go to a project treasury wallet; smart-contract escrow deferred to v2. Principal is not user-withdrawable. |
| Single active investment | Only **one active investment plan** per person; new stakes are added to the same active plan. |
| Trading | **Real-market data** (not simulated). 7 quick trades/day across user-selected pairs. |
| Pairs | Multiple: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT, MATIC/USDT, and more. |
| Networks | **BSC + Polygon**. |
| Bot Trading | Public feed of trades extracted from external exchanges with **BscScan verification links**. |
| Branding | "Valtrix Capital" — silver + gold dark theme, modern & clean (more polished than reference mock). |

---

## 3. Business Logic Specification

### 3.1 Staking / Capital Logic

- **Minimum stake**: 15 USDT
- **Maximum stake**: 100,000 USDT
- **One active investment per user**; additional deposits are merged into the active plan (`lockedCapital` is incremented).
- **Payout cap**: earnings accrue until `totalEarned` reaches **2× `lockedCapital`** (`payoutCap = lockedCapital × 2`, recomputed on each new stake). When `totalEarned ≥ payoutCap`, active stakes flip to `COMPLETED`.
- **Principal is not auto-returned**: `lockedCapital` is never credited back to `earningsBalance` on completion, and there is no user unstake flow. Only earnings are withdrawable. Returning principal is an explicit admin/treasury action.
- **Stake sources** (`StakeSource`): `ON_CHAIN` (real user deposit, linked to a `Deposit`) or `COMPANY_SPONSORED` (admin-granted capital with no deposit). Only real, deposited capital counts toward referral commissions and withdrawal-unlock volume.
- **Stake currency**: USDT (BEP20) and USDT (Polygon) at launch.

### 3.2 Daily Yield Logic

| Component | Value |
|---|---|
| Base daily yield | **0.3 %** (`baseYieldBps = 30`) of locked capital, accrued on a rolling interval |
| Bonus per winning trade | **+0.1 %** (`bonusPerWinBps = 10`) of capital at resolve time, credited instantly |
| Max daily / simultaneous trades | **capital-tiered**: 3 (< $501), 5 ($501–$1,000), 7 (≥ $1,001) |
| Max daily yield (all wins) | **1.0 %** (`maxDailyYieldBps = 100`) at the 7-trade tier |
| Min daily yield (no wins) | **0.3 %** (base only) |
| Reset cadence | Trade counting is per UTC day |

**Implementation notes**:
- **Passive yield** (`lib/services/yield.ts`) accrues the base 0.3% per interval after an initial confirmation delay, with catch-up for missed periods (capped). Interval and delay default to 24h and are env-tunable (`YIELD_ACCRUAL_INTERVAL_MS`, `PASSIVE_YIELD_DELAY_MS`) for testing.
- **Trade-win bonus** (`lib/services/trades.ts`) is an *operational* credit paid instantly on each win, sized on capital active at resolve time; it is not part of the passive record.
- The **daily trade limit is tiered by capital** (see table) via `maxSimultaneousTrades`; the flat `maxTradesPerDay=7` config is the tier ceiling, not a per-user flat cap.
- Every credit (passive or bonus) is clamped so `totalEarned` never exceeds `payoutCap`.

**Examples**:
- User has 1,000 USDT locked (5-trade tier). Wins 3 trades → 0.3% base + 3 × 0.1% = **9 USDT** that day.
- User has 5,000 USDT locked (7-trade tier). Wins 7/7 → 1% = **50 USDT** that day.

### 3.3 Referral System (8 Levels)

- Each user gets a unique referral link.
- Commission rates are configurable (`AppConfig.commissionRatesBps`, 8 slots). **Shipped defaults**:

| Level | Default Commission |
|---|---|
| 1 | 20 % |
| 2 | 10 % |
| 3 | 10 % |
| 4 | 10 % |
| 5 | 5 % |
| 6 | 5 % |
| 7 | 5 % |
| 8 | 5 % |

- Commissions fire on **both** a downline's **daily passive yield and trade-win bonuses**, routed to each upline's **earnings balance** (which counts toward their own payout cap).
- **Commissionable scaling**: only the portion of a downline's earnings backed by **real deposited capital** generates upline commissions (`commissionableAmountMicro`). Earnings on `COMPANY_SPONSORED` capital do not pay upline. A downline generates upline commissions only when they have real deposit volume.

### 3.4 Withdrawals

- Available anytime from **earnings balance** (never from principal).
- **Default 4% fee** (`withdrawalFeeBps = 400`, admin-editable). Fee is server-derived from config — not client-supplied.
- **Minimum withdrawal**: `minWithdrawal` config, default **1 USDT**.
- On request, the gross amount is reserved from `earningsBalance` in a transaction, treasury liquidity is checked, and an **automatic on-chain payout** is attempted; on failure the withdrawal is auto-rejected and the balance refunded.
- Admins can also drive status transitions (`APPROVED / REJECTED / SENT / CONFIRMED`); confirmation deducts the treasury and records a `TreasuryWithdrawal` (`kind = USER_PAYOUT`, unique per withdrawal to prevent double-spend).
- **Company-sponsored (granted) accounts** are additionally gated: withdrawals stay locked until the account's real-deposit **unlock-volume rules** (`withdrawalRule`) are met (`withdrawalUnlocked`).
- Each withdrawal generates a transaction record + on-chain tx hash visible on BscScan / PolygonScan.

### 3.5 Admin Capabilities

- User management: view, activate/deactivate, edit profile (username/email), change referrer/sponsor.
- **Manual balance adjustments** (audit-logged): `WITHDRAWABLE` (± earnings balance) or `STAKING` (positive-only capital grant that creates a `COMPANY_SPONSORED` stake). *Note:* there is currently no admin control to decrease `lockedCapital`/return principal.
- Withdrawal queue: approve / reject / confirm, with treasury deduction and audit trail.
- **Treasury management**: record inflows, manual outflows, per-network balances.
- **Sponsorship program**: grant sponsored accounts, duration rules, sponsorship periods, and versioned **sponsor terms** (with user acceptance tracking).
- **Account-deletion** workflow (request → grace period → processed).
- Support ticket inbox + platform broadcasts / notifications.
- Configure: yield rates, commission tiers (8 levels), fees, min/max stake, min withdrawal, allowed pairs.
- Every mutating admin action is written to `AdminAction` for audit.

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
