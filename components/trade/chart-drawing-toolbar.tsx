"use client";

import * as React from "react";
import {
  MousePointer2,
  Minus,
  TrendingUp,
  Square,
  GitBranch,
  Trash2,
  Eraser,
  ChevronsLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { DrawingTool } from "@/lib/trade/chart-drawings";
import { cn } from "@/lib/utils";

type ChartDrawingToolbarProps = {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClearAll: () => void;
  onUndo: () => void;
  onHide: () => void;
  drawingCount: number;
  className?: string;
};

const TOOLS: {
  id: DrawingTool;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { id: "cursor", icon: MousePointer2, labelKey: "trade.drawing.cursor" },
  { id: "hline", icon: Minus, labelKey: "trade.drawing.hline" },
  { id: "trend", icon: TrendingUp, labelKey: "trade.drawing.trend" },
  { id: "rect", icon: Square, labelKey: "trade.drawing.rect" },
  { id: "fib", icon: GitBranch, labelKey: "trade.drawing.fib" },
];

export function ChartDrawingToolbar({
  tool,
  onToolChange,
  onClearAll,
  onUndo,
  onHide,
  drawingCount,
  className,
}: ChartDrawingToolbarProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border border-border-subtle bg-bg-elevated/90 p-1 backdrop-blur-sm",
        className,
      )}
    >
      {TOOLS.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => onToolChange(id)}
          title={t(labelKey)}
          aria-label={t(labelKey)}
          aria-pressed={tool === id}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors",
            tool === id
              ? "bg-gold/20 text-gold"
              : "text-text-muted hover:bg-bg-base/80 hover:text-text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="my-0.5 h-px bg-border-subtle" />

      <button
        type="button"
        onClick={onUndo}
        disabled={drawingCount === 0}
        title={t("trade.drawing.undo")}
        aria-label={t("trade.drawing.undo")}
        className="flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-base/80 hover:text-text-primary disabled:opacity-30"
      >
        <Eraser className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClearAll}
        disabled={drawingCount === 0}
        title={t("trade.drawing.clearAll")}
        aria-label={t("trade.drawing.clearAll")}
        className="flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="my-0.5 h-px bg-border-subtle" />

      <button
        type="button"
        onClick={onHide}
        title={t("trade.drawing.hideToolbar")}
        aria-label={t("trade.drawing.hideToolbar")}
        className="flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-base/80 hover:text-text-primary"
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
