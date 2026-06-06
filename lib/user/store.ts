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

  getProfile: (wallet: string | undefined) => UserProfile | null;
  isUsernameTaken: (username: string, exceptWallet?: string) => boolean;
  registerUsername: (wallet: string, username: string) => RegisterResult;
}

function makeId(): string {
  return `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const useUserRegistry = create<UserRegistryState>()(
  persist(
    (set, get) => ({
      profilesByWallet: {},
      usernameIndex: {},

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
    },
  ),
);

export function syncProfileToAdmin(profile: UserProfile): void {
  void import("@/lib/admin/store").then(({ useAdminStore }) => {
    useAdminStore.getState().upsertRegisteredUser(profile);
  });
}

function isUsernameTakenInAdmin(usernameKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("valtrix.admin.v1");
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
