import type { BotNetwork } from "./store";

/** Verified BSC USDT transfers (Binance hot wallet activity). */
export const BSC_REFERENCE_TXS = [
  "0xa33d7b37ed2e8f0c6c4c74068d0e8c6a2b8bf8b9ce5b95a4290d547e362cce25",
  "0xdda38287efd313d2d9f1eaecd957ff141c1ab68fea3921a8d17ed96b5cede233",
  "0xb331e1ac8f9d65e7e62db3263403c2ab0c9386feaef90639321fb41781054945",
  "0x2121793a90ebc28f0a3398b7709f3d49cdc078d706208fa0e70af407dfa4ec10",
  "0x919f08395157319326fe417dc873915efe4a33207a2a8ddc079a8cb2ac48e60b",
  "0xa58856ba7612632891e95ac69af9a065c2a8d4ae08c5916ac0573c885b86fd44",
  "0xd1dc2994e2165cec4131779bc34d6e2a8ed8c9b9dd4b76881af39d03cf249bac",
  "0xa7165161946c5530df61721b735188ccdeb7f1100ae49c34f80015f6bf9f2514",
  "0x518e570d8068b98dc68357767ced6307a6518939f9cca9c7ca8e038e65071e55",
  "0xa13394872b3d301daf2cec1d2c6ae40f6f85ee37bdc1e175d9fb9663b3ad8010",
  "0x2fbe83f73217a434acf90ef30ae4a3dd4be5790b4188c8d6df9b00d7cfceef1e",
  "0x6ba3556947852958432ff4695d20b9d437384b40e772c8006cf131540884908d",
] as const;

/** Verified Polygon USDT transfers. */
export const POLYGON_REFERENCE_TXS = [
  "0x6edb7ddd60b8105ce98e4d221856873a9042d000d885c1026abb9eebc1c94e3a",
  "0xfa3fccfde8445f61507e717831faad6a2defdab95cf952654981258d98d72349",
  "0x876b0e878532640c747033f9db1798e58150867a34aa8224713bd513da7ad863",
  "0x43341f83f9ec618cc52dec04a637ccbc4978112b771832918f069dd74758b3a0",
  "0xe5e5bba241d7d4df55c973d5b4856536238d9ffa450cf5d44776a93729e29480",
  "0xacf7dcb3115b8ae238e795f6976504f4d24a56c26dec4afabd2f6585d3d1f1f4",
  "0x85de6df2db8c29f395d24ccfb6b085185b273e75caf6e1300b37060e7cf116ec",
  "0x0bc488fdf77655415071538f187522ee508da2c7935f921e244ffec16c74a363",
  "0x451729849d41daddc7913a69aa53b5825c57cc682bf21e092fa9d09a0cdc2874",
  "0x51c38face19e21293e6e704f521e0e78576350cabe94eb7494ca95122a47f3ea",
  "0xf23fa703f5a9e423bf9ce06c95af42de500c7baecd7a050bc2308ae6675e92d9",
  "0xd25b27c1e6f0a61665d1fb750e5b4b67b78d7292dfb488323166e32e460be3fb",
] as const;

const POOLS: Record<BotNetwork, readonly string[]> = {
  BSC: BSC_REFERENCE_TXS,
  POLYGON: POLYGON_REFERENCE_TXS,
};

const ALL_REFERENCE = new Set<string>([
  ...BSC_REFERENCE_TXS,
  ...POLYGON_REFERENCE_TXS,
]);

function hashSeed(seed: string): number {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) {
    n = (n + seed.charCodeAt(i) * (i + 1)) % 9973;
  }
  return n;
}

/** Pick a stable, verified on-chain reference tx for the given network. */
export function pickReferenceTxHash(network: BotNetwork, seed: string): string {
  const pool = POOLS[network];
  return pool[hashSeed(seed) % pool.length]!;
}

/** True when the hash comes from the old static fallback pool (stale on explorers). */
export function isLegacyReferenceTx(hash: string): boolean {
  return ALL_REFERENCE.has(hash.toLowerCase());
}
