import { isAdminWallet, normalizeWallet } from "@/lib/auth/admins";
import { prisma } from "@/lib/db";

export type UserRole = "USER" | "ADMIN";

/**
 * Resolves session role: env allowlist first, then Prisma `User.role` when DB is available.
 */
export async function resolveUserRole(address: string): Promise<UserRole> {
  const wallet = normalizeWallet(address);

  if (isAdminWallet(wallet)) {
    return "ADMIN";
  }

  try {
    if (!process.env.DATABASE_URL) return "USER";

    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      select: { role: true },
    });
    if (user?.role === "ADMIN") return "ADMIN";
  } catch {
    // DB may be unavailable in local dev — env list still applies.
  }

  return "USER";
}
