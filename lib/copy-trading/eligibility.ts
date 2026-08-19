/**
 * Capital already in the trader at close takes that result (HTML simulator).
 */
export function eligibleForLiveOperation(
  startedAt: Date,
  closedAt: Date,
): boolean {
  return startedAt.getTime() <= closedAt.getTime();
}
