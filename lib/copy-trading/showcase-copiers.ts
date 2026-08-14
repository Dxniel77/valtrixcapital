export type ShowcaseCopier = {
  displayName: string;
  walletHint: string;
  isYou: false;
  margin: number;
  pnl: number;
  roiBps: number;
  durationDays: number;
  startedAt: string;
};

const NAME_PREFIXES = [
  "La",
  "Ma",
  "An",
  "Ca",
  "Jo",
  "Lu",
  "Sa",
  "Da",
  "El",
  "Mi",
  "No",
  "Pa",
  "Ra",
  "So",
  "Va",
  "Al",
  "Br",
  "Di",
  "Em",
  "Fe",
] as const;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable inclusive count for bulk assignment; capped by each trader's capacity. */
export function showcaseCountForTrader(
  traderId: string,
  min: number,
  max: number,
  maxInvestors: number,
): number {
  const low = Math.max(0, Math.min(200, Math.trunc(min)));
  const high = Math.max(low, Math.min(200, Math.trunc(max)));
  const capacity = Math.max(0, Math.trunc(maxInvestors));
  const span = high - low + 1;
  return Math.min(capacity, low + (hashSeed(`${traderId}:showcase-count`) % span));
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hex(random: () => number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += Math.floor(random() * 16).toString(16);
  }
  return value;
}

/** Stable public-only copier rows. These never create investments or ledger entries. */
export function generateShowcaseCopiers(
  traderId: string,
  count: number,
  now = new Date(),
): ShowcaseCopier[] {
  const safeCount = Math.max(0, Math.min(200, Math.trunc(count)));
  const seed = hashSeed(`${traderId}:showcase-copiers`);
  const random = seededRandom(seed);
  const nameOffset = seed % NAME_PREFIXES.length;
  const digitOffset = (seed >>> 8) % 10;

  return Array.from({ length: safeCount }, (_, index) => {
    const prefix = NAME_PREFIXES[(index + nameOffset) % NAME_PREFIXES.length];
    const digit =
      (Math.floor(index / NAME_PREFIXES.length) + digitOffset) % 10;
    const margin = Math.round((40 + random() * 2_460) * 100) / 100;
    const roiBps = Math.round(-400 + random() * 2_200);
    const durationDays = 1 + Math.floor(random() * 90);
    const startedAt = new Date(
      now.getTime() - durationDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      displayName: `${prefix}*****${digit}`,
      walletHint: `0x${hex(random, 4)}…${hex(random, 4)}`,
      isYou: false,
      margin,
      pnl: Math.round(((margin * roiBps) / 10_000) * 100) / 100,
      roiBps,
      durationDays,
      startedAt,
    };
  });
}
