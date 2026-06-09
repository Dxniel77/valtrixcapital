"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Admin2FAState {
  enabled: boolean;
  codeHash: string | null;
  sessionVerified: boolean;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearSession: () => void;
  disable: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`valtrix-2fa:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useAdmin2FAStore = create<Admin2FAState>()(
  persist(
    (set, get) => ({
      enabled: false,
      codeHash: null,
      sessionVerified: false,

      setPin: async (pin) => {
        const codeHash = await hashPin(pin);
        set({ enabled: true, codeHash, sessionVerified: true });
      },

      verifyPin: async (pin) => {
        const { codeHash } = get();
        if (!codeHash) return false;
        const ok = (await hashPin(pin)) === codeHash;
        if (ok) set({ sessionVerified: true });
        return ok;
      },

      clearSession: () => set({ sessionVerified: false }),

      disable: () =>
        set({ enabled: false, codeHash: null, sessionVerified: false }),
    }),
    {
      name: "valtrix.admin.2fa.v1",
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
        enabled: s.enabled,
        codeHash: s.codeHash,
      }),
    },
  ),
);
