/**
 * Etherscan API v2 — one API key for all supported chains (BSC, Polygon, etc.).
 * @see https://docs.etherscan.io/v2-migration
 */

export const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

/** @see https://docs.etherscan.io/supported-chains */
export const EXPLORER_CHAIN_ID = {
  BSC: 56,
  POLYGON: 137,
} as const;

export type ExplorerChain = keyof typeof EXPLORER_CHAIN_ID;

export interface ExplorerTokenTxRow {
  hash: string;
  timeStamp: string;
  value: string;
  from?: string;
  to?: string;
  contractAddress?: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
}

/** Single key works for BSC (56), Polygon (137), and 60+ other chains. */
export function resolveExplorerApiKey(): string {
  return (
    process.env.ETHERSCAN_API_KEY?.trim() ||
    process.env.BSCSCAN_API_KEY?.trim() ||
    process.env.POLYGONSCAN_API_KEY?.trim() ||
    ""
  );
}

export async function fetchExplorerTokenTxs(
  chain: ExplorerChain,
  input: {
    contractAddress: string;
    address: string;
    offset?: number;
    page?: number;
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
  },
): Promise<ExplorerTokenTxRow[]> {
  const apiKey = resolveExplorerApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    chainid: String(EXPLORER_CHAIN_ID[chain]),
    module: "account",
    action: "tokentx",
    contractaddress: input.contractAddress,
    address: input.address,
    page: String(Math.max(1, input.page ?? 1)),
    offset: String(input.offset ?? 80),
    sort: "desc",
    apikey: apiKey,
  });

  let res: Response;
  try {
    res = await input.fetch(`${ETHERSCAN_V2_BASE}?${params.toString()}`, {
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as {
    status?: string;
    result?: ExplorerTokenTxRow[] | string;
  };
  if (data.status !== "1" || !Array.isArray(data.result)) return [];
  return data.result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Newest official-token transfers, walking several explorer pages. */
export async function fetchExplorerTokenTxPages(
  chain: ExplorerChain,
  input: {
    contractAddress: string;
    address: string;
    pages?: number;
    pageSize?: number;
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
  },
): Promise<ExplorerTokenTxRow[]> {
  const pages = Math.min(Math.max(input.pages ?? 5, 1), 10);
  const pageSize = Math.min(Math.max(input.pageSize ?? 100, 1), 100);
  const seen = new Set<string>();
  const rows: ExplorerTokenTxRow[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const batch = await fetchExplorerTokenTxs(chain, {
      contractAddress: input.contractAddress,
      address: input.address,
      page,
      offset: pageSize,
      fetch: input.fetch,
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      const hash = row.hash?.toLowerCase();
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      rows.push(row);
    }
    if (batch.length < pageSize) break;
    if (page < pages) await sleep(160);
  }

  return rows;
}
