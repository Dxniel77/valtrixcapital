# IB Net Deposit — Requirements

> Status: **Implemented (Aug 2026)** — Net Deposit + IB monitor live alongside yield-boost strategies  
> Scope: real-money deposits only (not sponsored / company capital)

---

## 1. Goal

Give selected users (**IBs / Introducing Brokers**) an optional **extra** benefit:

- A **one-time bonus** on each qualifying **referral deposit** (“Net Deposit”)
- That bonus credits the IB’s earnings and **accelerates progress toward the same 200% payout cap**
- It does **not** raise the 200% cap or pay the IB a share of the client’s passive/trading profits

Normal **8-level referral commissions on network earnings** continue as today. Net Deposit is **additional**, only when Carlos enables it for that IB.

---

## 2. Identity

| Question | Answer |
|----------|--------|
| How is an IB identified? | By **platform account / wallet** (admin sees username/alias) |
| Separate IB entity? | No — same `User` record with IB Net Deposit config assigned |

---

## 3. What Net Deposit is

| Rule | Detail |
|------|--------|
| Trigger | A **confirmed real (on-chain) deposit** by a downline user |
| Basis amount | The **deposit amount** (USDT) of that deposit |
| Payout | **Once per deposit** — no repeat on the same deposit |
| Recipient | The upline **IB** (if configured and levels match) |
| Credit type | Bonus to IB `earningsBalance` + `totalEarned` (clamped by `payoutCap` = 2× capital) |
| Not paid on | Passive yield, trade bonuses, or other earnings of the client |
| Not paid on | Company-sponsored / admin-granted capital (not real deposits) |

**Note:** Product language says “Net Deposit”; agreed behavior is **% of each qualifying deposit amount**, not deposit-minus-withdrawals.

---

## 4. Admin configuration (per IB)

Carlos configures **independently per IB**:

1. **Enable / disable** Net Deposit for that user  
2. **Level 1 %** — commission on deposits by **direct** referrals  
3. **Level 2 %** — optional; commission on deposits by **indirect** (level-2) referrals  
4. Depth mode:
   - **L1 only** — pay only level-1 deposits  
   - **L1 + L2** — pay both (each with its own %)

Examples:

- IB A: **3% L1 only** → every direct referral deposit credits IB A with 3% of that deposit  
- IB B: **3% L1 + 2% L2** → direct deposits 3%, second-level deposits 2%

Not every user is an IB. Not every IB gets Net Deposit. Rates are **not** global — they are **negotiated / set per IB**.

---

## 5. Relationship to existing features

| Feature | Behavior with Net Deposit |
|---------|---------------------------|
| Normal referral commissions (earnings) | **Keep** — IB still earns network commissions as usual |
| Old IB yield-boost strategy (extra passive / trade bps) | **Retired** — UI and bonuses disabled; DB rows kept; Net Deposit is the IB benefit |
| Partial withdrawal release | Unchanged — still controls how much sponsored/locked users can withdraw |
| 200% payout cap | Unchanged — Net Deposit bonus is clamped like other earnings credits |

---

## 6. Real money only

- Count only **confirmed on-chain deposits** (`ON_CHAIN` / deposit-backed stakes)  
- Do **not** pay Net Deposit when admin grants **sponsored / company capital**  
- Downstream user may be any normal depositor; the **payee** is the configured IB upline

---

## 7. Visibility (IB badge)

- Admin user list + user detail + IB monitor: **IB** badge when marked as Introducing Broker  
- Net Deposit config is visible to admin on the user (enabled, L1%, L2%, depth) and on `/admin/ib`

---

## 8. Non-goals

- Paying IB a % of client **passive or trading profits** under this program  
- Same Net Deposit rates for all IBs by default  
- Raising the investor’s or IB’s **200%** ceiling  
- Treating sponsored capital grants as deposits  

---

## 9. Acceptance criteria (high level)

1. Admin can enable Net Deposit on a specific user and set L1% and optional L2%.  
2. Admin can choose L1-only or L1+L2 for that user.  
3. On confirmed real deposit by a L1 (or L2 if enabled) downline, IB receives `depositAmount × rate` once.  
4. Bonus increases IB earnings toward 200%; never beyond `payoutCap`.  
5. No Net Deposit on sponsored capital grants.  
6. Users without Net Deposit config receive nothing from this path.  
7. Normal referral earnings commissions still run as today.  
8. Audit log records Net Deposit credits (IB, source user, deposit, level, rate, amount).

---

## 10. Open implementation notes (defaults)

Agreed product defaults unless Carlos says otherwise later:

- **No back-pay** of historical deposits — only deposits after config is active  
- **No automatic clawback** if a deposit is later disputed (handle manually / later if needed)  
- Rates stored in **basis points** (e.g. 3% = 300 bps) for consistency with platform config  
- **Audit:** every credit is stored in `IbNetDepositCredit` (IB, source, deposit, level, rate, amount). Admin UI audit also writes `IB_NET_DEPOSIT_CREDIT` using `ADMIN_WALLETS` or any `ADMIN` role user.

---

## 11. Source

- Carlos: IB Net Deposit requirements (Aug 2026)  
- Daniel: IB keeps normal network earnings; Net Deposit is optional extra per IB; L1 or L1+L2; % per IB; real deposits only; accelerates 200%  
