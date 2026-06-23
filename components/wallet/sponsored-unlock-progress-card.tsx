"use client";

import { Check, Lock, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WithdrawalVolumeProgress } from "@/components/admin/withdrawal-volume-progress";
import { progressItemsForUser } from "@/lib/admin/withdrawal-progress";
import type { AdminUser } from "@/lib/admin/store";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type SponsoredUser = Pick<
  AdminUser,
  | "accountGranted"
  | "withdrawalUnlocked"
  | "withdrawalRule"
  | "directSalesVolume"
  | "levelVolumes"
>;

export function SponsoredUnlockProgressCard({
  user,
  className,
  compact = false,
}: {
  user: SponsoredUser | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();

  if (!user?.accountGranted) return null;

  const items = progressItemsForUser(user);
  if (items.length === 0) return null;

  const unlocked = user.withdrawalUnlocked;

  return (
    <Card
      className={cn(
        unlocked
          ? "border-success/30 bg-success/5"
          : "border-warning/30 bg-warning/5",
        className,
      )}
    >
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                unlocked ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
              )}
            >
              {unlocked ? (
                <Check className="h-4 w-4" />
              ) : (
                <Target className="h-4 w-4" />
              )}
            </div>
            <div>
              <CardTitle className={cn("text-base", compact && "text-sm")}>
                {t("walletPage.sponsoredProgress.title")}
              </CardTitle>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                {unlocked
                  ? t("walletPage.sponsoredProgress.unlockedHint")
                  : t("walletPage.sponsoredProgress.lockedHint")}
              </p>
            </div>
          </div>
          <Badge variant={unlocked ? "success" : "warning"}>
            {unlocked ? (
              t("admin.lookup.withdrawOk")
            ) : (
              <>
                <Lock className="mr-1 h-3 w-3" />
                {t("admin.lookup.withdrawLocked")}
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <WithdrawalVolumeProgress
          items={items}
          unlocked={unlocked}
          detailed
          compact={compact}
        />
      </CardContent>
    </Card>
  );
}
