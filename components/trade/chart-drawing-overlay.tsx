"use client";

import * as React from "react";
import type { ChartCoordsApi } from "@/components/trade/trading-chart";
import {
  type ChartDrawing,
  type ChartPoint,
  type DrawingTool,
  createDrawingId,
  DRAWING_COLORS,
  FIB_LEVELS,
  fibPriceAtLevel,
} from "@/lib/trade/chart-drawings";

type ChartDrawingOverlayProps = {
  tool: DrawingTool;
  drawings: ChartDrawing[];
  onDrawingsChange: (next: ChartDrawing[]) => void;
  coordsApi: ChartCoordsApi | null;
  className?: string;
};

type DraftState =
  | { type: "hline"; price: number }
  | { type: "trend" | "rect" | "fib"; p1: ChartPoint; p2: ChartPoint };

function pointFromEvent(
  e: React.PointerEvent<SVGSVGElement>,
  coordsApi: ChartCoordsApi,
): ChartPoint | null {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const time = coordsApi.xToTime(x);
  const price = coordsApi.yToPrice(y);
  if (time == null || price == null) return null;
  return { time, price };
}

function renderDrawing(
  d: ChartDrawing,
  coordsApi: ChartCoordsApi,
  key: string,
  width: number,
) {
  const color = d.color;

  if (d.type === "hline") {
    const y = coordsApi.priceToY(d.price);
    if (y == null) return null;
    return (
      <line
        key={key}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
    );
  }

  const x1 = coordsApi.timeToX(d.p1.time);
  const y1 = coordsApi.priceToY(d.p1.price);
  const x2 = coordsApi.timeToX(d.p2.time);
  const y2 = coordsApi.priceToY(d.p2.price);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;

  if (d.type === "trend") {
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
      />
    );
  }

  if (d.type === "rect") {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    return (
      <rect
        key={key}
        x={left}
        y={top}
        width={width}
        height={height}
        fill={`${color}22`}
        stroke={color}
        strokeWidth={1.5}
      />
    );
  }

  if (d.type === "fib") {
    const high = Math.max(d.p1.price, d.p2.price);
    const low = Math.min(d.p1.price, d.p2.price);
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    return (
      <g key={key}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />
        {FIB_LEVELS.map((level) => {
          const price = fibPriceAtLevel(high, low, level);
          const y = coordsApi.priceToY(price);
          if (y == null) return null;
          return (
            <g key={`${key}-${level}`}>
              <line
                x1={left}
                y1={y}
                x2={right}
                y2={y}
                stroke={color}
                strokeWidth={1}
                opacity={level === 0 || level === 1 ? 1 : 0.7}
              />
              <text
                x={right + 4}
                y={y + 3}
                fill={color}
                fontSize={9}
                fontFamily="monospace"
              >
                {(level * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return null;
}

export function ChartDrawingOverlay({
  tool,
  drawings,
  onDrawingsChange,
  coordsApi,
  className,
}: ChartDrawingOverlayProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [tick, setTick] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const colorIndexRef = React.useRef(0);

  const interactive = tool !== "cursor";

  React.useEffect(() => {
    if (!coordsApi) return;
    return coordsApi.subscribeChange(() => {
      setTick((n) => n + 1);
      if (svgRef.current) setWidth(svgRef.current.clientWidth);
    });
  }, [coordsApi]);

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    setDraft(null);
  }, [tool]);

  function nextColor() {
    const color = DRAWING_COLORS[colorIndexRef.current % DRAWING_COLORS.length]!;
    colorIndexRef.current += 1;
    return color;
  }

  function commitDrawing(state: DraftState) {
    const color = nextColor();
    let drawing: ChartDrawing;

    if (state.type === "hline") {
      drawing = { id: createDrawingId(), type: "hline", price: state.price, color };
    } else {
      drawing = {
        id: createDrawingId(),
        type: state.type,
        p1: state.p1,
        p2: state.p2,
        color,
      };
    }

    onDrawingsChange([...drawings, drawing]);
    setDraft(null);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || !coordsApi) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = pointFromEvent(e, coordsApi);
    if (!pt) return;

    if (tool === "hline") {
      setDraft({ type: "hline", price: pt.price });
      return;
    }

    setDraft({ type: tool, p1: pt, p2: pt });
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draft || !coordsApi) return;
    const pt = pointFromEvent(e, coordsApi);
    if (!pt) return;

    if (draft.type === "hline") {
      setDraft({ type: "hline", price: pt.price });
      return;
    }

    setDraft({ ...draft, p2: pt });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!draft || !coordsApi) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (draft.type === "hline") {
      commitDrawing(draft);
      return;
    }

    const dx = Math.abs(draft.p2.time - draft.p1.time);
    const dy = Math.abs(draft.p2.price - draft.p1.price);
    if (dx > 0 || dy > 0) {
      commitDrawing(draft);
    } else {
      setDraft(null);
    }
  }

  void tick;

  const draftDrawing: ChartDrawing | null = draft
    ? draft.type === "hline"
      ? {
          id: "__draft__",
          type: "hline",
          price: draft.price,
          color: "#D4AF37",
        }
      : {
          id: "__draft__",
          type: draft.type,
          p1: draft.p1,
          p2: draft.p2,
          color: "#D4AF37",
        }
    : null;

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{
        pointerEvents: interactive ? "auto" : "none",
        cursor: interactive ? "crosshair" : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {coordsApi
        ? drawings.map((d) => renderDrawing(d, coordsApi, d.id, width))
        : null}
      {coordsApi && draftDrawing
        ? renderDrawing(draftDrawing, coordsApi, "__draft__", width)
        : null}
    </svg>
  );
}
