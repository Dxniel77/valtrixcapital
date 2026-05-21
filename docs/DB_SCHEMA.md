# Valtrix Capital — Database Schema

> Authoritative model. Implemented in `prisma/schema.prisma`.

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
| `earningsBalance` | bigint | available for withdrawal, micro-USDT |
| `lockedCapital` | bigint | sum of active stakes |
| `totalEarned` | bigint | lifetime profit |
| `payoutCap` | bigint | 2× `lockedCapital`, recalculated on each new stake |
| `createdAt` / `updatedAt` | timestamp | |

### `Stake`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → User | |
| `amount` | bigint | micro-USDT |
| `network` | enum `Network` | `BSC` / `POLYGON` |
| `currency` | enum `Currency` | `USDT` |
| `depositId` | uuid FK → Deposit | the on-chain deposit that funded it |
| `status` | enum `StakeStatus` | `ACTIVE` / `COMPLETED` (200% hit) / `CANCELED` |
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
| `level` | int (1-7) | |
| `createdAt` | timestamp | |

Unique (`userId`, `level`).

### `Commission`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `beneficiaryId` | uuid FK → User | upline that earns |
| `sourceUserId` | uuid FK → User | the user whose yield triggered it |
| `level` | int (1-7) | |
| `rateBps` | int | commission rate at the time |
| `amount` | bigint | micro-USDT |
| `sourceYieldId` | uuid FK → DailyYieldRecord | |
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
| `fee` | bigint | 3 % of amount |
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
| `action` | enum `AdminActionType` | `ACTIVATE` / `DEACTIVATE` / `ADJUST_BALANCE` / `APPROVE_WITHDRAWAL` / `UPDATE_CONFIG` … |
| `payload` | json | before/after diff |
| `createdAt` | timestamp | |

### `AppConfig`  (singleton row)
| Field | Type | Notes |
|---|---|---|
| `id` | int = 1 | |
| `baseYieldBps` | int | default 30 |
| `bonusPerWinBps` | int | default 10 |
| `maxTradesPerDay` | int | default 7 |
| `maxDailyYieldBps` | int | default 100 |
| `withdrawalFeeBps` | int | default 300 |
| `commissionRatesBps` | int[] | length 7 |
| `minStake` | bigint | 15 USDT |
| `maxStake` | bigint | 100,000 USDT |
| `minWithdrawal` | bigint | 10 USDT |
| `allowedPairs` | string[] | `BTCUSDT`, `ETHUSDT`, … |
| `updatedAt` | timestamp | |

---

## Enums

```
UserRole         = USER | ADMIN
Network          = BSC | POLYGON
Currency         = USDT
StakeStatus      = ACTIVE | COMPLETED | CANCELED
Direction        = UP | DOWN
TradeResult      = WIN | LOSS
TxStatus         = PENDING | CONFIRMED | FAILED
WithdrawalStatus = REQUESTED | APPROVED | SENT | CONFIRMED | REJECTED
AdminActionType  = ACTIVATE | DEACTIVATE | ADJUST_BALANCE | APPROVE_WITHDRAWAL | REJECT_WITHDRAWAL | UPDATE_CONFIG
```

---

## Key Invariants (enforced in service layer + DB constraints)

1. `Trade` insertion checks `count(today) < AppConfig.maxTradesPerDay`.
2. `DailyYieldRecord.totalRateBps = baseRateBps + bonusRateBps ≤ maxDailyYieldBps`.
3. `User.totalEarned ≤ User.payoutCap`. When equal → all active stakes flip to `COMPLETED`.
4. `Withdrawal.amount ≤ User.earningsBalance` at creation; balance reserved in a DB transaction.
5. `Referral` chain is built up to 7 levels by walking `referrerId` until null or depth 7.
6. All financial mutations happen inside Prisma `$transaction` blocks with row-level locks (`SELECT FOR UPDATE`).

---

End of schema doc — v1.0
