import type { NotificationKind } from "@/lib/notifications/store";

export interface NotificationBroadcast {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: number;
  createdBy: string;
}

export type BroadcastListener = (broadcast: NotificationBroadcast) => void;
