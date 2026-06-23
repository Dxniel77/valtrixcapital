import {
  dtoToPlatformSettings,
  platformSettingsToPatch,
} from "@/lib/platform/config-map";
import {
  fetchPlatformConfig,
  updatePlatformConfig,
} from "@/lib/api/client";
import { usePlatformSettingsStore } from "@/lib/platform/settings-store";
import { loadBackendAvailability } from "@/lib/hooks/use-backend-sync";

/** Loads platform config from Postgres into the settings store. */
export async function syncPlatformConfigFromBackend(): Promise<boolean> {
  const available = await loadBackendAvailability();
  if (!available) return false;

  const res = await fetchPlatformConfig();
  if (!res.backend || !res.config) return false;

  usePlatformSettingsStore
    .getState()
    .updateSettings(dtoToPlatformSettings(res.config));
  return true;
}

/** Persists platform settings to Postgres and updates local store. */
export async function savePlatformSettingsToBackend(
  settings: ReturnType<typeof usePlatformSettingsStore.getState>["settings"],
): Promise<void> {
  const res = await updatePlatformConfig(platformSettingsToPatch(settings));
  usePlatformSettingsStore
    .getState()
    .updateSettings(dtoToPlatformSettings(res.config));
}
