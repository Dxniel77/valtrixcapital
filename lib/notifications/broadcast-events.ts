import type {
  BroadcastListener,
  NotificationBroadcast,
} from "@/lib/notifications/broadcast-types";

type BroadcastHub = {
  memory: NotificationBroadcast[];
  listeners: Set<BroadcastListener>;
};

const globalHub = globalThis as unknown as {
  __valtrixBroadcastHub?: BroadcastHub;
};

function hub(): BroadcastHub {
  if (!globalHub.__valtrixBroadcastHub) {
    globalHub.__valtrixBroadcastHub = {
      memory: [],
      listeners: new Set(),
    };
  }
  return globalHub.__valtrixBroadcastHub;
}

export function rememberBroadcast(broadcast: NotificationBroadcast): void {
  const store = hub();
  store.memory = [broadcast, ...store.memory.filter((b) => b.id !== broadcast.id)].slice(
    0,
    50,
  );
}

export function listMemoryBroadcasts(since = 0): NotificationBroadcast[] {
  const items = hub().memory;
  if (since <= 0) return [...items];
  return items.filter((b) => b.createdAt > since);
}

export function emitBroadcast(broadcast: NotificationBroadcast): void {
  for (const listener of hub().listeners) {
    try {
      listener(broadcast);
    } catch {
      /* ignore listener failures */
    }
  }
}

export function subscribeBroadcasts(
  listener: BroadcastListener,
): () => void {
  hub().listeners.add(listener);
  return () => hub().listeners.delete(listener);
}
