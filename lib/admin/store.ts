"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
  usePlatformSettingsStore,
} from "@/lib/platform/settings-store";
import {
  DEFAULT_WITHDRAWAL_RULE,
  shouldUnlockWithdrawals,
  type WithdrawalRule,
} from "@/lib/admin/withdrawal-eligibility";
import { enrichDemoUser, recomputeWithdrawalUnlock } from "@/lib/admin/user-fields";
import {
  findSponsorUser,
  findUserByReferralCode,
  recountDirectReferrals,
  resolveSponsorQuery,
  wouldCreateUplineCycle,
  type SponsorUpdateError,
} from "@/lib/admin/sponsor";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referrals/pending-sponsor";

export type { WithdrawalRule };
export type AdminUserStatus = "ACTIVE" | "INACTIVE";
export type AdminUserRole = "USER" | "ADMIN";
export type AdminNetwork = "BSC" | "POLYGON";
export type RegistrationSource = "referral" | "direct";
export type BalanceAdjustmentTarget = "WITHDRAWABLE" | "STAKING";

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
  /** Cached referrer username from DB when not in local user list. */
  referrerUsername: string | null;
  /** Whether the user signed up via a referral link (vs direct registration). */
  registrationSource: RegistrationSource;
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
  type: "DEPOSIT" | "WITHDRAWAL" | "YIELD" | "COMMISSION" | "ADJUSTMENT";
  wallet: string;
  amount: number;
  /** Passive daily accrual vs instant trade-win bonus (YIELD only). */
  yieldKind?: "operational" | "passive";
  network: AdminNetwork | null;
  status: string;
  timestamp: number;
}

export interface AdminBalanceAdjustment {
  id: string;
  wallet: string;
  delta: number;
  note: string;
  target: BalanceAdjustmentTarget;
  createdAt: number;
  appliedAt: number | null;
}

export type AdminSettings = PlatformSettings;

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
  balanceAdjustments: AdminBalanceAdjustment[];
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
  updateUserSponsor: (
    id: string,
    sponsorQuery: string | null,
  ) => { ok: true } | { ok: false; error: SponsorUpdateError };
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
  adjustBalance: (
    id: string,
    delta: number,
    note: string,
    target?: BalanceAdjustmentTarget,
  ) => void;
  markBalanceAdjustmentsApplied: (ids: string[]) => void;
  updateSettings: (patch: Partial<AdminSettings>) => void;
  recordMovement: (movement: AdminMovement) => void;
  syncLiveMovements: (movements: AdminMovement[]) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS = DEFAULT_PLATFORM_SETTINGS;

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
          referrerUsername: null,
          registrationSource: i > 2 && i % 2 === 0 ? "referral" : "direct",
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
  const todayStart = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`);

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

    const isToday = i < 22;
    const timestamp = isToday
      ? todayStart + Math.floor(Math.random() * Math.min(now - todayStart + 1, 86_400_000))
      : now - Math.floor(Math.random() * 30) * 86_400_000 - Math.floor(Math.random() * 86_400_000);

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
      timestamp,
    });
  }
  return movements.sort((a, b) => b.timestamp - a.timestamp);
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      users: [],
      movements: [],
      balanceAdjustments: [],
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

        const pendingRef = getPendingReferralCode();
        let resolvedUpline: string | null = null;
        if (pendingRef) {
          const sponsor = findUserByReferralCode(get().users, pendingRef);
          if (sponsor && sponsor.wallet.toLowerCase() !== wallet) {
            resolvedUpline = sponsor.wallet;
          }
          clearPendingReferralCode();
        }

        if (existing) {
          set((s) => ({
            users: recountDirectReferrals(
              s.users.map((u) =>
                u.wallet.toLowerCase() === wallet
                  ? {
                      ...u,
                      alias: profile.username,
                      joinedAt: profile.joinedAt,
                      uplineWallet: u.uplineWallet ?? resolvedUpline,
                    }
                  : u,
              ),
            ),
          }));
          return;
        }
        set((s) => ({
          users: recountDirectReferrals([
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
              uplineWallet: resolvedUpline,
              referrerUsername: resolvedUpline
                ? findSponsorUser(get().users, resolvedUpline)?.alias ?? null
                : null,
              registrationSource: resolvedUpline ? "referral" : "direct",
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
          ]),
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
            users: recountDirectReferrals(
              s.users.map((u) => (u.id === existing.id ? updated : u)),
            ),
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
          referrerUsername: null,
          registrationSource: "direct",
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
          users: recountDirectReferrals([user, ...s.users]),
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

      updateUserSponsor: (id, sponsorQuery) => {
        const user = get().users.find((u) => u.id === id);
        if (!user) return { ok: false, error: "NOT_FOUND" };

        let uplineWallet: string | null = null;
        let sponsorAlias = "—";

        if (sponsorQuery?.trim()) {
          const sponsor = resolveSponsorQuery(get().users, sponsorQuery);
          if (!sponsor) return { ok: false, error: "SPONSOR_NOT_FOUND" };
          if (sponsor.wallet.toLowerCase() === user.wallet.toLowerCase()) {
            return { ok: false, error: "SELF_SPONSOR" };
          }
          uplineWallet = sponsor.wallet;
          sponsorAlias = sponsor.alias;
        }

        if (wouldCreateUplineCycle(user.wallet, uplineWallet, get().users)) {
          return { ok: false, error: "CYCLE" };
        }

        const previous = user.uplineWallet
          ? (get().users.find(
              (u) =>
                u.wallet.toLowerCase() === user.uplineWallet?.toLowerCase(),
            )?.alias ?? user.uplineWallet)
          : "—";

        set((s) => ({
          users: recountDirectReferrals(
            s.users.map((u) =>
              u.id === id ? { ...u, uplineWallet } : u,
            ),
          ),
          audit: [
            {
              id: makeId("aud"),
              action: "SPONSOR_CHANGED",
              target: user.alias,
              detail:
                uplineWallet === null
                  ? `Patrocinador removido (antes: ${previous})`
                  : `Patrocinador: ${previous} → ${sponsorAlias}`,
              actor: "admin",
              timestamp: Date.now(),
            },
            ...s.audit,
          ].slice(0, 200),
        }));

        return { ok: true };
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

        const unchanged =
          user.capital === metrics.capital &&
          user.balance === metrics.balance &&
          user.totalEarned === metrics.totalEarned &&
          user.operationalEarned === metrics.operationalEarned &&
          user.networkEarned === metrics.networkEarned &&
          user.passiveEarned === metrics.passiveEarned &&
          user.referrals === metrics.directReferrals &&
          user.directSalesVolume === metrics.directSalesVolume &&
          user.levelVolumes.every((v, i) => v === metrics.levelVolumes[i]);
        if (unchanged) return;

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

      adjustBalance: (id, delta, note, target = "WITHDRAWABLE") => {
        const user = get().users.find((u) => u.id === id);
        if (!user || delta === 0) return;
        const adjId = makeId("adj");
        const now = Date.now();
        const isStaking = target === "STAKING" && delta > 0;

        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== id) return u;
            if (isStaking) {
              return { ...u, capital: u.capital + delta };
            }
            return {
              ...u,
              balance: Math.max(0, u.balance + delta),
            };
          }),
          balanceAdjustments: [
            {
              id: adjId,
              wallet: user.wallet.toLowerCase(),
              delta,
              note: note.trim(),
              target,
              createdAt: now,
              appliedAt: null,
            },
            ...s.balanceAdjustments,
          ].slice(0, 200),
          movements: [
            {
              id: `adj_${adjId}`,
              type: "ADJUSTMENT" as const,
              wallet: user.wallet,
              amount: delta,
              network: null,
              status: "COMPLETED",
              timestamp: now,
            },
            ...s.movements,
          ].slice(0, 500),
          audit: [
            {
              id: makeId("aud"),
              action: "BALANCE_ADJUSTED",
              target: user.alias,
              detail: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} USDT (${target}) — ${note || "sin nota"}`,
              actor: "admin",
              timestamp: now,
            },
            ...s.audit,
          ].slice(0, 200),
        }));
      },

      markBalanceAdjustmentsApplied: (ids) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        const now = Date.now();
        set((s) => ({
          balanceAdjustments: s.balanceAdjustments.map((a) =>
            idSet.has(a.id) ? { ...a, appliedAt: now } : a,
          ),
        }));
      },

      updateSettings: (patch) => {
        usePlatformSettingsStore.getState().updateSettings(patch);
        const changes = Object.keys(patch).join(", ");
        set((s) => ({
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

      recordMovement: (movement) => {
        set((s) => {
          if (s.movements.some((m) => m.id === movement.id)) {
            return {
              movements: s.movements.map((m) =>
                m.id === movement.id ? { ...m, ...movement } : m,
              ),
            };
          }
          return {
            movements: [movement, ...s.movements].slice(0, 500),
          };
        });
      },

      syncLiveMovements: (incoming) => {
        if (incoming.length === 0) return;
        set((s) => {
          const byId = new Map(s.movements.map((m) => [m.id, m] as const));
          for (const movement of incoming) {
            const prev = byId.get(movement.id);
            byId.set(
              movement.id,
              prev ? { ...prev, ...movement } : movement,
            );
          }
          const merged = [...byId.values()].sort(
            (a, b) => b.timestamp - a.timestamp,
          );
          return { movements: merged.slice(0, 500) };
        });
      },

      reset: () => {
        usePlatformSettingsStore.getState().resetSettings();
        set({
          users: [],
          movements: [],
          balanceAdjustments: [],
          audit: [],
          seeded: false,
        });
      },
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
      partialize: (s) => ({
        users: s.users,
        movements: s.movements,
        balanceAdjustments: s.balanceAdjustments,
        audit: s.audit,
        seeded: s.seeded,
      }),
      migrate: (persisted) => {
        const prev = persisted as {
          settings?: Partial<PlatformSettings>;
          users?: AdminUser[];
          balanceAdjustments?: AdminBalanceAdjustment[];
        } & Record<string, unknown>;
        if (prev.settings && typeof window !== "undefined") {
          usePlatformSettingsStore
            .getState()
            .updateSettings({ ...DEFAULT_PLATFORM_SETTINGS, ...prev.settings });
        }
        const { settings: _settings, ...rest } = prev;
        if (Array.isArray(rest.users)) {
          rest.users = rest.users.map((u) => ({
            ...u,
            registrationSource:
              u.registrationSource ??
              (u.uplineWallet ? "referral" : "direct"),
            referrerUsername: u.referrerUsername ?? null,
          }));
        }
        if (Array.isArray(rest.balanceAdjustments)) {
          rest.balanceAdjustments = rest.balanceAdjustments.map((a) => ({
            ...a,
            target: a.target ?? "WITHDRAWABLE",
          }));
        }
        return rest;
      },
      version: 5,
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
