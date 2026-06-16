import type {
  DailyYield,
  PendingDeposit,
  Stake,
  StakingNetwork,
} from "@/lib/staking/store";
import type { Withdrawal, WithdrawalStatus } from "@/lib/wallet/store";

export interface StakeDto {
  id: string;
  amount: number;
  network: StakingNetwork;
  status: Stake["status"];
  txHash: string;
  createdAt: number;
  confirmedAt?: number;
}

export interface DailyYieldDto {
  id: string;
  date: string;
  capitalSnapshot: number;
  baseRateBps: number;
  bonusRateBps: number;
  totalRateBps: number;
  wins: number;
  losses: number;
  creditedAmount: number;
  createdAt: number;
}

export interface WithdrawalDto {
  id: string;
  network: StakingNetwork;
  amount: number;
  fee: number;
  netAmount: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface PortfolioDto {
  earningsBalance: number;
  totalEarned: number;
  lockedCapital: number;
  stakes: StakeDto[];
  pendingDeposit: PendingDeposit | null;
  dailyYields: DailyYieldDto[];
  withdrawals: WithdrawalDto[];
}

function mapWithdrawalStatus(status: string): WithdrawalStatus {
  switch (status) {
    case "APPROVED":
      return "REVIEW";
    case "SENT":
      return "PROCESSING";
    case "CONFIRMED":
      return "COMPLETED";
    case "REJECTED":
      return "REJECTED";
    default:
      return "REQUESTED";
  }
}

export function mapServerWithdrawal(w: WithdrawalDto): Withdrawal {
  return {
    id: w.id,
    amount: w.amount,
    feeBps: w.amount > 0 ? Math.round((w.fee / w.amount) * 10_000) : 0,
    fee: w.fee,
    netAmount: w.netAmount,
    network: w.network,
    destination: w.toAddress,
    status: mapWithdrawalStatus(w.status),
    txHash: w.txHash,
    createdAt: new Date(w.requestedAt).getTime(),
    updatedAt: new Date(w.processedAt ?? w.requestedAt).getTime(),
  };
}

export function mapServerStake(st: StakeDto): Stake {
  return {
    id: st.id,
    amount: st.amount,
    network: st.network,
    status: st.status,
    txHash: st.txHash,
    createdAt: st.createdAt,
    confirmedAt: st.confirmedAt,
  };
}

export function mapServerDailyYield(y: DailyYieldDto): DailyYield {
  return {
    id: y.id,
    date: y.date,
    capitalSnapshot: y.capitalSnapshot,
    baseRateBps: y.baseRateBps,
    bonusRateBps: y.bonusRateBps,
    totalRateBps: y.totalRateBps,
    wins: y.wins,
    losses: y.losses,
    creditedAmount: y.creditedAmount,
    createdAt: y.createdAt,
  };
}
