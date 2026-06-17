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
  tokenDecimal?: string;
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
    page: "1",
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
