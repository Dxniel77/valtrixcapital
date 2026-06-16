"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementTable } from "@/components/admin/movement-table";
import { useI18n } from "@/lib/i18n/context";
import type { AdminMovement } from "@/lib/admin/store";
import {
  filterMovementsByDay,
  formatMovementDayLabel,
  summarizeDailyMovements,
  utcDateKey,
} from "@/lib/admin/movements";
import { formatNumber } from "@/lib/utils";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  TrendingUp,
} from "lucide-react";

function shiftDayKey(dayKey: string, delta: number): string {
  const ms = Date.parse(`${dayKey}T12:00:00.000Z`) + delta * 86_400_000;
  return utcDateKey(ms);
}

export function DailyTransactionsPanel({
  movements,
  dayKey: controlledDayKey,
  onDayKeyChange,
  limit,
  showDateControls = true,
  showTable = true,
  title,
  viewAllHref,
}: {
  movements: AdminMovement[];
  dayKey?: string;
  onDayKeyChange?: (dayKey: string) => void;
  limit?: number;
  showDateControls?: boolean;
  showTable?: boolean;
  title?: string;
  viewAllHref?: string;
}) {
  const { t, locale } = useI18n();
  const [internalDay, setInternalDay] = React.useState(() => utcDateKey());
  const dayKey = controlledDayKey ?? internalDay;
  const setDayKey = onDayKeyChange ?? setInternalDay;

  const summary = React.useMemo(
    () => summarizeDailyMovements(movements, dayKey),
    [movements, dayKey],
  );
  const rows = React.useMemo(() => {
    const filtered = filterMovementsByDay(movements, dayKey);
    return limit != null ? filtered.slice(0, limit) : filtered;
  }, [movements, dayKey, limit]);

  const dateLocale =
    locale === "es"
      ? "es-ES"
      : locale === "en"
        ? "en-US"
        : `${locale}-${locale.toUpperCase()}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              {title ?? t("admin.movements.dailyTitle")}
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              {formatMovementDayLabel(dayKey, dateLocale)} · UTC
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showDateControls ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDayKey(shiftDayKey(dayKey, -1))}
                  aria-label={t("admin.movements.prevDay")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <input
                  type="date"
                  value={dayKey}
                  onChange={(e) => {
                    if (e.target.value) setDayKey(e.target.value);
                  }}
                  className="h-9 rounded-md border border-border-subtle bg-bg-base px-2 text-sm text-text-primary"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDayKey(shiftDayKey(dayKey, 1))}
                  disabled={dayKey >= utcDateKey()}
                  aria-label={t("admin.movements.nextDay")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDayKey(utcDateKey())}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("admin.movements.today")}
                </Button>
              </>
            ) : null}
            {viewAllHref ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={viewAllHref}>{t("admin.overview.viewAll")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t("admin.movements.summaryCount")}
            value={String(summary.count)}
            icon={Coins}
            accent="gold"
            hint={t("admin.movements.summaryCountHint")}
          />
          <StatTile
            label={t("admin.movements.summaryDeposits")}
            value={`$${formatNumber(summary.depositTotal, { decimals: 0 })}`}
            icon={ArrowDownToLine}
            accent="success"
            hint={t("admin.movements.summaryDepositsHint", {
              n: summary.deposits,
            })}
          />
          <StatTile
            label={t("admin.movements.summaryWithdrawals")}
            value={`$${formatNumber(summary.withdrawalTotal, { decimals: 0 })}`}
            icon={ArrowUpFromLine}
            accent="danger"
            hint={t("admin.movements.summaryWithdrawalsHint", {
              n: summary.withdrawals,
            })}
          />
          <StatTile
            label={t("admin.movements.summaryNet")}
            value={`$${formatNumber(summary.netFlow, { decimals: 0 })}`}
            icon={TrendingUp}
            accent="info"
            hint={t("admin.movements.summaryNetHint", {
              yields: summary.yields,
              commissions: summary.commissions,
            })}
          />
        </div>

        {showTable ? (
          <MovementTable
            rows={rows}
            emptyMessage={t("admin.movements.dailyEmpty")}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
