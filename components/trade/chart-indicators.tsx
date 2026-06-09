"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  Check,
  ChevronDown,
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  CHART_STRATEGIES,
  detectStrategyId,
  type ChartStrategy,
  type ChartStrategyId,
} from "@/lib/trade/chart-strategies";
import { cn } from "@/lib/utils";

export type ChartIndicatorState = {
  volume: boolean;
  ema9: boolean;
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  bollinger: boolean;
  rsi: boolean;
};

export const DEFAULT_CHART_INDICATORS: ChartIndicatorState = {
  volume: true,
  ema9: false,
  ema20: true,
  ema50: false,
  ema200: false,
  bollinger: false,
  rsi: false,
};

const INDICATORS_STORAGE_KEY = "valtrix-chart-indicators";

export function loadStoredIndicators(): ChartIndicatorState {
  if (typeof window === "undefined") return DEFAULT_CHART_INDICATORS;
  try {
    const raw = localStorage.getItem(INDICATORS_STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_INDICATORS;
    const parsed = JSON.parse(raw) as Partial<ChartIndicatorState>;
    return { ...DEFAULT_CHART_INDICATORS, ...parsed };
  } catch {
    return DEFAULT_CHART_INDICATORS;
  }
}

export function saveStoredIndicators(state: ChartIndicatorState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INDICATORS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

type ChartIndicatorsProps = {
  value: ChartIndicatorState;
  onChange: (next: ChartIndicatorState) => void;
  onResetZoom?: () => void;
  className?: string;
};

const STRATEGY_ICONS: Record<
  ChartStrategyId,
  React.ComponentType<{ className?: string }>
> = {
  custom: SlidersHorizontal,
  scalping: Zap,
  trend: TrendingUp,
  volatility: Activity,
  clean: Minimize2,
};

function StrategySelector({
  activeId,
  onSelect,
}: {
  activeId: ChartStrategyId;
  onSelect: (id: ChartStrategyId) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const activeLabel =
    activeId === "custom"
      ? t("trade.strategies.custom")
      : t(
          CHART_STRATEGIES.find((s) => s.id === activeId)?.labelKey ??
            "trade.strategies.custom",
        );

  const ActiveIcon = STRATEGY_ICONS[activeId];

  function renderOption(
    id: ChartStrategyId,
    labelKey: string,
    descriptionKey?: string,
  ) {
    const selected = activeId === id;
    const Icon = STRATEGY_ICONS[id];
    return (
      <DropdownMenu.Item
        key={id}
        className={cn(
          "flex cursor-pointer select-none items-start gap-2.5 rounded-md px-2.5 py-2 outline-none",
          "focus:bg-bg-hover data-[highlighted]:bg-bg-hover",
          selected &&
            "bg-gold/10 focus:bg-gold/15 data-[highlighted]:bg-gold/15",
        )}
        onSelect={() => onSelect(id)}
      >
        <Icon
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0",
            selected ? "text-gold" : "text-text-muted",
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-xs font-medium leading-tight",
              selected ? "text-gold" : "text-text-primary",
            )}
          >
            {t(labelKey)}
          </span>
          {descriptionKey ? (
            <span className="mt-0.5 block text-[10px] leading-snug text-text-muted">
              {t(descriptionKey)}
            </span>
          ) : null}
        </span>
        {selected ? (
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
      </DropdownMenu.Item>
    );
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-[160px] items-center gap-1.5 truncate rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:max-w-none",
            open
              ? "border-gold/40 bg-gold/10 text-text-primary"
              : "border-border-subtle bg-bg-base/50 text-text-secondary hover:border-border-strong hover:text-text-primary",
          )}
          title={t("trade.strategies.title")}
        >
          <ActiveIcon className="h-3 w-3 shrink-0 text-gold/80" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 opacity-60 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-64 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated/95 p-1.5 shadow-xl backdrop-blur-md",
            "border-r-2 border-r-gold/50",
            "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {t("trade.strategies.title")}
          </p>
          {renderOption("custom", "trade.strategies.custom")}
          <DropdownMenu.Separator className="my-1 h-px bg-border-subtle" />
          {CHART_STRATEGIES.map((strategy: ChartStrategy) =>
            renderOption(strategy.id, strategy.labelKey, strategy.descriptionKey),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ChartIndicators({
  value,
  onChange,
  onResetZoom,
  className,
}: ChartIndicatorsProps) {
  const { t } = useI18n();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const activeStrategyId = detectStrategyId(value);

  const toggles: {
    key: keyof ChartIndicatorState;
    label: string;
    color?: string;
  }[] = [
    { key: "volume", label: t("trade.indicators.volume") },
    { key: "ema9", label: t("trade.indicators.ema9"), color: "#22C55E" },
    { key: "ema20", label: t("trade.indicators.ema20"), color: "#F97316" },
    { key: "ema50", label: t("trade.indicators.ema50"), color: "#A855F7" },
    { key: "ema200", label: t("trade.indicators.ema200"), color: "#26C6DA" },
    { key: "bollinger", label: t("trade.indicators.bollinger"), color: "#D4AF37" },
    { key: "rsi", label: t("trade.indicators.rsi"), color: "#EC4899" },
  ];

  const activeCount = toggles.filter(({ key }) => value[key]).length;

  function toggle(key: keyof ChartIndicatorState) {
    onChange({ ...value, [key]: !value[key] });
  }

  function applyStrategy(id: ChartStrategyId) {
    if (id === "custom") return;
    const strategy = CHART_STRATEGIES.find((s) => s.id === id);
    if (strategy) onChange(strategy.indicators);
  }

  React.useEffect(() => {
    if (!panelOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [panelOpen]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto border-b border-border-subtle px-3 py-2",
        "scrollbar-none",
        className,
      )}
    >
      <div className="relative shrink-0" ref={panelRef}>
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            panelOpen
              ? "border-gold/40 bg-gold/10 text-text-primary"
              : "border-border-subtle bg-bg-base/50 text-text-muted hover:border-border-strong hover:text-text-secondary",
          )}
          aria-expanded={panelOpen}
        >
          <SlidersHorizontal className="h-3 w-3" />
          {t("trade.indicators.title")}
          {activeCount > 0 ? (
            <span className="rounded bg-gold/20 px-1 text-[10px] text-gold">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", panelOpen && "rotate-180")}
          />
        </button>

        {panelOpen ? (
          <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-border-subtle bg-bg-elevated p-2 shadow-xl">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t("trade.indicators.overlays")}
            </p>
            <div className="space-y-0.5">
              {toggles.map(({ key, label, color }) => {
                const active = value[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      active
                        ? "bg-gold/10 text-text-primary"
                        : "text-text-muted hover:bg-bg-base/80 hover:text-text-secondary",
                    )}
                    aria-pressed={active}
                  >
                    {color ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: active ? color : "hsl(var(--text-muted))",
                        }}
                      />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-text-muted/40" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden h-4 w-px shrink-0 bg-border-subtle sm:block" />

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:inline">
          {t("trade.strategies.title")}
        </span>
        <StrategySelector
          activeId={activeStrategyId}
          onSelect={applyStrategy}
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
        {toggles
          .filter(({ key }) => value[key])
          .map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-text-primary"
            >
              {color ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ) : null}
              {label}
              <span className="text-text-muted">×</span>
            </button>
          ))}
      </div>

      {onResetZoom ? (
        <button
          type="button"
          onClick={onResetZoom}
          className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          title={t("trade.indicators.resetZoom")}
        >
          <RotateCcw className="h-3 w-3" />
          <span className="hidden sm:inline">{t("trade.indicators.resetZoom")}</span>
        </button>
      ) : null}
    </div>
  );
}
