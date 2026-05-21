"use client";

import * as React from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { buildSiweMessage } from "@/lib/auth/siwe";

export interface SessionUser {
  id: string;
  address: string;
  role: "USER" | "ADMIN";
}

export function useSiwe() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();

  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user);
      return data.user as SessionUser | null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = React.useCallback(async () => {
    if (!address || !chainId) {
      setError("Connect a wallet first.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      const { nonce } = await nonceRes.json();
      const message = buildSiweMessage({
        address,
        chainId,
        nonce,
        domain: typeof window !== "undefined" ? window.location.host : "valtrix.capital",
        uri:
          typeof window !== "undefined"
            ? window.location.origin
            : "https://valtrix.capital",
      });
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, nonce }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to verify signature");
      }
      const verified = await verifyRes.json();
      setUser(verified.user);
      return verified.user as SessionUser;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = React.useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading, error, signIn, signOut, refresh };
}
