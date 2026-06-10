import type { PosterPeriod, PosterPeriodMeta } from "@/lib/share/earnings-periods";

export const POSTER_TEMPLATES: Record<PosterPeriod, string> = {
  daily: "/images/1.png",
  weekly: "/images/2.png",
  monthly: "/images/3.png",
  threeMonths: "/images/4.png",
};

const GOLD = "#D4AF37";
const GOLD_BRIGHT = "#E8C547";
const WHITE = "#F5F5F7";
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';

interface TextSlot {
  x: number;
  y: number;
  maxW: number;
  size: number;
}

interface PeriodLayout {
  amountMode: "digitsOnly" | "full";
  amount: TextSlot;
  suffix: { gap: number; size: number };
  date: TextSlot;
  username: TextSlot;
}

/**
 * Coordinates tuned against official templates (1024×~930px).
 * Daily: blank template — amount sits to the right of baked "+$".
 * Others: filled samples — only amount/date/username regions are cleared.
 */
const PERIOD_LAYOUT: Record<PosterPeriod, PeriodLayout> = {
  daily: {
    amountMode: "digitsOnly",
    amount: { x: 0.160, y: 0.400, maxW: 0.6, size: 0.200 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.170, y: 0.538, maxW: 0.52, size: 0.0240 },
    username: { x: 0.18, y: 0.642, maxW: 0.36, size: 0.035 },
  },
  weekly: {
    amountMode: "digitsOnly",
    amount: { x: 0.140, y: 0.440, maxW: 0.6, size: 0.200 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
  },
  monthly: {
    amountMode: "digitsOnly",
    amount: { x: 0.140, y: 0.440, maxW: 0.6, size: 0.200 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
  },
  threeMonths: {
    amountMode: "digitsOnly",
    amount: { x: 0.140, y: 0.440, maxW: 0.6, size: 0.200 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
  },
};

export interface PosterLabels {
  userLabel: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  maxWidth: number,
  startSize: number,
  minSize = 12,
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

function formatAmount(
  amount: number,
  mode: "digitsOnly" | "full",
): { main: string; suffix: string } {
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (mode === "digitsOnly") {
    return { main: `$${abs}`, suffix: "USD" };
  }
  const sign = amount >= 0 ? "+" : "-";
  return { main: `${sign} $${abs}`, suffix: "USD" };
}

function drawDynamicText(
  ctx: CanvasRenderingContext2D,
  meta: PosterPeriodMeta,
  username: string,
  width: number,
  height: number,
) {
  const layout = PERIOD_LAYOUT[meta.period];
  const { main, suffix } = formatAmount(meta.amount, layout.amountMode);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const amountX = layout.amount.x * width;
  const amountY = layout.amount.y * height;
  const maxW = layout.amount.maxW * width;
  const amountSize = fitFontSize(
    ctx,
    `${main} ${suffix}`,
    "700",
    maxW,
    layout.amount.size * height,
  );
  ctx.fillStyle = GOLD_BRIGHT;
  ctx.font = `700 ${amountSize}px ${FONT}`;
  ctx.fillText(main, amountX, amountY);

  const mainW = ctx.measureText(main).width;
  const suffixSize = Math.max(
    12,
    Math.min(layout.suffix.size * height, amountSize * 0.38),
  );
  ctx.font = `600 ${suffixSize}px ${FONT}`;
  ctx.fillStyle = GOLD;
  ctx.fillText(
    suffix,
    amountX + mainW + layout.suffix.gap * width,
    amountY - amountSize * 0.08,
  );

  const dateText = meta.rangeLabel.toUpperCase();
  const dateSize = fitFontSize(
    ctx,
    dateText,
    "500",
    layout.date.maxW * width,
    layout.date.size * height,
    10,
  );
  ctx.fillStyle = WHITE;
  ctx.font = `500 ${dateSize}px ${FONT}`;
  ctx.fillText(dateText, layout.date.x * width, layout.date.y * height);

  const userSize = fitFontSize(
    ctx,
    username,
    "700",
    layout.username.maxW * width,
    layout.username.size * height,
    11,
  );
  ctx.fillStyle = WHITE;
  ctx.font = `500 ${userSize}px ${FONT}`;
  ctx.fillText(username, layout.username.x * width, layout.username.y * height);
}

export async function renderEarningsPoster(
  meta: PosterPeriodMeta,
  username: string,
  _labels: PosterLabels,
): Promise<string> {
  const templateSrc = POSTER_TEMPLATES[meta.period];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const template = await loadImage(templateSrc);
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  drawDynamicText(ctx, meta, username, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
