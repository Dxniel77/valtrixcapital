# Valtrix Capital — Weekly Demo Breakdown

> What the client sees at the end of each Friday.

---

## Week 1 — "It looks and feels like Valtrix"

**Live demo URL** with:

- Marketing landing page (hero with logo, value props, footer).
- Connect Wallet button → MetaMask / WalletConnect modal → BSC or Polygon.
- Network switcher (BSC ↔ Polygon) inside the header.
- Sign-In With Ethereum → enter the dashboard shell.
- Dashboard shell with all 9 sidebar items (Dashboard, Bot Trading, Trade, Portfolio, History, Referrals, Wallet, Profile, Support) navigable — content is "Coming next week" placeholders styled as part of the design system.
- Visual identity locked: logo, gold/silver palette, typography, components — all on brand.

**Deliverable artifacts**:
- Staging URL.
- Loom walkthrough (≤ 3 min).
- This doc + DESIGN_SYSTEM.md printed as PDF.

---

## Week 2 — "Trading is alive"

- Trade screen with real charts (BTC, ETH, SOL, XRP, BNB, MATIC).
- 1m / 5m / 15m / 1h / 4h / 1D timeframes.
- Live ticker (Binance WS).
- Buy ↑ / Sell ↓ buttons with 1 / 2 / 3 / 5-minute duration selector.
- "Daily Attempts" widget (7/7, countdown to UTC reset).
- Open positions list + result resolution (WIN/LOSS) at expiry.
- Trade history table with filters.

---

## Week 3 — "Capital is working"

- "Start Staking" CTA opens the deposit flow (on BSC or Polygon).
- After confirmed deposit, capital appears as "Active Capital" on Portfolio.
- Daily yield engine runs at 00:00 UTC: writes `DailyYieldRecord`, credits earnings, updates % to 200% cap.
- Portfolio screen: total capital, total earned, progress bar to 200%, history of daily accruals.
- Multiple stakes per user are summed for trade-size calculations.

---

## Week 4 — "Network + Bot Feed"

- Referrals screen: link, QR, share buttons, 8-level downline tree, commissions earned per level, active vs inactive flags.
- Commission engine credits uplines automatically on each `DailyYieldRecord`.
- Bot Trading screen: live operations feed (configurable cadence), each row with pair, direction, volume, P/L %, timestamp, **BscScan link** (or PolygonScan).
- Dashboard top strip: "Company Profits (Today / Week / All-time)".

---

## Week 5 — "Money in, money out"

- Wallet screen: deposit addresses (BSC/Polygon), recent transactions.
- Withdrawal flow: amount → 3% fee preview → submit → status tracker.
- Full History page with filters (deposits, withdrawals, trades, commissions, yield).
- Admin panel at `/admin`:
  - Users (search, sort, activate/deactivate, adjust balance).
  - Movements (all financial events).
  - Network browser.
  - Settings (yield rates, commissions, fees, allowed pairs).
  - Audit log.

---

## Week 6 — "Production"

- Mobile responsive across all screens.
- In-app + email notifications (deposit confirmed, withdrawal status, daily yield digest, referral milestones).
- Support center: ticket form + Telegram/WhatsApp link.
- 2FA for admins.
- Rate limiting, CSRF, input validation passes.
- Performance: Lighthouse ≥ 90 across the board.
- Playwright E2E smoke tests in CI.
- Final QA and production deploy.

---

End of weekly breakdown — v1.0
