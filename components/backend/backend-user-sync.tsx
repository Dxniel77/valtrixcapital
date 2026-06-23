"use client";

import { useBackendUserSync } from "@/lib/hooks/use-backend-sync";
import { usePlatformConfigSync } from "@/lib/hooks/use-platform-config-sync";
import { useReferralsSync } from "@/lib/hooks/use-referrals-sync";

export function BackendUserSync() {
  useBackendUserSync();
  usePlatformConfigSync();
  useReferralsSync();
  return null;
}
