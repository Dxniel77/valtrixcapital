"use client";

import * as React from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { useAdmin2FAStore } from "@/lib/admin/two-factor-store";

export function Admin2FAGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const enabled = useAdmin2FAStore((s) => s.enabled);
  const sessionVerified = useAdmin2FAStore((s) => s.sessionVerified);
  const setPin = useAdmin2FAStore((s) => s.setPin);
  const verifyPin = useAdmin2FAStore((s) => s.verifyPin);

  const [mode, setMode] = React.useState<"setup" | "verify">("verify");
  const [pin, setPinValue] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const unsub = useAdmin2FAStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useAdmin2FAStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setMode(enabled ? "verify" : "setup");
  }, [hydrated, enabled]);

  const blocked = hydrated && (!enabled || !sessionVerified);

  async function handleSetup() {
    if (!/^\d{6}$/.test(pin)) {
      setError(t("admin.twoFactor.invalidPin"));
      return;
    }
    if (pin !== confirm) {
      setError(t("admin.twoFactor.pinMismatch"));
      return;
    }
    await setPin(pin);
    setPinValue("");
    setConfirm("");
    setError(null);
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(pin)) {
      setError(t("admin.twoFactor.invalidPin"));
      return;
    }
    const ok = await verifyPin(pin);
    if (!ok) {
      setError(t("admin.twoFactor.wrongPin"));
      return;
    }
    setPinValue("");
    setError(null);
  }

  if (!hydrated) return null;

  return (
    <>
      {children}
      <Dialog open={blocked} onOpenChange={() => undefined}>
        <DialogContent showClose={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" />
              {mode === "setup"
                ? t("admin.twoFactor.setupTitle")
                : t("admin.twoFactor.verifyTitle")}
            </DialogTitle>
            <DialogDescription>
              {mode === "setup"
                ? t("admin.twoFactor.setupDesc")
                : t("admin.twoFactor.verifyDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-text-muted">
                {t("admin.twoFactor.pinLabel")}
              </label>
              <Input
                value={pin}
                onChange={(e) =>
                  setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="••••••"
                className="text-center font-mono text-lg tracking-[0.3em]"
                autoComplete="one-time-code"
              />
            </div>
            {mode === "setup" ? (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {t("admin.twoFactor.confirmLabel")}
                </label>
                <Input
                  value={confirm}
                  onChange={(e) =>
                    setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="••••••"
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
              </div>
            ) : null}
            {error ? (
              <p className="text-center text-xs text-danger">{error}</p>
            ) : null}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={mode === "setup" ? handleSetup : handleVerify}
            >
              <KeyRound className="h-4 w-4" />
              {mode === "setup"
                ? t("admin.twoFactor.enable")
                : t("admin.twoFactor.unlock")}
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
