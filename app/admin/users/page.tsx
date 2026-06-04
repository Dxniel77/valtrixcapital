"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowUpDown, Pencil, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THeadRow, TR } from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/context";
import {
  useAdminStore,
  type AdminUser,
} from "@/lib/admin/store";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";

type SortKey = "alias" | "capital" | "balance" | "joinedAt";

export default function AdminUsersPage() {
  const { t } = useI18n();
  const users = useAdminStore((s) => s.users);
  const setUserStatus = useAdminStore((s) => s.setUserStatus);

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("capital");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [editing, setEditing] = React.useState<AdminUser | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = users.filter(
      (u) =>
        !q ||
        u.alias.toLowerCase().includes(q) ||
        u.wallet.toLowerCase().includes(q),
    );
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort === "alias") cmp = a.alias.localeCompare(b.alias);
      else cmp = a[sort] - b[sort];
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [users, query, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("desc");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.users.searchPlaceholder")}
              className="w-full pl-8 sm:w-72"
            />
          </div>
        }
      />

      <Table>
        <thead>
          <THeadRow>
            <TH>
              <SortBtn label={t("admin.users.colUser")} onClick={() => toggleSort("alias")} />
            </TH>
            <TH>{t("admin.users.colNetwork")}</TH>
            <TH className="text-right">
              <SortBtn label={t("admin.users.colCapital")} onClick={() => toggleSort("capital")} align="right" />
            </TH>
            <TH className="text-right">
              <SortBtn label={t("admin.users.colBalance")} onClick={() => toggleSort("balance")} align="right" />
            </TH>
            <TH className="text-right">{t("admin.users.colReferrals")}</TH>
            <TH>{t("admin.users.colStatus")}</TH>
            <TH className="text-right">{t("admin.users.colActions")}</TH>
          </THeadRow>
        </thead>
        <TBody>
          {rows.map((u) => (
            <TR key={u.id}>
              <TD>
                <p className="font-medium text-text-primary">
                  {u.alias}
                  {u.role === "ADMIN" ? (
                    <Badge variant="gold" className="ml-2">
                      {t("admin.users.adminBadge")}
                    </Badge>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-text-muted">
                  {shortenAddress(u.wallet)}
                </p>
              </TD>
              <TD>
                <Badge variant="outline">{u.network}</Badge>
              </TD>
              <TD className="text-right font-mono text-text-secondary">
                ${formatNumber(u.capital, { decimals: 0 })}
              </TD>
              <TD className="text-right font-mono text-gold">
                ${formatNumber(u.balance, { decimals: 2 })}
              </TD>
              <TD className="text-right font-mono text-text-muted">{u.referrals}</TD>
              <TD>
                <Badge variant={u.status === "ACTIVE" ? "success" : "default"}>
                  {u.status === "ACTIVE"
                    ? t("admin.users.active")
                    : t("admin.users.inactive")}
                </Badge>
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(u)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("admin.users.adjust")}
                  </Button>
                  <Button
                    variant={u.status === "ACTIVE" ? "outline" : "primary"}
                    size="sm"
                    onClick={() => {
                      setUserStatus(
                        u.id,
                        u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                      );
                      toast.success(t("admin.users.statusUpdated"));
                    }}
                  >
                    {u.status === "ACTIVE"
                      ? t("admin.users.deactivate")
                      : t("admin.users.activate")}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <AdjustBalanceModal user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SortBtn({
  label,
  onClick,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 hover:text-text-primary",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function AdjustBalanceModal({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const adjustBalance = useAdminStore((s) => s.adjustBalance);
  const [deltaStr, setDeltaStr] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (user) {
      setDeltaStr("");
      setNote("");
    }
  }, [user]);

  const delta = Number(deltaStr.replace(/,/g, "."));
  const valid = Number.isFinite(delta) && delta !== 0;

  function apply() {
    if (!user || !valid) return;
    adjustBalance(user.id, delta, note);
    toast.success(t("admin.users.balanceAdjusted"));
    onClose();
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.adjustTitle")}</DialogTitle>
          <DialogDescription>
            {user
              ? t("admin.users.adjustSubtitle", {
                  user: user.alias,
                  balance: formatNumber(user.balance, { decimals: 2 }),
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.deltaLabel")}
            </label>
            <Input
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 100 / -50"
              className="font-mono"
            />
            <p className="text-xs text-text-muted">{t("admin.users.deltaHint")}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.noteLabel")}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.users.notePlaceholder")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t("admin.users.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={apply} disabled={!valid}>
            {t("admin.users.applyAdjust")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
