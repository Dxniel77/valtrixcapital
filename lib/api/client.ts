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
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
      lockedCapital: number;
      totalEarned: number;
      payoutCap: number;
      isActive: boolean;
      referralCode: string;
      registrationSource: "referral" | "direct";
      referrerWallet: string | null;
      referrerUsername: string | null;
    } | null;
  }>("/api/users/me");
}

export async function fetchBalanceAdjustments(sinceMs = 0) {
  return apiFetch<{
    backend: boolean;
    adjustments: Array<{
      id: string;
      amount: number;
      note: string;
      target: "WITHDRAWABLE" | "STAKING";
      createdAt: string;
    }>;
  }>(`/api/users/me/adjustments?since=${sinceMs}`);
}

export async function adminAdjustBalance(
  userId: string,
  delta: number,
  note: string,
  target: "WITHDRAWABLE" | "STAKING" = "WITHDRAWABLE",
) {
  return apiFetch<{
    ok: true;
    user: {
      earningsBalance: number;
      lockedCapital: number;
    };
  }>(`/api/admin/users/${userId}/adjust-balance`, {
    method: "POST",
    body: JSON.stringify({ delta, note, target }),
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
      lockedCapital: number;
      totalEarned: number;
      isActive: boolean;
      role: "USER" | "ADMIN";
      registrationSource: "referral" | "direct";
      referrerWallet: string | null;
      referrerUsername: string | null;
      directReferrals: number;
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
    }>;
  }>(`/api/admin/movements?limit=${limit}`);
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
  return apiFetch<{ ok: true; withdrawal: unknown }>("/api/withdrawals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function registerDepositRequest(input: {
  network: "BSC" | "POLYGON";
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
}) {
  return apiFetch<{
    ok: true;
    deposit: { id: string; confirmations: number; txHash: string };
  }>("/api/deposits", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
    } | null;
  }>("/api/config/platform");
}
