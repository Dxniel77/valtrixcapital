import type { Stake } from "@/lib/staking/store";

export function selectActiveCapital(stakes: Stake[]): number {
  let total = 0;
  for (const stake of stakes) {
    if (stake.status === "ACTIVE") total += stake.amount;
  }
  return total;
}

export function selectActiveStakeCount(stakes: Stake[]): number {
  let count = 0;
  for (const stake of stakes) {
    if (stake.status === "ACTIVE") count += 1;
  }
  return count;
}
