import type { ChartIndicatorState } from "@/components/trade/chart-indicators";

export type ChartStrategyId =
  | "custom"
  | "scalping"
  | "trend"
  | "volatility"
  | "clean";

export type ChartStrategy = {
  id: ChartStrategyId;
  labelKey: string;
  descriptionKey: string;
  indicators: ChartIndicatorState;
};

export const CHART_STRATEGIES: ChartStrategy[] = [
  {
    id: "scalping",
    labelKey: "trade.strategies.scalping",
    descriptionKey: "trade.strategies.scalpingDesc",
    indicators: {
      volume: true,
      ema9: true,
      ema20: true,
      ema50: false,
      ema200: false,
      bollinger: false,
      rsi: false,
    },
  },
  {
    id: "trend",
    labelKey: "trade.strategies.trend",
    descriptionKey: "trade.strategies.trendDesc",
    indicators: {
      volume: true,
      ema9: false,
      ema20: false,
      ema50: true,
      ema200: true,
      bollinger: false,
      rsi: false,
    },
  },
  {
    id: "volatility",
    labelKey: "trade.strategies.volatility",
    descriptionKey: "trade.strategies.volatilityDesc",
    indicators: {
      volume: false,
      ema9: false,
      ema20: true,
      ema50: false,
      ema200: false,
      bollinger: true,
      rsi: true,
    },
  },
  {
    id: "clean",
    labelKey: "trade.strategies.clean",
    descriptionKey: "trade.strategies.cleanDesc",
    indicators: {
      volume: false,
      ema9: false,
      ema20: false,
      ema50: false,
      ema200: false,
      bollinger: false,
      rsi: false,
    },
  },
];

export function indicatorsMatchStrategy(
  indicators: ChartIndicatorState,
  strategy: ChartStrategy,
): boolean {
  const keys = Object.keys(strategy.indicators) as (keyof ChartIndicatorState)[];
  return keys.every((k) => indicators[k] === strategy.indicators[k]);
}

export function detectStrategyId(
  indicators: ChartIndicatorState,
): ChartStrategyId {
  const match = CHART_STRATEGIES.find((s) =>
    indicatorsMatchStrategy(indicators, s),
  );
  return match?.id ?? "custom";
}
