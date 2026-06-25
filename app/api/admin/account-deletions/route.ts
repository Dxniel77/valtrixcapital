import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isDatabaseAvailable } from "@/lib/db/available";
import { getAdminActorId } from "@/lib/services/admin";
import {
  AccountManagementError,
  adminProcessDeletionRequest,
  listDeletionRequests,
} from "@/lib/services/account-management";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const requests = await listDeletionRequests();
  return NextResponse.json({ requests });
}
