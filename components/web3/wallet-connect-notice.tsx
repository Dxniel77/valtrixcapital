"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { isWalletConnectConfigured } from "@/lib/wagmi";
import { useI18n } from "@/lib/i18n/context";

/** Shown when WalletConnect is misconfigured — mobile connections will fail. */
export function WalletConnectNotice() {
  const { t } = useI18n();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    setShow(!isWalletConnectConfigured());
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("walletConnect.notConfiguredTitle")}
      </p>
      <p className="mt-1 pl-5 text-warning/90">{t("walletConnect.notConfiguredBody")}</p>
    </div>
  );
}
