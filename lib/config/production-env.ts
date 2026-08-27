import { isProductionRuntime } from "@/lib/runtime-mode";
import { readServerSecret } from "@/lib/config/server-env";

export interface ProductionConfigIssue {
  key: string;
  severity: "error" | "warning";
  message: string;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isValidEthAddress(value: string | undefined): boolean {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value) && value !== ZERO_ADDRESS;
}

/** Server-side production readiness checks (non-secret metadata only). */
export function getProductionConfigIssues(): ProductionConfigIssue[] {
  if (!isProductionRuntime()) return [];

  const issues: ProductionConfigIssue[] = [];

  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    issues.push({
      key: "NEXTAUTH_SECRET",
      severity: "error",
      message: "Session signing secret is required in production.",
    });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    issues.push({
      key: "DATABASE_URL",
      severity: "error",
      message: "PostgreSQL database URL is required in production.",
    });
  }

  if (!isValidEthAddress(process.env.NEXT_PUBLIC_TREASURY_BSC_ADDRESS?.trim())) {
    issues.push({
      key: "NEXT_PUBLIC_TREASURY_BSC_ADDRESS",
      severity: "error",
      message: "Set a real BSC treasury deposit address (not 0x000…).",
    });
  }

  if (
    !isValidEthAddress(process.env.NEXT_PUBLIC_TREASURY_POLYGON_ADDRESS?.trim())
  ) {
    issues.push({
      key: "NEXT_PUBLIC_TREASURY_POLYGON_ADDRESS",
      severity: "error",
      message: "Set a real Polygon treasury deposit address (not 0x000…).",
    });
  }

  const payoutKey = readServerSecret(
    "TREASURY_PAYOUT_PRIVATE_KEY",
    "TREASURY_BSC_PAYOUT_PRIVATE_KEY",
    "TREASURY_POLYGON_PAYOUT_PRIVATE_KEY",
  );
  if (!payoutKey) {
    issues.push({
      key: "TREASURY_PAYOUT_PRIVATE_KEY",
      severity: "error",
      message: "Automatic withdrawal payouts require a treasury payout private key.",
    });
  }

  if (
    !isValidEthAddress(process.env.NEXT_PUBLIC_COPY_BSC_ADDRESS?.trim()) &&
    !isValidEthAddress(process.env.NEXT_PUBLIC_COPY_POLYGON_ADDRESS?.trim())
  ) {
    issues.push({
      key: "NEXT_PUBLIC_COPY_BSC_ADDRESS",
      severity: "warning",
      message:
        "Copy-trading deposit address is unset; the app will use the live copy wallet fallback.",
    });
  }

  const copyPayoutKey = readServerSecret(
    "COPY_PAYOUT_PRIVATE_KEY",
    "COPY_BSC_PAYOUT_PRIVATE_KEY",
    "COPY_POLYGON_PAYOUT_PRIVATE_KEY",
  );
  if (!copyPayoutKey) {
    issues.push({
      key: "COPY_PAYOUT_PRIVATE_KEY",
      severity: "error",
      message:
        "Copy-cash wallet withdrawals need COPY_PAYOUT_PRIVATE_KEY (the copy wallet key, not the staking key).",
    });
  }

  const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
  if (wcId.length < 32 || wcId === "valtrix-dev") {
    issues.push({
      key: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
      severity: "error",
      message: "Set a valid WalletConnect Cloud project id for mobile wallets.",
    });
  }

  if (!process.env.ADMIN_WALLETS?.trim()) {
    issues.push({
      key: "ADMIN_WALLETS",
      severity: "warning",
      message: "No admin manager wallets configured.",
    });
  }

  if (!process.env.CRON_SECRET?.trim()) {
    issues.push({
      key: "CRON_SECRET",
      severity: "warning",
      message: "Cron endpoints are unprotected without CRON_SECRET.",
    });
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    issues.push({
      key: "RESEND_API_KEY",
      severity: "warning",
      message: "Email notifications will not be delivered without Resend.",
    });
  }

  return issues;
}

export function isProductionReady(): boolean {
  return getProductionConfigIssues().every((i) => i.severity !== "error");
}
