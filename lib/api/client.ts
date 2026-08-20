"use client";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: { error?: string; code?: string },
  ) {
    super(payload.error ?? `Request failed (${status})`);
    this.name = "ApiError";
  }
}

export interface HealthResponse {
  ok: boolean;
  database: boolean;
  version: string;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data;
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export async function fetchCurrentUser() {
  return apiFetch<{
    backend: boolean;
    user: {
      id: string;
      walletAddress: string;
      username: string | null;
      earningsBalance: number;
      copyCashBalance?: number;
      lockedCapital: number;
      totalEarned: number;
      payoutCap: number;
      isActive: boolean;
      referralCode: string;
      registrationSource: "referral" | "direct";
      referrerWallet: string | null;
      referrerUsername: string | null;
      directReferrals: number;
      role: "USER" | "ADMIN";
      accountGranted: boolean;
      withdrawalUnlocked: boolean;
      withdrawalAllowance?: number;
      ibStrategyId?: string | null;
      ibBoost?: {
        strategyId: string;
        name: string;
        passiveBonusBps: number;
        tradeBonusExtraBps: number;
      } | null;
      isIb?: boolean;
      avatarUrl?: string | null;
      ibNetDeposit?: {
        enabled: boolean;
        level1DepositBps: number;
        level2DepositBps: number;
        notes: string;
      } | null;
      withdrawalRule: import("@/lib/admin/withdrawal-eligibility").WithdrawalRule | null;
      realCapital: number;
      companyCapital: number;
      directSalesVolume: number;
      levelVolumes: number[];
      createdAt: string;
    } | null;
  }>("/api/users/me");
}

export async function updateCurrentUsername(
  username: string,
  referralCode?: string | null,
) {
  return apiFetch<{
    user: {
      id: string;
      walletAddress: string;
      username: string | null;
      referrerWallet: string | null;
      registrationSource: "referral" | "direct";
    };
  }>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify({
      username,
      ...(referralCode ? { referralCode } : {}),
    }),
  });
}

export async function fetchBalanceAdjustments(sinceMs = 0) {
  return apiFetch<{
    backend: boolean;
    adjustments: Array<{
      id: string;
      amount: number;
      note: string;
      target: "WITHDRAWABLE" | "STAKING" | "COPY";
      createdAt: string;
    }>;
  }>(`/api/users/me/adjustments?since=${sinceMs}`);
}

export async function adminAdjustBalance(
  userId: string,
  delta: number,
  note: string,
  target: "WITHDRAWABLE" | "STAKING" | "COPY" = "WITHDRAWABLE",
) {
  return apiFetch<{
    ok: true;
    user: {
      earningsBalance: number;
      copyCashBalance: number;
      lockedCapital: number;
    };
  }>(`/api/admin/users/${userId}/adjust-balance`, {
    method: "POST",
    body: JSON.stringify({ delta, note, target }),
  });
}

export async function adminSetUserActive(userId: string, isActive: boolean) {
  return apiFetch<{
    ok: true;
    user: {
      id: string;
      walletAddress: string;
      username: string | null;
      isActive: boolean;
    };
  }>(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function fetchAdminUsers() {
  return apiFetch<{
    backend: boolean;
    users: Array<{
      id: string;
      walletAddress: string;
      username: string | null;
      earningsBalance: number;
      copyCashBalance?: number;
      lockedCapital: number;
      totalEarned: number;
      isActive: boolean;
      role: "USER" | "ADMIN";
      registrationSource: "referral" | "direct";
      referrerWallet: string | null;
      referrerUsername: string | null;
      directReferrals: number;
      accountGranted: boolean;
      withdrawalUnlocked: boolean;
      withdrawalAllowance?: number;
      ibStrategyId?: string | null;
      ibBoost?: {
        strategyId: string;
        name: string;
        passiveBonusBps: number;
        tradeBonusExtraBps: number;
      } | null;
      isIb?: boolean;
      avatarUrl?: string | null;
      ibNetDeposit?: {
        enabled: boolean;
        level1DepositBps: number;
        level2DepositBps: number;
        notes: string;
      } | null;
      withdrawalRule: {
        mode: "direct_sales" | "network_levels" | "either";
        directSalesMin: number;
        level1VolumeMin: number;
        level2VolumeMin: number;
      } | null;
      realCapital: number;
      companyCapital: number;
      directSalesVolume: number;
      levelVolumes: number[];
      createdAt: string;
    }>;
  }>("/api/admin/users");
}

export async function fetchAdminMovements(limit = 500) {
  return apiFetch<{
    backend: boolean;
    movements: Array<{
      id: string;
      type: string;
      wallet: string;
      amount: number;
      network: string | null;
      status: string;
      timestamp: number;
      note?: string;
      yieldKind?: "operational" | "passive";
    }>;
  }>(`/api/admin/movements?limit=${limit}`);
}

export async function fetchAdminLeaders(period: "week" | "month" | "3months") {
  return apiFetch<{
    backend: boolean;
    rows: Array<{
      userId: string;
      wallet: string;
      alias: string;
      registrationSource: "referral" | "direct";
      isDirectAccount: boolean;
      total: number;
      operational: number;
      network: number;
      passive: number;
      tradesCount: number;
      winsCount: number;
      byLevel: Array<{ level: number; amount: number }>;
    }>;
    directAccounts: {
      accountCount: number;
      total: number;
      operational: number;
      network: number;
      passive: number;
      tradesCount: number;
      winsCount: number;
    };
  }>(`/api/admin/leaders?period=${encodeURIComponent(period)}`);
}

export async function fetchAdminReportsSummary(from: string, to: string) {
  return apiFetch<{
    ok: true;
    fromMs: number;
    toMs: number;
    summary: {
      inflow: number;
      outflow: number;
      net: number;
      pendingOutflow: number;
      depositCount: number;
      withdrawalCount: number;
      yieldPaid: number;
      tradeBonusPaid: number;
      referralCommissionPaid: number;
      withdrawalFeesEarned: number;
      withdrawalFees: Array<{
        id: string;
        wallet: string;
        gross: number;
        fee: number;
        net: number;
        network: string;
        processedAt: number;
      }>;
    };
  }>(`/api/admin/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export async function fetchUserTrades() {
  return apiFetch<{ backend: boolean; trades: import("@/lib/trade/trade-types").TradeDto[] }>(
    "/api/trades",
  );
}

export async function openTradeOnServer(input: {
  pair: string;
  direction: "UP" | "DOWN";
  entryPrice: number;
  durationSec: number;
}) {
  return apiFetch<{
    ok: true;
    trade: import("@/lib/trade/trade-types").TradeDto;
  }>("/api/trades", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resolveTradeOnServer(tradeId: string, exitPrice: number) {
  return apiFetch<{
    ok: true;
    trade: import("@/lib/trade/trade-types").TradeDto;
  }>(`/api/trades/${tradeId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ exitPrice }),
  });
}

export async function fetchUserPortfolio() {
  return apiFetch<{
    backend: boolean;
    portfolio: {
      earningsBalance: number;
      totalEarned: number;
      lockedCapital: number;
      stakes: Array<{
        id: string;
        amount: number;
        network: "BSC" | "POLYGON";
        status: string;
        txHash: string;
        createdAt: number;
        confirmedAt?: number;
      }>;
      pendingDeposit: {
        id: string;
        serverDepositId?: string;
        amount: number;
        network: "BSC" | "POLYGON";
        txHash: string;
        startedAt: number;
        confirmations: number;
        requiredConfirmations: number;
      } | null;
      dailyYields: Array<{
        id: string;
        date: string;
        capitalSnapshot: number;
        baseRateBps: number;
        bonusRateBps: number;
        totalRateBps: number;
        wins: number;
        losses: number;
        creditedAmount: number;
        createdAt: number;
      }>;
      withdrawals: Array<{
        id: string;
        network: "BSC" | "POLYGON";
        amount: number;
        fee: number;
        netAmount: number;
        toAddress: string;
        status: string;
        txHash: string | null;
        requestedAt: string;
        processedAt: string | null;
      }>;
    } | null;
  }>("/api/users/me/portfolio");
}

export async function advanceDepositOnServer(depositId: string) {
  return apiFetch<{ ok: true; deposit: { confirmations: number } }>(
    `/api/deposits/${depositId}/advance`,
    { method: "POST" },
  );
}

export async function confirmDepositOnServer(depositId: string) {
  return apiFetch<{ ok: true; deposit: unknown }>(
    `/api/deposits/${depositId}/confirm`,
    { method: "POST" },
  );
}

export async function fetchUserWithdrawals() {
  return apiFetch<{
    backend: boolean;
    withdrawals: Array<{
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      fee: number;
      netAmount: number;
      toAddress: string;
      status: string;
      txHash: string | null;
      requestedAt: string;
      processedAt: string | null;
    }>;
  }>("/api/withdrawals");
}

export async function createWithdrawalRequest(input: {
  network: "BSC" | "POLYGON";
  amount: number;
  toAddress: string;
}) {
  return apiFetch<{
    ok: true;
    withdrawal: {
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      fee: number;
      netAmount: number;
      toAddress: string;
      status: string;
      txHash: string | null;
      requestedAt: string;
      processedAt: string | null;
    };
  }>("/api/withdrawals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchTreasuryLiquidity() {
  return apiFetch<{
    backend: boolean;
    bscBalance: number;
    polygonBalance: number;
    totalBalance: number;
  }>("/api/treasury/liquidity");
}

export async function registerDepositRequest(input: {
  network: "BSC" | "POLYGON";
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  purpose?: "STAKING" | "COPY";
}) {
  return apiFetch<{
    ok: true;
    deposit: { id: string; confirmations: number; txHash: string };
  }>("/api/deposits", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function claimDepositByTxHash(input: {
  network: "BSC" | "POLYGON";
  txHash: string;
  purpose?: "STAKING" | "COPY";
}) {
  return apiFetch<{ ok: true; deposit: unknown }>("/api/deposits/claim", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchReferralSnapshot() {
  return apiFetch<{
    backend: boolean;
    snapshot: {
      downline: Array<{
        id: string;
        level: number;
        wallet: string;
        displayName: string;
        isActive: boolean;
        capital: number;
        realCapital: number;
        realDepositVolume: number;
        accountGranted: boolean;
        joinedAt: number;
        commissionsPaidToYou: number;
        directReferrals: number;
        networkReferrals: number;
        totalEarned: number;
      }>;
      commissions: Array<{
        id: string;
        level: number;
        sourceWallet: string;
        sourceYieldId: string | null;
        sourceTradeId: string | null;
        yieldDate: string;
        rateBps: number;
        amount: number;
        createdAt: number;
      }>;
      totalCommissions: number;
    } | null;
  }>("/api/referrals/me");
}

export async function fetchPendingWithdrawals() {
  return apiFetch<{
    backend: boolean;
    withdrawals: Array<{
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      fee: number;
      netAmount: number;
      toAddress: string;
      status: string;
      txHash: string | null;
      requestedAt: string;
      walletAddress: string;
    }>;
  }>("/api/withdrawals?scope=pending");
}

export async function adminUpdateWithdrawalStatus(input: {
  withdrawalId: string;
  status: "APPROVED" | "REJECTED" | "SENT" | "CONFIRMED";
  txHash?: string;
}) {
  return apiFetch<{ ok: true; withdrawal: unknown }>(
    "/api/withdrawals?admin=status",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function adminRetryWithdrawalPayout(withdrawalId: string) {
  return apiFetch<{ ok: true; txHash: string }>(
    "/api/withdrawals?admin=retry-payout",
    {
      method: "POST",
      body: JSON.stringify({ withdrawalId }),
    },
  );
}

export async function fetchPlatformConfig() {
  return apiFetch<{
    backend: boolean;
    config: {
      baseYieldBps: number;
      bonusPerWinBps: number;
      maxTradesPerDay: number;
      maxDailyYieldBps: number;
      withdrawalFeeBps: number;
      commissionRatesBps: number[];
      minStake: number;
      maxStake: number;
      minWithdrawal: number;
      allowedPairs: string[];
      updatedAt?: string;
    } | null;
  }>("/api/config/platform");
}

export async function updatePlatformConfig(
  patch: Partial<{
    baseYieldBps: number;
    bonusPerWinBps: number;
    maxTradesPerDay: number;
    maxDailyYieldBps: number;
    withdrawalFeeBps: number;
    commissionRatesBps: number[];
    minStake: number;
    maxStake: number;
    minWithdrawal: number;
    allowedPairs: string[];
  }>,
) {
  return apiFetch<{
    ok: true;
    config: NonNullable<Awaited<ReturnType<typeof fetchPlatformConfig>>["config"]>;
  }>("/api/config/platform", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function adminUpdateUserReferrer(
  userId: string,
  referrerQuery: string | null,
) {
  return apiFetch<{
    ok: true;
    user: {
      id: string;
      walletAddress: string;
      referrerWallet: string | null;
      referrerUsername: string | null;
      registrationSource: "referral" | "direct";
    };
  }>(`/api/admin/users/${userId}/referrer`, {
    method: "PATCH",
    body: JSON.stringify({ referrerQuery }),
  });
}

export async function adminProvisionUser(input: {
  walletAddress: string;
  username?: string | null;
  referrerWallet?: string | null;
  withdrawalRule?: {
    mode: "direct_sales" | "network_levels" | "either";
    directSalesMin: number;
    level1VolumeMin: number;
    level2VolumeMin: number;
  };
  initialActiveCapital?: number;
  requirementDeadlineDays?: number;
}) {
  return apiFetch<{
    ok: true;
    user: {
      id: string;
      walletAddress: string;
      username: string | null;
      referrerWallet: string | null;
    };
  }>("/api/admin/users/provision", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAdminAudit(limit = 200) {
  return apiFetch<{
    backend: boolean;
    audit: Array<{
      id: string;
      action: string;
      payload: unknown;
      actor: string;
      target: string | null;
      timestamp: number;
    }>;
  }>(`/api/admin/audit?limit=${limit}`);
}

export interface SupportAttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  url: string;
}

export interface SupportTicketReplyDto {
  id: string;
  body: string;
  isStaff: boolean;
  adminId: string | null;
  createdAt: number;
  attachments: SupportAttachmentDto[];
}

export interface SupportTicketDto {
  id: string;
  name: string;
  email: string;
  wallet: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  replies: SupportTicketReplyDto[];
  attachments: SupportAttachmentDto[];
}

export async function adminFetchSupportTickets(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{
    backend: boolean;
    tickets: SupportTicketDto[];
  }>(`/api/admin/support/tickets${qs}`);
}

export async function adminFetchSupportTicket(id: string) {
  return apiFetch<{
    backend: boolean;
    ticket: SupportTicketDto;
  }>(`/api/admin/support/tickets/${encodeURIComponent(id)}`);
}

export async function adminUpdateSupportTicketStatus(id: string, status: string) {
  return apiFetch<{
    ok: true;
    ticket: SupportTicketDto;
  }>(`/api/admin/support/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function adminReplySupportTicket(input: {
  ticketId: string;
  message: string;
  notifyUser?: boolean;
  files?: File[];
}) {
  const form = new FormData();
  form.set("message", input.message);
  form.set("notifyUser", String(input.notifyUser ?? true));
  for (const file of input.files ?? []) {
    form.append("files", file);
  }

  return apiFetch<{
    ok: true;
    ticket: SupportTicketDto;
  }>(
    `/api/admin/support/tickets/${encodeURIComponent(input.ticketId)}/reply`,
    {
      method: "POST",
      body: form,
    },
  );
}

export async function fetchUserSupportTickets() {
  return apiFetch<{
    backend: boolean;
    tickets: SupportTicketDto[];
  }>("/api/support/tickets");
}

export async function fetchUserSupportTicket(id: string) {
  return apiFetch<{
    backend: boolean;
    ticket: SupportTicketDto;
  }>(`/api/support/tickets/${encodeURIComponent(id)}`);
}

export async function userReplySupportTicket(input: {
  ticketId: string;
  message: string;
  files?: File[];
}) {
  const form = new FormData();
  form.set("message", input.message);
  for (const file of input.files ?? []) {
    form.append("files", file);
  }

  return apiFetch<{
    ok: true;
    ticket: SupportTicketDto;
  }>(`/api/support/tickets/${encodeURIComponent(input.ticketId)}/reply`, {
    method: "POST",
    body: form,
  });
}

export async function fetchAdminTreasury() {
  return apiFetch<{
    backend: boolean;
    treasury: {
      balances: {
        bscBalance: number;
        polygonBalance: number;
        totalBalance: number;
      };
      totals: {
        adminDeposited: number;
        paidOut: number;
      };
      deposits: Array<{
        id: string;
        network: "BSC" | "POLYGON";
        amount: number;
        txHash: string;
        confirmations: number;
        requiredConfirmations: number;
        status: "CONFIRMING" | "CONFIRMED";
        startedAt: string;
        confirmedAt: string | null;
      }>;
      withdrawals: Array<{
        id: string;
        network: "BSC" | "POLYGON";
        amount: number;
        toAddress: string;
        txHash: string | null;
        note: string;
        kind: "MANUAL" | "USER_PAYOUT";
        userWithdrawalId: string | null;
        createdAt: string;
      }>;
    } | null;
  }>("/api/admin/treasury");
}

export async function adminCreateTreasuryDeposit(input: {
  network: "BSC" | "POLYGON";
  amount: number;
  txHash: string;
  requiredConfirmations: number;
  status?: "CONFIRMING" | "CONFIRMED";
  confirmations?: number;
}) {
  return apiFetch<{
    ok: true;
    deposit: {
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      txHash: string;
      confirmations: number;
      requiredConfirmations: number;
      status: "CONFIRMING" | "CONFIRMED";
      startedAt: string;
      confirmedAt: string | null;
    };
  }>("/api/admin/treasury/deposits", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminUpdateTreasuryDeposit(
  depositId: string,
  input: { confirmations?: number; confirm?: boolean },
) {
  return apiFetch<{
    ok: true;
    deposit: {
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      txHash: string;
      confirmations: number;
      requiredConfirmations: number;
      status: "CONFIRMING" | "CONFIRMED";
      startedAt: string;
      confirmedAt: string | null;
    };
  }>(`/api/admin/treasury/deposits/${depositId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function adminRecordTreasuryWithdrawal(input: {
  network: "BSC" | "POLYGON";
  amount: number;
  toAddress: string;
  txHash?: string;
  note?: string;
}) {
  return apiFetch<{
    ok: true;
    withdrawal: {
      id: string;
      network: "BSC" | "POLYGON";
      amount: number;
      toAddress: string;
      txHash: string | null;
      note: string;
      kind: "MANUAL" | "USER_PAYOUT";
      userWithdrawalId: string | null;
      createdAt: string;
    };
  }>("/api/admin/treasury/withdrawals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
