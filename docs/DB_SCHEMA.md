# Valtrix Capital — Database Schema

> Reflects `prisma/schema.prisma` (the authoritative source). Doc version 1.2 — reconciled with the shipped schema.

All monetary values stored as **`BigInt` micro-USDT** (1 USDT = 1,000,000). All timestamps are UTC.

---

## Entities

### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `walletAddress` | string | unique, lowercase |
| `email` | string? | optional |
| `username` | string? | optional display name |
| `role` | enum `UserRole` | `USER` / `ADMIN` (default `USER`) |
| `isActive` | bool | default `true`; admin can flip |
| `referrerId` | uuid? | upline user (level 1) |
| `referralCode` | string | unique, 8 chars |
| `earningsBalance` | bigint | available for withdrawal, micro-USDT (only source withdrawals draw from). Not used for copy-in. |
| `copyCashBalance` | bigint | idle copy-trading cash, micro-USDT. Copy-in spends this; copy-out returns here instantly. Funded by admin credit in v1. |
| `lockedCapital` | bigint | sum of active stake principal; never auto-returned to the user |
| `totalEarned` | bigint | lifetime earnings (passive + trade bonus + commissions), capped at `payoutCap` |
| `payoutCap` | bigint | 2× `lockedCapital`, recalculated on each new stake |
| `accountGranted` | bool | true for company-sponsored (granted) accounts |
| `withdrawalUnlocked` | bool | granted accounts can withdraw only once unlock rules are met |
| `withdrawalRule` | json? | unlock-volume rule for a granted account |
| `unlockDirectVolume` | bigint | real direct-deposit volume credited for unlock rules |
| `unlockLevel1Volume` / `unlockLevel2Volume` | bigint | real deposit volume from L1 / L2 downline |
| `createdAt` / `updatedAt` | timestamp | |

### `Stake`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `amount` | bigint | micro-USDT |
| `network` | enum `Network` | `BSC` / `POLYGON` |
| `currency` | enum `Currency` | `USDT` |
| `depositId` | uuid? FK → Deposit | unique; the on-chain deposit that funded it (null for sponsored) |
| `source` | enum `StakeSource` | `ON_CHAIN` (real) / `COMPANY_SPONSORED` (admin grant) |
| `status` | enum `StakeStatus` | `ACTIVE` / `COMPLETED` (payout cap hit) / `CANCELED` |
| `startedAt` | timestamp | |
| `completedAt` | timestamp? | |

### `Trade`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `pair` | string | e.g. `BTCUSDT` |
| `direction` | enum `Direction` | `UP` / `DOWN` |
| `entryPrice` | decimal(20,8) | |
| `exitPrice` | decimal(20,8)? | null while open |
| `durationSec` | int | 60, 120, 180, 300 |
| `openedAt` | timestamp | |
| `resolvedAt` | timestamp? | |
| `result` | enum `TradeResult`? | `WIN` / `LOSS` |
| `bonusAppliedBps` | int | +10 bps per win written here for audit |
| `capitalSnapshotAtWin` | bigint | capital active at resolve time (basis for the win bonus) |
| `bonusCredited` | bigint | operational bonus actually credited for this win (micro-USDT) |

### `DailyYieldRecord`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `date` | date | UTC date |
| `baseRateBps` | int | default 30 (0.3%) |
| `winsCount` | int | 0–7 |
| `bonusRateBps` | int | winsCount × 10 |
| `totalRateBps` | int | base + bonus, ≤ 100 |
| `capitalSnapshot` | bigint | locked capital at accrual time |
| `creditedAmount` | bigint | totalRateBps × capital / 10000 |
| `createdAt` | timestamp | |

Unique constraint: (`userId`, `date`).

### `Referral`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | downline |
| `uplineId` | uuid FK → User | upline at that level |
| `level` | int (1-8) | |
| `createdAt` | timestamp | |

Unique (`userId`, `level`).

### `Commission`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `beneficiaryId` | uuid FK → User | upline that earns |
| `sourceUserId` | uuid FK → User | the user whose earnings triggered it |
| `level` | int (1-8) | |
| `rateBps` | int | commission rate at the time |
| `amount` | bigint | micro-USDT |
| `sourceYieldId` | uuid? FK → DailyYieldRecord | set when the source was passive yield |
| `sourceTradeId` | uuid? FK → Trade | set when the source was a trade-win bonus |
| `createdAt` | timestamp | |

### `Deposit`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `network` | enum `Network` | |
| `currency` | enum `Currency` | |
| `amount` | bigint | micro-USDT |
| `fromAddress` | string | sender wallet |
| `toAddress` | string | treasury |
| `txHash` | string | on-chain hash |
| `confirmations` | int | |
| `status` | enum `TxStatus` | `PENDING` / `CONFIRMED` / `FAILED` |
| `detectedAt` | timestamp | |
| `confirmedAt` | timestamp? | |

Unique: `txHash`.

### `Withdrawal`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `network` | enum `Network` | |
| `currency` | enum `Currency` | |
| `amount` | bigint | requested gross, micro-USDT |
| `fee` | bigint | `withdrawalFeeBps` of amount (default 4 %) |
| `netAmount` | bigint | amount − fee |
| `toAddress` | string | user's wallet |
| `status` | enum `WithdrawalStatus` | `REQUESTED` / `APPROVED` / `SENT` / `CONFIRMED` / `REJECTED` |
| `txHash` | string? | filled after broadcast |
| `requestedAt` | timestamp | |
| `processedAt` | timestamp? | |

### `BotOperation`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `pair` | string | |
| `direction` | enum `Direction` | |
| `volume` | bigint | display micro-USDT |
| `pnl` | bigint | display profit micro-USDT |
| `pnlBps` | int | for "+1.25 %" displays |
| `fakeTxHash` | string | deterministic, looks real |
| `network` | enum `Network` | for explorer URL prefix |
| `executedAt` | timestamp | |

### `AdminAction`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `adminId` | uuid FK → User | |
| `targetUserId` | uuid? FK → User | |
| `action` | enum `AdminActionType` | see Enums below (activate, adjust balance, withdrawal decisions, config/profile/sponsorship updates, account deletion) |
| `payload` | json | before/after diff |
| `createdAt` | timestamp | |

### `AppConfig`  (singleton row)
| Field | Type | Notes |
|---|---|---|
| `id` | int = 1 | |
| `baseYieldBps` | int | default 30 (0.3%) |
| `bonusPerWinBps` | int | default 10 (0.1%) |
| `maxTradesPerDay` | int | default 7 (tier ceiling) |
| `maxDailyYieldBps` | int | default 100 (1%) |
| `withdrawalFeeBps` | int | default **400** (4%) |
| `commissionRatesBps` | int[] | length **8**, default `[2000,1000,1000,1000,500,500,500,500]` |
| `minStake` | bigint | 15 USDT (`15000000`) |
| `maxStake` | bigint | 100,000 USDT (`100000000000`) |
| `minWithdrawal` | bigint | **1 USDT** (`1000000`) |
| `allowedPairs` | string[] | `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`, `MATICUSDT` |
| `updatedAt` | timestamp | |

### Additional models (see `prisma/schema.prisma` for full detail)

| Model | Purpose |
|---|---|
| `TreasuryState` | Per-network (`bscBalance` / `polygonBalance`) treasury balances (singleton, id=1). |
| `TreasuryDeposit` | Recorded treasury inflows with confirmation tracking. |
| `TreasuryWithdrawal` | Treasury outflows; `kind` = `MANUAL` / `USER_PAYOUT`; `userWithdrawalId` unique (prevents double-payout). |
| `AuthNonce` | SIWE sign-in nonces (DB-backed, with in-memory fallback). |
| `PlatformBroadcast` | Admin broadcasts / announcements. |
| `InboxNotification` | In-app notifications (audience `USER` / `ADMIN`, deduped). |
| `SupportTicket` / `SupportTicketReply` / `SupportTicketAttachment` | Support inbox with threaded replies + attachments. |
| `SponsorTermsVersion` / `SponsorTermsAcceptance` | Versioned sponsor terms and per-user acceptance records. |
| `AccountDeletionRequest` | Account-deletion workflow (request → grace → processed). |
| `SponsorshipDurationRule` / `SponsorshipPeriod` | Sponsorship duration tiers and active sponsorship periods. |

---

## Enums

```
UserRole                = USER | ADMIN
Network                 = BSC | POLYGON
Currency                = USDT
StakeStatus             = ACTIVE | COMPLETED | CANCELED
StakeSource             = ON_CHAIN | COMPANY_SPONSORED
Direction               = UP | DOWN
TradeResult             = WIN | LOSS
TxStatus                = PENDING | CONFIRMED | FAILED
WithdrawalStatus        = REQUESTED | APPROVED | SENT | CONFIRMED | REJECTED
AdminActionType         = ACTIVATE | DEACTIVATE | ADJUST_BALANCE | APPROVE_WITHDRAWAL
                        | REJECT_WITHDRAWAL | UPDATE_CONFIG | UPDATE_SPONSOR_TERMS
                        | UPDATE_USER_PROFILE | PROCESS_ACCOUNT_DELETION | UPDATE_SPONSORSHIP
SponsorTermsStatus      = DRAFT | ACTIVE | ARCHIVED
AccountDeletionStatus   = REQUESTED | GRACE_PERIOD | PROCESSING | COMPLETED | CANCELLED
SponsorshipPeriodStatus = ACTIVE | EXPIRING_SOON | EXPIRED | RENEWED | SUSPENDED
                        | REQUIREMENTS_MET | REQUIREMENTS_FAILED
TreasuryDepositStatus   = CONFIRMING | CONFIRMED
TreasuryWithdrawalKind  = MANUAL | USER_PAYOUT
SupportTicketStatus     = OPEN | PENDING | RESOLVED | CLOSED
SupportTicketCategory   = DEPOSIT | WITHDRAWAL | TRADING | REFERRALS | ACCOUNT | OTHER
InboxAudience           = USER | ADMIN
```

---

## Key Invariants (enforced in service layer + DB constraints)

1. `Trade` insertion checks `count(today) < maxSimultaneousTrades(capital)` (capital-tiered: 3 / 5 / 7).
2. `DailyYieldRecord.totalRateBps = baseRateBps + bonusRateBps`; base + all wins ≤ `maxDailyYieldBps` (1%) at the 7-trade tier.
3. `User.totalEarned ≤ User.payoutCap` (= 2× `lockedCapital`). When reached → all active stakes flip to `COMPLETED`. Every earnings credit is clamped to the remaining cap room.
4. Withdrawals draw only from `earningsBalance`; `Withdrawal.amount ≤ User.earningsBalance` at creation, reserved in a DB transaction. **Principal (`lockedCapital`) is never a withdrawal source and is not auto-returned.**
5. `Referral` chain is built up to **8 levels** by walking `referrerId` until null or depth 8.
6. Only **real deposited capital** (`ON_CHAIN` stakes / confirmed deposits) generates upline commissions and counts toward withdrawal-unlock volume; `COMPANY_SPONSORED` capital does not.
7. Granted accounts (`accountGranted`) can withdraw only after their `withdrawalRule` unlock-volume requirements are met (`withdrawalUnlocked`).
8. Financial mutations happen inside Prisma `$transaction` blocks; `TreasuryWithdrawal.userWithdrawalId` is unique to prevent double payouts.

---

End of schema doc — v1.1 (reconciled with `prisma/schema.prisma`)
