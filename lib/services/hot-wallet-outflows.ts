import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db";
import { fetchBscOfficialUsdtOutflows } from "@/lib/block-explorer/bsc-usdt-outflows";
import { getCopyPayoutPrivateKey, getPayoutPrivateKey } from "@/lib/services/automatic-payout";
import { getCopyDepositAddress, getDepositAddress, getUsdtContract } from "@/lib/wallet/deposit-addresses";
import { USDT_DECIMALS } from "@/lib/wallet/usdt-transfer";
import { explorerUrl, shortenAddress } from "@/lib/utils";

export const HOT_WALLET_MIN_USD = 1;
const CACHE_TTL_MS = 90_000;

export type HotWalletMatch = "unregistered" | "user_payout" | "treasury";

export interface HotWalletOutflowDto {
  id: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  toLabel: string | null;
  amount: number;
  timestamp: number;
  explorerUrl: string;
  match: HotWalletMatch;
}

export interface HotWalletOutflowList {
  items: HotWalletOutflowDto[];
  wallets: string[];
  usdtContract: string;
  explorerConfigured: boolean;
  minUsd: number;
  source: "rpc";
  lookbackHours: number;
  truncated: boolean;
  scanError: string | null;
}

type CacheEntry = {
  at: number;
  key: string;
  value: HotWalletOutflowList;
};

let cache: CacheEntry | null = null;

function normalizeAddress(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function payoutSignerAddress(
  getKey: typeof getPayoutPrivateKey,
): string | null {
  const key = getKey("BSC");
  if (!key) return null;
  try {
    return privateKeyToAccount(key).address.toLowerCase();
  } catch {
    return null;
  }
}

export function bscHotWalletAddresses(): string[] {
  const wallets = new Set<string>();
  for (const address of [
    normalizeAddress(getDepositAddress("BSC")),
    normalizeAddress(getCopyDepositAddress("BSC")),
  ]) {
    if (address.startsWith("0x")) wallets.add(address);
  }
  for (const signer of [
    payoutSignerAddress(getPayoutPrivateKey),
    payoutSignerAddress(getCopyPayoutPrivateKey),
  ]) {
    if (signer) wallets.add(signer);
  }
  return [...wallets];
}

function hashLookupValues(hashes: string[]): string[] {
  const values = new Set<string>();
  for (const hash of hashes) {
    const lower = hash.toLowerCase();
    values.add(lower);
    if (lower.startsWith("0x")) values.add(lower.slice(2));
    else values.add(`0x${lower}`);
  }
  return [...values];
}

function addressLookupValues(addresses: string[]): string[] {
  const values = new Set<string>();
  for (const address of addresses) {
    const lower = address.toLowerCase();
    values.add(lower);
    try {
      values.add(getAddress(lower));
    } catch {
      /* ignore invalid */
    }
  }
  return [...values];
}

async function knownTxMatches(
  hashes: string[],
): Promise<Map<string, HotWalletMatch>> {
  const map = new Map<string, HotWalletMatch>();
  if (hashes.length === 0) return map;

  const lookup = hashLookupValues(hashes);
  const [userRows, treasuryRows] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { network: "BSC", txHash: { in: lookup } },
      select: { txHash: true },
    }),
    prisma.treasuryWithdrawal.findMany({
      where: { network: "BSC", txHash: { in: lookup } },
      select: { txHash: true },
    }),
  ]);

  for (const row of treasuryRows) {
    const hash = normalizeAddress(row.txHash);
    if (hash) map.set(hash.startsWith("0x") ? hash : `0x${hash}`, "treasury");
  }
  for (const row of userRows) {
    const hash = normalizeAddress(row.txHash);
    if (hash) map.set(hash.startsWith("0x") ? hash : `0x${hash}`, "user_payout");
  }
  return map;
}

function emptyResult(
  wallets: string[],
  usdtContract: string,
  scanError: string | null = null,
): HotWalletOutflowList {
  return {
    items: [],
    wallets,
    usdtContract,
    explorerConfigured: true,
    minUsd: HOT_WALLET_MIN_USD,
    source: "rpc",
    lookbackHours: 0,
    truncated: false,
    scanError,
  };
}

export async function listBscHotWalletUsdtOutflows(): Promise<HotWalletOutflowList> {
  const wallets = bscHotWalletAddresses();
  const usdtContract = getUsdtContract("BSC").toLowerCase();
  const cacheKey = wallets.join(",");
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  if (wallets.length === 0) {
    return emptyResult(wallets, usdtContract, "No BSC treasury address configured");
  }

  const walletSet = new Set(wallets);
  const byHash = new Map<string, HotWalletOutflowDto>();
  let lookbackHours = 0;
  let truncated = false;
  let scanError: string | null = null;

  try {
    for (const wallet of wallets) {
      const scan = await fetchBscOfficialUsdtOutflows({
        wallet,
        usdtContract,
        decimals: USDT_DECIMALS.BSC,
        minAmount: HOT_WALLET_MIN_USD,
      });
      lookbackHours = Math.max(lookbackHours, scan.lookbackHours);
      truncated = truncated || scan.truncated;
      for (const row of scan.items) {
        if (walletSet.has(row.to)) continue;
        const prev = byHash.get(row.txHash);
        if (prev && prev.timestamp >= row.timestamp) continue;
        byHash.set(row.txHash, {
          id: row.txHash,
          txHash: row.txHash,
          fromAddress: row.from,
          toAddress: row.to,
          toLabel: null,
          amount: row.amount,
          timestamp: row.timestamp,
          explorerUrl: explorerUrl("BSC", row.txHash),
          match: "unregistered",
        });
      }
    }
  } catch (error) {
    scanError = error instanceof Error ? error.message : "BSC RPC scan failed";
  }

  const items = [...byHash.values()].sort((a, b) => b.timestamp - a.timestamp);
  const hashes = items.map((item) => item.txHash.toLowerCase());
  const matches = await knownTxMatches(hashes);

  const dests = [...new Set(items.map((item) => item.toAddress))];
  const users =
    dests.length === 0
      ? []
      : await prisma.user.findMany({
          where: { walletAddress: { in: addressLookupValues(dests) } },
          select: { walletAddress: true, username: true },
        });
  const userByWallet = new Map(
    users.map((user) => [
      user.walletAddress.toLowerCase(),
      user.username?.trim() || shortenAddress(user.walletAddress),
    ]),
  );

  for (const item of items) {
    item.match = matches.get(item.txHash.toLowerCase()) ?? "unregistered";
    item.toLabel = userByWallet.get(item.toAddress) ?? null;
  }

  const value: HotWalletOutflowList = {
    items,
    wallets,
    usdtContract,
    explorerConfigured: true,
    minUsd: HOT_WALLET_MIN_USD,
    source: "rpc",
    lookbackHours,
    truncated,
    scanError,
  };
  cache = { at: Date.now(), key: cacheKey, value };
  return value;
}
