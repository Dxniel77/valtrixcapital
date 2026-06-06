import type { LedgerEntry } from "@/lib/ledger";
import { downloadCsv } from "@/lib/ledger";
import type { Withdrawal } from "@/lib/wallet/store";

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
    .join(",");
}

export function exportEarningsCsv(entries: LedgerEntry[]): void {
  const filtered = entries.filter(
    (e) => e.category === "YIELD" || e.category === "COMMISSION",
  );
  const header = ["date", "category", "amount", "status", "network", "note"];
  const rows = filtered.map((e) =>
    csvRow([
      new Date(e.timestamp).toISOString(),
      e.category,
      e.amount,
      e.status ?? "",
      e.network ?? "",
      e.pair ?? "",
    ]),
  );
  downloadCsv(
    `valtrix-ganancias-${dateStamp()}.csv`,
    [header.join(","), ...rows].join("\n"),
  );
}

export function exportWithdrawalsCsv(withdrawals: Withdrawal[]): void {
  const header = [
    "date",
    "amount",
    "fee",
    "net",
    "network",
    "destination",
    "status",
  ];
  const rows = withdrawals.map((w) =>
    csvRow([
      new Date(w.createdAt).toISOString(),
      w.amount,
      w.fee,
      w.netAmount,
      w.network,
      w.destination,
      w.status,
    ]),
  );
  downloadCsv(
    `valtrix-retiros-${dateStamp()}.csv`,
    [header.join(","), ...rows].join("\n"),
  );
}

export function exportNetworkCsv(entries: LedgerEntry[]): void {
  const filtered = entries.filter((e) => e.category === "COMMISSION");
  const header = ["date", "amount", "status", "source_wallet", "network"];
  const rows = filtered.map((e) =>
    csvRow([
      new Date(e.timestamp).toISOString(),
      e.amount,
      e.status ?? "",
      e.sourceWallet ?? "",
      e.network ?? "",
    ]),
  );
  downloadCsv(
    `valtrix-red-${dateStamp()}.csv`,
    [header.join(","), ...rows].join("\n"),
  );
}

export function exportOperationalCsv(entries: LedgerEntry[]): void {
  const filtered = entries.filter(
    (e) => e.category === "TRADE" || e.category === "YIELD",
  );
  const header = ["date", "category", "amount", "pair", "status", "tx_hash"];
  const rows = filtered.map((e) =>
    csvRow([
      new Date(e.timestamp).toISOString(),
      e.category,
      e.amount,
      e.pair ?? "",
      e.status ?? "",
      e.txHash ?? "",
    ]),
  );
  downloadCsv(
    `valtrix-operativa-${dateStamp()}.csv`,
    [header.join(","), ...rows].join("\n"),
  );
}
