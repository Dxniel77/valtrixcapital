import type { NotificationBroadcast } from "@/lib/notifications/broadcast-types";

/** Broadcasts use in-memory storage unless explicitly enabled. */
export function broadcastDatabaseEnabled(): boolean {
  return process.env.BROADCAST_USE_DATABASE === "true";
}

type DbAvailability = "unknown" | "available" | "unavailable";

const globalBroadcastDb = globalThis as unknown as {
  __valtrixBroadcastDbState?: DbAvailability;
};

function getDbState(): DbAvailability {
  return globalBroadcastDb.__valtrixBroadcastDbState ?? "unknown";
}

function setDbState(state: DbAvailability): void {
  globalBroadcastDb.__valtrixBroadcastDbState = state;
}

export function shouldTryBroadcastDatabase(): boolean {
  if (!broadcastDatabaseEnabled()) return false;
  return getDbState() !== "unavailable";
}

export function markBroadcastDatabaseAvailable(): void {
  setDbState("available");
}

export function markBroadcastDatabaseUnavailable(): void {
  setDbState("unavailable");
}

/** Prefer memory when DB is off/unavailable; merge DB rows when persistence works. */
export function mergeBroadcastSources(
  memory: NotificationBroadcast[],
  database: NotificationBroadcast[] | null,
): NotificationBroadcast[] {
  if (!database || database.length === 0) {
    return memory.slice(0, 50);
  }

  const seen = new Set<string>();
  const merged: NotificationBroadcast[] = [];

  for (const item of [...database, ...memory]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    if (merged.length >= 50) break;
  }

  return merged;
}
