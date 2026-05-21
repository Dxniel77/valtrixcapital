import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { bsc, polygon } from "wagmi/chains";
import { http } from "viem";

export const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "valtrix-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Valtrix Capital",
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [bsc, polygon],
  ssr: true,
  transports: {
    [bsc.id]: http(
      process.env.NEXT_PUBLIC_BSC_RPC ?? "https://bsc-dataseed.binance.org",
    ),
    [polygon.id]: http(
      process.env.NEXT_PUBLIC_POLYGON_RPC ?? "https://polygon-rpc.com",
    ),
  },
});

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
