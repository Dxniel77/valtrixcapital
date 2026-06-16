"use client";

import { useBackendUserSync } from "@/lib/hooks/use-backend-sync";

export function BackendUserSync() {
  useBackendUserSync();
  return null;
}
