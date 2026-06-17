"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  normalizeUsernameKey,
  normalizeWallet,
  validateUsername,
  type UsernameError,
} from "@/lib/user/validation";

export interface UserProfile {
  id: string;
  wallet: string;
  username: string;
  joinedAt: number;
}

type RegisterResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; error: UsernameError | "WALLET_REGISTERED" };

interface UserRegistryState {
  profilesByWallet: Record<string, UserProfile>;
  usernameIndex: Record<string, string>;
  welcomeSeenWallets: Record<string, true>;

  getProfile: (wallet: string | undefined) => UserProfile | null;
  isUsernameTaken: (username: string, exceptWallet?: string) => boolean;
  registerUsername: (wallet: string, username: string) => RegisterResult;
  markWelcomeSeen: (wallet: string) => void;
  hasSeenWelcome: (wallet: string | undefined) => boolean;
}

function makeId(): string {
  return `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const useUserRegistry = create<UserRegistryState>()(
  persist(
    (set, get) => ({
      profilesByWallet: {},
      usernameIndex: {},
      welcomeSeenWallets: {},

      getProfile: (wallet) => {
        if (!wallet) return null;
        return get().profilesByWallet[normalizeWallet(wallet)] ?? null;
      },

      isUsernameTaken: (username, exceptWallet) => {
        const key = normalizeUsernameKey(username);
        const owner = get().usernameIndex[key];
        if (owner) {
          if (exceptWallet && owner === normalizeWallet(exceptWallet)) return false;
          return true;
        }
        return isUsernameTakenInAdmin(key);
      },

      registerUsername: (wallet, username) => {
        const walletKey = normalizeWallet(wallet);
        const existing = get().profilesByWallet[walletKey];
        if (existing) return { ok: false, error: "WALLET_REGISTERED" };

        const validationError = validateUsername(username);
        if (validationError) return { ok: false, error: validationError };

        const usernameKey = normalizeUsernameKey(username);
        if (get().usernameIndex[usernameKey] || isUsernameTakenInAdmin(usernameKey)) {
          return { ok: false, error: "TAKEN" };
        }

        const profile: UserProfile = {
          id: makeId(),
          wallet: walletKey,
          username: username.trim(),
          joinedAt: Date.now(),
        };

        set((state) => ({
          profilesByWallet: {
            ...state.profilesByWallet,
            [walletKey]: profile,
          },
          usernameIndex: {
            ...state.usernameIndex,
            [usernameKey]: walletKey,
          },
        }));

        return { ok: true, profile };
      },

      markWelcomeSeen: (wallet) => {
        const walletKey = normalizeWallet(wallet);
        set((state) => ({
          welcomeSeenWallets: {
            ...state.welcomeSeenWallets,
            [walletKey]: true,
          },
        }));
      },

      hasSeenWelcome: (wallet) => {
        if (!wallet) return true;
        return !!get().welcomeSeenWallets[normalizeWallet(wallet)];
      },
    }),
    {
      name: "valtrix.users.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as {
          profilesByWallet?: Record<string, UserProfile>;
          usernameIndex?: Record<string, string>;
          welcomeSeenWallets?: Record<string, true>;
        };
        const profiles = state.profilesByWallet ?? {};
        const welcomeSeenWallets =
          version < 2
            ? Object.fromEntries(
                Object.keys(profiles).map((wallet) => [wallet, true] as const),
              )
            : (state.welcomeSeenWallets ?? {});
        return {
          profilesByWallet: profiles,
          usernameIndex: state.usernameIndex ?? {},
          welcomeSeenWallets,
        };
      },
      partialize: (s) => ({
        profilesByWallet: s.profilesByWallet,
        usernameIndex: s.usernameIndex,
        welcomeSeenWallets: s.welcomeSeenWallets,
      }),
    },
  ),
);

export function syncProfileToAdmin(profile: UserProfile): void {
  void import("@/lib/admin/store").then(({ useAdminStore }) => {
    useAdminStore.getState().upsertRegisteredUser(profile);
  });
}

export function markWelcomeSeen(wallet: string): void {
  useUserRegistry.getState().markWelcomeSeen(wallet);
}

function isUsernameTakenInAdmin(usernameKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("valtrix.admin.v3");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      state?: { users?: Array<{ alias?: string }> };
    };
    const users = parsed.state?.users ?? [];
    return users.some(
      (u) => u.alias && normalizeUsernameKey(u.alias) === usernameKey,
    );
  } catch {
    return false;
  }
}
