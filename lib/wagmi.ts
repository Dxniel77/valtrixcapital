import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { bsc, polygon } from "wagmi/chains";
import { http } from "viem";

const PLACEHOLDER_PROJECT_IDS = new Set([
  "",
  "valtrix-dev",
  "YOUR_PROJECT_ID",
  "get-from-cloud.walletconnect.com",
]);

const DEFAULT_APP_URL = "https://valtrix-capital.vercel.app";

export function resolveAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : DEFAULT_APP_URL);
  return raw.replace(/\/$/, "");
}

export function resolveAppIcon(appUrl = resolveAppUrl()): string {
  return `${appUrl}/brand/valtrix-logo.png`;
}

export function isWalletConnectConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
  return id.length >= 32 && !PLACEHOLDER_PROJECT_IDS.has(id);
}

/** WalletConnect Cloud project id — required for mobile wallets. */
export const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "valtrix-dev";

export function createWagmiConfig(appUrl = resolveAppUrl()) {
  const origin = appUrl.replace(/\/$/, "");
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Valtrix Capital";

  return getDefaultConfig({
    appName,
    appDescription:
      "Valtrix Capital — Web3 trading, staking and yield on BNB Chain and Polygon.",
    appUrl: origin,
    appIcon: resolveAppIcon(origin),
    projectId: WALLET_CONNECT_PROJECT_ID,
    chains: [bsc, polygon],
    ssr: true,
    wallets: [
      {
        groupName: "Popular",
        wallets: [metaMaskWallet, walletConnectWallet, trustWallet, rainbowWallet],
      },
    ],
    walletConnectParameters: {
      metadata: {
        name: appName,
        description:
          "Valtrix Capital — Web3 trading, staking and yield on BNB Chain and Polygon.",
        url: origin,
        icons: [resolveAppIcon(origin)],
      },
    },
    transports: {
      [bsc.id]: http(
        process.env.NEXT_PUBLIC_BSC_RPC ?? "https://bsc-dataseed.binance.org",
      ),
      [polygon.id]: http(
        process.env.NEXT_PUBLIC_POLYGON_RPC ?? "https://polygon-rpc.com",
      ),
    },
  });
}

export const wagmiConfig = createWagmiConfig();

export const SUPPORTED_CHAIN_IDS = [bsc.id, polygon.id] as const;

export const CHAIN_META: Record<
  number,
  { name: string; short: string; explorer: string; color: string; icon: string }
> = {
  [bsc.id]: {
    name: "BNB Smart Chain",
    short: "BSC",
    explorer: "https://bscscan.com",
    color: "#F0B90B",
    icon: "/brand/chain-bsc.svg",
  },
  [polygon.id]: {
    name: "Polygon",
    short: "Polygon",
    explorer: "https://polygonscan.com",
    color: "#8247E5",
    icon: "/brand/chain-polygon.svg",
  },
};
