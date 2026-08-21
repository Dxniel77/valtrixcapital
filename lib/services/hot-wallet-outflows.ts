import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db";
import {
  fetchExplorerTokenTxs,
  resolveExplorerApiKey,
} from "@/lib/block-explorer/etherscan-v2";
import { getPayoutPrivateKey } from "@/lib/services/automatic-payout";
import { getDepositAddress, getUsdtContract } from "@/lib/wallet/deposit-addresses";
import { USDT_DECIMALS } from "@/lib/wallet/usdt-transfer";
import { explorerUrl, shortenAddress } from "@/lib/utils";

export const HOT_WALLET_MIN_USD = 1;

const FETCH_TIMEOUT_MS = 12_000;
const SCAN_PAGES = 10;
const PAGE_SIZE = 100;
const TARGET_OUTFLOWS = 80;

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

function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function tokenAmount(value: string, decimalsRaw: string | undefined): number {
  const decimals = Number(decimalsRaw);
  const places = Number.isFinite(decimals) && decimals >= 0 ? decimals : USDT_DECIMALS.BSC;
  try {
    const raw = BigInt(value);
    const scale = 10n ** BigInt(places);
    const whole = raw / scale;
    const frac = raw % scale;
    return Number(whole) + Number(frac) / Number(scale);
  } catch {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n / 10 ** places;
  }
}

function payoutSignerAddress(): string | null {
  const key = getPayoutPrivateKey("BSC");
  if (!key) return null;
  try {
    return privateKeyToAccount(key).address.toLowerCase();
  } catch {
    return null;
  }
}

export function bscHotWalletAddresses(): string[] {
  const wallets = new Set<string>();
  const treasury = normalizeAddress(getDepositAddress("BSC"));
  if (treasury.startsWith("0x")) wallets.add(treasury);
  const signer = payoutSignerAddress();
  if (signer) wallets.add(signer);
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

export async function listBscHotWalletUsdtOutflows(): Promise<{
  items: HotWalletOutflowDto[];
  wallets: string[];
  usdtContract: string;
  explorerConfigured: boolean;
  minUsd: number;
}> {
  const wallets = bscHotWalletAddresses();
  const usdtContract = getUsdtContract("BSC").toLowerCase();
  const explorerConfigured = Boolean(resolveExplorerApiKey());

  if (!explorerConfigured || wallets.length === 0) {
    return {
      items: [],
      wallets,
      usdtContract,
      explorerConfigured,
      minUsd: HOT_WALLET_MIN_USD,
    };
  }

  const byHash = new Map<string, HotWalletOutflowDto>();
  const walletSet = new Set(wallets);

  for (const wallet of wallets) {
    for (let page = 1; page <= SCAN_PAGES; page += 1) {
      const rows = await fetchExplorerTokenTxs("BSC", {
        contractAddress: usdtContract,
        address: wallet,
        page,
        offset: PAGE_SIZE,
        fetch: fetchWithTimeout,
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        const hash = normalizeAddress(row.hash);
        const from = normalizeAddress(row.from);
        const to = normalizeAddress(row.to);
        const contract = normalizeAddress(row.contractAddress);
        if (!hash || !from || !to) continue;
        if (contract && contract !== usdtContract) continue;
        if (!walletSet.has(from)) continue;
        if (walletSet.has(to)) continue;
        const amount = tokenAmount(row.value, row.tokenDecimal);
        if (!(amount >= HOT_WALLET_MIN_USD)) continue;
        const timestamp = Number(row.timeStamp) * 1000;
        if (!Number.isFinite(timestamp)) continue;

        const prev = byHash.get(hash);
        if (prev && prev.timestamp >= timestamp) continue;
        byHash.set(hash, {
          id: hash,
          txHash: hash.startsWith("0x") ? hash : `0x${hash}`,
          fromAddress: from,
          toAddress: to,
          toLabel: null,
          amount,
          timestamp,
          explorerUrl: explorerUrl("BSC", hash.startsWith("0x") ? hash : `0x${hash}`),
          match: "unregistered",
        });
      }

      if (rows.length < PAGE_SIZE) break;
      if (byHash.size >= TARGET_OUTFLOWS) break;
      if (page < SCAN_PAGES) await sleep(160);
    }
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

  return {
    items,
    wallets,
    usdtContract,
    explorerConfigured,
    minUsd: HOT_WALLET_MIN_USD,
  };
}
