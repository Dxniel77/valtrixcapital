import type { AdminMovement } from "@/lib/admin/store";
import { downloadCsv } from "@/lib/ledger";

export interface CashFlowSummary {
  inflow: number;
  outflow: number;
  net: number;
  pendingOutflow: number;
  depositCount: number;
  withdrawalCount: number;
  yieldPaid: number;
  commissionPaid: number;
}

export function computeCashFlow(
  movements: AdminMovement[],
  fromMs: number,
  toMs: number,
): CashFlowSummary {
  const filtered = movements.filter(
    (m) => m.timestamp >= fromMs && m.timestamp <= toMs,
  );

  let inflow = 0;
  let outflow = 0;
  let pendingOutflow = 0;
  let depositCount = 0;
  let withdrawalCount = 0;
  let yieldPaid = 0;
  let commissionPaid = 0;

  for (const m of filtered) {
    if (m.type === "DEPOSIT") {
      inflow += m.amount;
      depositCount += 1;
    } else if (m.type === "WITHDRAWAL") {
      withdrawalCount += 1;
      if (m.status === "COMPLETED") {
        outflow += m.amount;
      } else if (m.status !== "REJECTED") {
        pendingOutflow += m.amount;
      }
    } else if (m.type === "YIELD") {
      yieldPaid += m.amount;
    } else if (m.type === "COMMISSION") {
      commissionPaid += m.amount;
    }
  }

  return {
    inflow: round(inflow),
    outflow: round(outflow),
    net: round(inflow - outflow),
    pendingOutflow: round(pendingOutflow),
    depositCount,
    withdrawalCount,
    yieldPaid: round(yieldPaid),
    commissionPaid: round(commissionPaid),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function cashFlowToCsv(
  movements: AdminMovement[],
  fromMs: number,
  toMs: number,
): string {
  const summary = computeCashFlow(movements, fromMs, toMs);
  const filtered = movements
    .filter((m) => m.timestamp >= fromMs && m.timestamp <= toMs)
    .sort((a, b) => a.timestamp - b.timestamp);

  const lines = [
    "section,key,value",
    `summary,inflow,${summary.inflow}`,
    `summary,outflow,${summary.outflow}`,
    `summary,net,${summary.net}`,
    `summary,pending_outflow,${summary.pendingOutflow}`,
    `summary,yield_paid,${summary.yieldPaid}`,
    `summary,commission_paid,${summary.commissionPaid}`,
    "",
    "date,type,wallet,amount,network,status",
    ...filtered.map((m) =>
      [
        new Date(m.timestamp).toISOString(),
        m.type,
        m.wallet,
        m.amount,
        m.network ?? "",
        m.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function exportCashFlowCsv(
  movements: AdminMovement[],
  fromMs: number,
  toMs: number,
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(
    `valtrix-cashflow-${stamp}.csv`,
    cashFlowToCsv(movements, fromMs, toMs),
  );
}
