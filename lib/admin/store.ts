"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  BASE_YIELD_BPS,
  BONUS_PER_WIN_BPS,
  MAX_DAILY_YIELD_BPS,
} from "@/lib/trade/store";
import { COMMISSION_RATES_BPS } from "@/lib/referrals/constants";
import {
  MIN_WITHDRAWAL_USDT,
  WITHDRAWAL_FEE_BPS,
} from "@/lib/wallet/constants";
import { STAKE_MAX_USDT, STAKE_MIN_USDT } from "@/lib/staking/store";
import { PAIRS } from "@/lib/market/pairs";
import {
  DEFAULT_WITHDRAWAL_RULE,
  shouldUnlockWithdrawals,
  type WithdrawalRule,
} from "@/lib/admin/withdrawal-eligibility";
import { enrichDemoUser, recomputeWithdrawalUnlock } from "@/lib/admin/user-fields";

export type { WithdrawalRule };
export type AdminUserStatus = "ACTIVE" | "INACTIVE";
export type AdminUserRole = "USER" | "ADMIN";
export type AdminNetwork = "BSC" | "POLYGON";

export interface AdminUser {
  id: string;
  alias: string;
  wallet: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  network: AdminNetwork;
  capital: number;
  balance: number;
  totalEarned: number;
  referrals: number;
  uplineWallet: string | null;
  joinedAt: number;
  accountGranted: boolean;
  withdrawalUnlocked: boolean;
  withdrawalRule: WithdrawalRule;
  directSalesVolume: number;
  levelVolumes: number[];
  operationalEarned: number;
  networkEarned: number;
  passiveEarned: number;
}

export interface AdminMovement {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "YIELD" | "COMMISSION";
  wallet: string;
  amount: number;
  /** Passive daily accrual vs instant trade-win bonus (YIELD only). */
  yieldKind?: "operational" | "passive";
  network: AdminNetwork | null;
  status: string;
  timestamp: number;
}

export interface AdminSettings {
  baseYieldBps: number;
  bonusPerWinBps: number;
  maxDailyYieldBps: number;
  commissionRatesBps: number[];
  withdrawalFeeBps: number;
  minWithdrawalUsdt: number;
  minStakeUsdt: number;
  maxStakeUsdt: number;
  allowedPairs: string[];
}

export interface AuditEntry {
  id: string;
  action: string;
  target: string;
  detail: string;
  actor: string;
  timestamp: number;
}

interface AdminState {
  users: AdminUser[];
  movements: AdminMovement[];
  settings: AdminSettings;
  audit: AuditEntry[];
  seeded: boolean;

  seedDemo: () => void;
  upsertRegisteredUser: (profile: {
    id: string;
    wallet: string;
    username: string;
    joinedAt: number;
  }) => void;
  grantAccount: (input: {
    wallet: string;
    alias: string;
    rule: WithdrawalRule;
    uplineWallet?: string | null;
  }) => AdminUser | null;
  updateWithdrawalRule: (id: string, rule: WithdrawalRule) => void;
  syncLiveUserMetrics: (
    wallet: string,
    metrics: {
      capital: number;
      balance: number;
      totalEarned: number;
      operationalEarned: number;
      networkEarned: number;
      passiveEarned: number;
      directReferrals: number;
      directSalesVolume: number;
      levelVolumes: number[];
    },
  ) => void;
  setUserStatus: (id: string, status: AdminUserStatus) => void;
  adjustBalance: (id: string, delta: number, note: string) => void;
  updateSettings: (patch: Partial<AdminSettings>) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: AdminSettings = {
  baseYieldBps: BASE_YIELD_BPS,
  bonusPerWinBps: BONUS_PER_WIN_BPS,
  maxDailyYieldBps: MAX_DAILY_YIELD_BPS,
  commissionRatesBps: [...COMMISSION_RATES_BPS],
  withdrawalFeeBps: WITHDRAWAL_FEE_BPS,
  minWithdrawalUsdt: MIN_WITHDRAWAL_USDT,
  minStakeUsdt: STAKE_MIN_USDT,
  maxStakeUsdt: STAKE_MAX_USDT,
  allowedPairs: PAIRS.map((p) => p.binance),
};

const ALIASES = [
  "carlos.m", "luna_fx", "andres88", "marisol", "deeptrader", "valeria.r",
  "nodeKing", "sofia_eth", "bnbwhale", "elena.q", "matias", "polygonpro",
  "camila", "diego.v", "yieldhunter", "fer_nanda", "santiago", "alpha_lia",
  "renata", "gabriel.x", "isa.btc", "tomas", "noa_defi", "lucia",
  "maxi.sol", "paula", "bruno_v", "antonella",
];

function makeWallet(): string {
  let h = "0x";
  for (let i = 0; i < 40; i += 1) h += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return h;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function buildDemoUsers(): AdminUser[] {
  const users: AdminUser[] = [];
  const now = Date.now();
  for (let i = 0; i < ALIASES.length; i += 1) {
    const active = i % 5 !== 0;
    const capital = active ? Math.round((100 + Math.random() * 9000) / 10) * 10 : 0;
    const totalEarned = active
      ? Math.round(capital * (0.05 + Math.random() * 1.4) * 100) / 100
      : 0;
    users.push(
      enrichDemoUser(
        {
          id: makeId("usr"),
          alias: ALIASES[i],
          wallet: makeWallet(),
          role: i === 0 ? "ADMIN" : "USER",
          status: active ? "ACTIVE" : "INACTIVE",
          network: Math.random() > 0.5 ? "BSC" : "POLYGON",
          capital,
          balance: Math.round(totalEarned * (0.2 + Math.random() * 0.5) * 100) / 100,
          totalEarned,
          referrals: Math.floor(Math.random() * 24),
          uplineWallet: i > 2 ? users[Math.floor(Math.random() * Math.min(i, 5))].wallet : null,
          joinedAt: now - Math.floor(Math.random() * 90) * 86_400_000,
          accountGranted: false,
          withdrawalUnlocked: false,
          withdrawalRule: { ...DEFAULT_WITHDRAWAL_RULE },
          directSalesVolume: 0,
          levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0],
          operationalEarned: 0,
          networkEarned: 0,
          passiveEarned: 0,
        },
        i,
      ),
    );
  }
  return users;
}

function buildDemoMovements(users: AdminUser[]): AdminMovement[] {
  const types: AdminMovement["type"][] = [
    "DEPOSIT", "WITHDRAWAL", "YIELD", "COMMISSION",
  ];
  const movements: AdminMovement[] = [];
  const now = Date.now();
  for (let i = 0; i < 60; i += 1) {
    const u = users[Math.floor(Math.random() * users.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    let yieldKind: AdminMovement["yieldKind"];
    let amount: number;
    if (type === "DEPOSIT") {
      amount = 100 + Math.random() * 5000;
    } else if (type === "WITHDRAWAL") {
      amount = 50 + Math.random() * 2000;
    } else if (type === "YIELD") {
      yieldKind = Math.random() > 0.35 ? "passive" : "operational";
      amount =
        yieldKind === "operational"
          ? 5 + Math.random() * 25
          : 50 + Math.random() * 200;
    } else {
      amount = Math.random() * 25;
    }
    movements.push({
      id: makeId("mov"),
      type,
      wallet: u.wallet,
      amount: Math.round(amount * 100) / 100,
      yieldKind,
      network: type === "YIELD" || type === "COMMISSION" ? null : u.network,
      status:
        type === "WITHDRAWAL"
          ? ["COMPLETED", "PROCESSING", "REVIEW"][Math.floor(Math.random() * 3)]
          : "COMPLETED",
      timestamp: now - Math.floor(Math.random() * 30) * 86_400_000 - Math.floor(Math.random() * 86_400_000),
    });
  }
  return movements.sort((a, b) => b.timestamp - a.timestamp);
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      users: [],
      movements: [],
      settings: DEFAULT_SETTINGS,
      audit: [],
      seeded: false,

      seedDemo: () => {
        if (get().seeded && get().users.length > 0) return;
        const users = buildDemoUsers();
        set({
          users,
          movements: buildDemoMovements(users),
          seeded: true,
        });
      },

      upsertRegisteredUser: (profile) => {
        const wallet = profile.wallet.toLowerCase();
        const existing = get().users.find(
          (u) => u.wallet.toLowerCase() === wallet,
        );
        if (existing) {
          set((s) => ({
            users: s.users.map((u) =>
              u.wallet.toLowerCase() === wallet
                ? { ...u, alias: profile.username, joinedAt: profile.joinedAt }
                : u,
            ),
          }));
          return;
        }
        set((s) => ({
          users: [
            recomputeWithdrawalUnlock({
              id: profile.id,
              alias: profile.username,
              wallet: profile.wallet,
              role: "USER",
              status: "ACTIVE",
              network: "BSC",
              capital: 0,
              balance: 0,
              totalEarned: 0,
              referrals: 0,
              uplineWallet: null,
              joinedAt: profile.joinedAt,
              accountGranted: true,
              withdrawalUnlocked: false,
              withdrawalRule: { ...DEFAULT_WITHDRAWAL_RULE },
              directSalesVolume: 0,
              levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0],
              operationalEarned: 0,
              networkEarned: 0,
              passiveEarned: 0,
            }),
            ...s.users,
          ],
        }));
      },

      grantAccount: ({ wallet, alias, rule, uplineWallet = null }) => {
        const key = wallet.toLowerCase();
        const existing = get().users.find((u) => u.wallet.toLowerCase() === key);
        if (existing) {
          const updated = recomputeWithdrawalUnlock({
            ...existing,
            alias,
            accountGranted: true,
            withdrawalRule: rule,
            uplineWallet: uplineWallet ?? existing.uplineWallet,
          });
          set((s) => ({
            users: s.users.map((u) => (u.id === existing.id ? updated : u)),
            audit: [
              {
                id: makeId("aud"),
                action: "ACCOUNT_GRANTED",
                target: alias,
                detail: `Cuenta con reglas de retiro actualizada`,
                actor: "admin",
                timestamp: Date.now(),
              },
              ...s.audit,
            ].slice(0, 200),
          }));
          return updated;
        }

        const user = recomputeWithdrawalUnlock({
          id: makeId("usr"),
          alias,
          wallet,
          role: "USER",
          status: "ACTIVE",
          network: "BSC",
          capital: 0,
          balance: 0,
          totalEarned: 0,
          referrals: 0,
          uplineWallet,
          joinedAt: Date.now(),
          accountGranted: true,
          withdrawalUnlocked: false,
          withdrawalRule: rule,
          directSalesVolume: 0,
          levelVolumes: [0, 0, 0, 0, 0, 0, 0, 0],
          operationalEarned: 0,
          networkEarned: 0,
          passiveEarned: 0,
        });

        set((s) => ({
          users: [user, ...s.users],
          audit: [
            {
              id: makeId("aud"),
              action: "ACCOUNT_GRANTED",
              target: alias,
              detail: "Nueva cuenta con condiciones de retiro",
              actor: "admin",
              timestamp: Date.now(),
            },
            ...s.audit,
          ].slice(0, 200),
        }));
        return user;
      },

      updateWithdrawalRule: (id, rule) => {
        const user = get().users.find((u) => u.id === id);
        if (!user) return;
        const updated = recomputeWithdrawalUnlock({
          ...user,
          withdrawalRule: rule,
        });
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? updated : u)),
        }));
      },

      syncLiveUserMetrics: (wallet, metrics) => {
        const key = wallet.toLowerCase();
        const user = get().users.find((u) => u.wallet.toLowerCase() === key);
        if (!user) return;

        const updated = recomputeWithdrawalUnlock({
          ...user,
          capital: metrics.capital,
          balance: metrics.balance,
          totalEarned: metrics.totalEarned,
          operationalEarned: metrics.operationalEarned,
          networkEarned: metrics.networkEarned,
          passiveEarned: metrics.passiveEarned,
          referrals: metrics.directReferrals,
          directSalesVolume: metrics.directSalesVolume,
          levelVolumes: metrics.levelVolumes,
        });

        const wasLocked = user.accountGranted && !user.withdrawalUnlocked;
        const nowUnlocked = updated.withdrawalUnlocked;

        set((s) => ({
          users: s.users.map((u) => (u.wallet.toLowerCase() === key ? updated : u)),
          audit:
            wasLocked && nowUnlocked
              ? [
                  {
                    id: makeId("aud"),
                    action: "WITHDRAWAL_UNLOCKED",
                    target: user.alias,
                    detail: "Condiciones de retiro cumplidas",
                    actor: "system",
                    timestamp: Date.now(),
                  },
                  ...s.audit,
                ].slice(0, 200)
              : s.audit,
        }));
      },

      setUserStatus: (id, status) => {
        const user = get().users.find((u) => u.id === id);
        if (!user) return;
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, status } : u)),
          audit: [
            {
              id: makeId("aud"),
              action: status === "ACTIVE" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
              target: user.alias,
              detail:
                status === "ACTIVE"
                  ? "Cuenta reactivada"
                  : "Cuenta desactivada",
              actor: "admin",
              timestamp: Date.now(),
            },
            ...s.audit,
          ].slice(0, 200),
        }));
      },

      adjustBalance: (id, delta, note) => {
        const user = get().users.find((u) => u.id === id);
        if (!user) return;
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? { ...u, balance: Math.max(0, u.balance + delta) }
              : u,
          ),
          audit: [
            {
              id: makeId("aud"),
              action: "BALANCE_ADJUSTED",
              target: user.alias,
              detail: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} USDT — ${note || "sin nota"}`,
              actor: "admin",
              timestamp: Date.now(),
            },
            ...s.audit,
          ].slice(0, 200),
        }));
      },

      updateSettings: (patch) => {
        const changes = Object.keys(patch).join(", ");
        set((s) => ({
          settings: { ...s.settings, ...patch },
          audit: [
            {
              id: makeId("aud"),
              action: "SETTINGS_UPDATED",
              target: changes,
              detail: "Configuración de plataforma modificada",
              actor: "admin",
              timestamp: Date.now(),
            },
            ...s.audit,
          ].slice(0, 200),
        }));
      },

      reset: () =>
        set({
          users: [],
          movements: [],
          settings: DEFAULT_SETTINGS,
          audit: [],
          seeded: false,
        }),
    }),
    {
      name: "valtrix.admin.v2",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
    },
  ),
);

export function useAdminStoreHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const unsub = useAdminStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAdminStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** Seeds demo data once hydrated. */
export function useAdminSeed(): boolean {
  const hydrated = useAdminStoreHydrated();
  const seedDemo = useAdminStore((s) => s.seedDemo);
  React.useEffect(() => {
    if (hydrated) seedDemo();
  }, [hydrated, seedDemo]);
  return hydrated;
}

export function useAdminStats() {
  const users = useAdminStore((s) => s.users);
  const movements = useAdminStore((s) => s.movements);
  return React.useMemo(() => {
    const active = users.filter((u) => u.status === "ACTIVE");
    const tvl = users.reduce((acc, u) => acc + u.capital, 0);
    const liabilities = users.reduce((acc, u) => acc + u.balance, 0);
    const withdrawalsPending = movements.filter(
      (m) => m.type === "WITHDRAWAL" && m.status !== "COMPLETED",
    ).length;
    return {
      totalUsers: users.length,
      activeUsers: active.length,
      tvl,
      liabilities,
      withdrawalsPending,
    };
  }, [users, movements]);
}
