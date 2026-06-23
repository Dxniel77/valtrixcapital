import {
  adminUpdateUserReferrer,
  ApiError,
  fetchAdminUsers,
  fetchBackendHealth,
} from "@/lib/api/client";
import { useAdminStore } from "@/lib/admin/store";
import type { SponsorUpdateError } from "@/lib/admin/sponsor";

/** Persists sponsor change to Postgres when available, then updates admin UI state. */
export async function changeAdminUserSponsor(
  userId: string,
  sponsorQuery: string | null,
): Promise<{ ok: true } | { ok: false; error: SponsorUpdateError }> {
  const health = await fetchBackendHealth();
  if (health.database) {
    const { users: dbUsers } = await fetchAdminUsers();
    const dbUser =
      dbUsers.find((d) => d.id === userId) ??
      dbUsers.find((d) => {
        const local = useAdminStore
          .getState()
          .users.find((u) => u.id === userId);
        return (
          !!local &&
          d.walletAddress.toLowerCase() === local.wallet.toLowerCase()
        );
      });
    if (!dbUser) {
      return { ok: false, error: "NOT_FOUND" };
    }

    try {
      await adminUpdateUserReferrer(dbUser.id, sponsorQuery);
      const { users: refreshed } = await fetchAdminUsers();
      useAdminStore.getState().mergeUsersFromBackend(refreshed);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.payload.code;
        if (
          code === "SPONSOR_NOT_FOUND" ||
          code === "SELF_SPONSOR" ||
          code === "CYCLE" ||
          code === "NOT_FOUND"
        ) {
          return { ok: false, error: code as SponsorUpdateError };
        }
      }
      throw err;
    }
  }

  return useAdminStore.getState().updateUserSponsor(userId, sponsorQuery);
}
