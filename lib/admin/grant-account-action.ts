import {
  adminProvisionUser,
  fetchAdminUsers,
  fetchBackendHealth,
} from "@/lib/api/client";
import { useAdminStore } from "@/lib/admin/store";
import type { WithdrawalRule } from "@/lib/admin/withdrawal-eligibility";

/** Creates/updates user in Postgres when available, then refreshes admin UI state. */
export async function grantAdminAccount(input: {
  wallet: string;
  rule: WithdrawalRule;
  uplineWallet?: string | null;
  initialActiveCapital?: number;
  requirementDeadlineDays?: number;
}): Promise<void> {
  const health = await fetchBackendHealth();
  if (health.database) {
    await adminProvisionUser({
      walletAddress: input.wallet.trim(),
      referrerWallet: input.uplineWallet ?? null,
      withdrawalRule: input.rule,
      initialActiveCapital: input.initialActiveCapital ?? 0,
      requirementDeadlineDays: input.requirementDeadlineDays,
    });
    const { users } = await fetchAdminUsers();
    useAdminStore.getState().mergeUsersFromBackend(users);
    return;
  }

  useAdminStore.getState().grantAccount(input);
}
