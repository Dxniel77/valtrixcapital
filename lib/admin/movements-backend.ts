import { fetchAdminMovements } from "@/lib/api/client";
import { useAdminStore, type AdminMovement } from "@/lib/admin/store";

function mapBackendMovement(
  row: Awaited<ReturnType<typeof fetchAdminMovements>>["movements"][number],
): AdminMovement {
  return {
    id: row.id,
    type: row.type as AdminMovement["type"],
    wallet: row.wallet,
    amount: row.amount,
    network: (row.network as AdminMovement["network"]) ?? null,
    status: row.status,
    timestamp: row.timestamp,
    yieldKind: row.yieldKind,
  };
}

/** Refreshes the admin movements ledger from Postgres. */
export async function refreshAdminMovementsFromBackend(): Promise<void> {
  const { movements } = await fetchAdminMovements();
  useAdminStore.getState().replaceMovementsFromBackend(movements.map(mapBackendMovement));
}
