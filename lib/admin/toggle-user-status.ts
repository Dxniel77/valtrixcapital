import {
  adminSetUserActive,
  fetchAdminUsers,
  fetchBackendHealth,
} from "@/lib/api/client";
import { useAdminStore, type AdminUser, type AdminUserStatus } from "@/lib/admin/store";

/** Persists activate/deactivate to Postgres when available, then updates admin UI state. */
export async function toggleAdminUserStatus(
  user: AdminUser,
): Promise<AdminUserStatus> {
  const nextStatus: AdminUserStatus =
    user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  const health = await fetchBackendHealth();
  if (health.database) {
    const { users: dbUsers } = await fetchAdminUsers();
    const dbUser =
      dbUsers.find((d) => d.id === user.id) ??
      dbUsers.find(
        (d) => d.walletAddress.toLowerCase() === user.wallet.toLowerCase(),
      );
    if (!dbUser) {
      throw new Error("User not found in database");
    }

    await adminSetUserActive(dbUser.id, nextStatus === "ACTIVE");
    useAdminStore.getState().setUserStatus(dbUser.id, nextStatus, user.wallet);

    return nextStatus;
  }

  useAdminStore.getState().setUserStatus(user.id, nextStatus, user.wallet);
  return nextStatus;
}
