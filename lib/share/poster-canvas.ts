import type { PosterPeriod, PosterPeriodMeta } from "@/lib/share/earnings-periods";

export const POSTER_TEMPLATES: Record<PosterPeriod, string> = {
  daily: "/images/1.png",
  weekly: "/images/2.png",
  monthly: "/images/2.png",
  threeMonths: "/images/2.png",
};

const GOLD = "#D4AF37";
const GOLD_BRIGHT = "#E8C547";
const WHITE = "#F5F5F7";
const MUTED = "#A8A8B0";
const BLACK = "#000000";
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Fractional slot (0–1) relative to template width/height. */
export interface TextSlot {
  x: number;
  y: number;
  maxW: number;
  size: number;
}

export interface FeaturesSlot {
  x: number;
  y0: number;
  lineH: number;
  maxW: number;
  size: number;
}

export interface DisclaimerSlot {
  y: number;
  maxW: number;
  size: number;
  /** Extra gap between the two disclaimer paragraphs (fraction of height). */
  paragraphGap?: number;
}

/**
 * Per-template text positions. Edit `daily` vs `weekly` blocks to align copy
 * with `/images/1.png` (daily) and `/images/2.png` (weekly/monthly/3-month).
 * All x/y/size values are fractions of the rendered canvas (1024×~930).
 */
export interface PosterTextLayout {
  amountMode: "digitsOnly" | "full";
  heading: TextSlot;
  /** Shown on daily poster only (e.g. "TODAY" / "HEUTE"). */
  todayTag?: TextSlot;
  amount: TextSlot;
  suffix: { gap: number; size: number };
  date: TextSlot;
  username: TextSlot;
  features: FeaturesSlot;
  disclaimer: DisclaimerSlot;
}

export const POSTER_TEXT_LAYOUT: Record<PosterPeriod, PosterTextLayout> = {
  /** Template: /images/1.png — includes large "today" line under amount */
  daily: {
    amountMode: "digitsOnly",
    heading: { x: 0.1, y: 0.28, maxW: 0.58, size: 0.031 },
    todayTag: { x: 0.1, y: 0.48, maxW: 0.3, size: 0.06 },
    amount: { x: 0.16, y: 0.4, maxW: 0.6, size: 0.2 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.17, y: 0.538, maxW: 0.52, size: 0.024 },
    username: { x: 0.18, y: 0.642, maxW: 0.36, size: 0.035 },
    features: { x: 0.17, y0: 0.715, lineH: 0.06, maxW: 0.55, size: 0.023 },
    disclaimer: { y: 0.96, maxW: 0.98, size: 0.025, paragraphGap: 0.05 },
  },
  /** Template: /images/2.png — no "today" line; heading sits higher */
  weekly: {
    amountMode: "digitsOnly",
    heading: { x: 0.09, y: 0.31, maxW: 0.58, size: 0.031 },
    amount: { x: 0.14, y: 0.44, maxW: 0.6, size: 0.2 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
    features: { x: 0.17, y0: 0.715, lineH: 0.068, maxW: 0.55, size: 0.023 },
    disclaimer: { y: 0.96, maxW: 0.98, size: 0.025, paragraphGap: 0.00 },
  },
  monthly: {
    amountMode: "digitsOnly",
    heading: { x: 0.09, y: 0.31, maxW: 0.58, size: 0.031 },
    amount: { x: 0.14, y: 0.44, maxW: 0.6, size: 0.2 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
    features: { x: 0.17, y0: 0.715, lineH: 0.068, maxW: 0.55, size: 0.023 },
    disclaimer: { y: 0.96, maxW: 0.98, size: 0.025, paragraphGap: 0.00 },
  },
  threeMonths: {
    amountMode: "digitsOnly",
    heading: { x: 0.09, y: 0.31, maxW: 0.58, size: 0.031 },
    amount: { x: 0.14, y: 0.44, maxW: 0.6, size: 0.2 },
    suffix: { gap: 0.008, size: 0.04 },
    date: { x: 0.155, y: 0.519, maxW: 0.55, size: 0.027 },
    username: { x: 0.17, y: 0.638, maxW: 0.36, size: 0.035 },
    features: { x: 0.17, y0: 0.715, lineH: 0.068, maxW: 0.55, size: 0.023 },
    disclaimer: { y: 0.96, maxW: 0.98, size: 0.025, paragraphGap: 0.00 },
  },
};

/** [x, y, w, h] fractions — optional black rects to cover baked template text. */
export const POSTER_WIPE_REGIONS: Record<
  PosterPeriod,
  Array<[number, number, number, number]>
> = {
  daily: [],
  weekly: [],
  monthly: [],
  threeMonths: [],
};

export interface PosterLabels {
  heading: string;
  todayTag?: string;
  userLabel: string;
  feature1: string;
  feature2: string;
  feature3: string;
  disclaimerLine1: string;
  disclaimerLine2: string;
  localeTag: string;
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

function posterCase(text: string, localeTag: string): string {
  try {
    return text.toLocaleUpperCase(localeTag);
  } catch {
    return text.toUpperCase();
  }
}

function wipeStaticRegions(
  ctx: CanvasRenderingContext2D,
  period: PosterPeriod,
  width: number,
  height: number,
) {
  ctx.fillStyle = BLACK;
  for (const [x, y, w, h] of POSTER_WIPE_REGIONS[period]) {
    ctx.fillRect(x * width, y * height, w * width, h * height);
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawStaticLabels(
  ctx: CanvasRenderingContext2D,
  period: PosterPeriod,
  labels: PosterLabels,
  width: number,
  height: number,
) {
  const layout = POSTER_TEXT_LAYOUT[period];

  const heading = posterCase(labels.heading, labels.localeTag);
  const headingSize = fitFontSize(
    ctx,
    heading,
    "700",
    layout.heading.maxW * width,
    layout.heading.size * height,
    11,
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${headingSize}px ${FONT}`;
  ctx.fillText(
    heading,
    layout.heading.x * width,
    layout.heading.y * height,
  );

  if (labels.todayTag && layout.todayTag) {
    const today = posterCase(labels.todayTag, labels.localeTag);
    const todaySize = fitFontSize(
      ctx,
      today,
      "600",
      layout.todayTag.maxW * width,
      layout.todayTag.size * height,
      9,
    );
    ctx.fillStyle = WHITE;
    ctx.font = `600 ${todaySize}px ${FONT}`;
    ctx.fillText(
      today,
      layout.todayTag.x * width,
      layout.todayTag.y * height,
    );
  }

  const features = [labels.feature1, labels.feature2, labels.feature3].map((f) =>
    posterCase(f, labels.localeTag),
  );
  const featureSize = fitFontSize(
    ctx,
    features.reduce((a, b) => (a.length >= b.length ? a : b), ""),
    "400",
    layout.features.maxW * width,
    layout.features.size * height,
    8,
  );
  ctx.font = `400 ${featureSize}px ${FONT}`;
  ctx.fillStyle = WHITE;
  features.forEach((line, i) => {
    ctx.fillText(
      line,
      layout.features.x * width,
      (layout.features.y0 + i * layout.features.lineH) * height,
    );
  });

  const disclaimerSize = layout.disclaimer.size * height;
  ctx.font = `600 ${disclaimerSize}px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  const maxW = layout.disclaimer.maxW * width;
  const lineHeight = disclaimerSize * 1.35;
  const paragraphGap =
    (layout.disclaimer.paragraphGap ?? 0.05) * height;

  const para1 = wrapLines(ctx, labels.disclaimerLine1, maxW);
  const para2 = wrapLines(ctx, labels.disclaimerLine2, maxW);
  const totalHeight =
    para1.length * lineHeight + paragraphGap + para2.length * lineHeight;
  let y =
    layout.disclaimer.y * height - totalHeight / 2 + disclaimerSize * 0.85;

  for (const line of para1) {
    ctx.fillText(line, width / 2, y);
    y += lineHeight;
  }
  y += paragraphGap;
  for (const line of para2) {
    ctx.fillText(line, width / 2, y);
    y += lineHeight;
  }
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
  labels: PosterLabels,
  width: number,
  height: number,
) {
  const layout = POSTER_TEXT_LAYOUT[meta.period];
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

  const dateText = posterCase(meta.rangeLabel, labels.localeTag);
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

  const userLabel = posterCase(labels.userLabel, labels.localeTag);
  const userX = layout.username.x * width;
  const nameY = layout.username.y * height;
  const maxUserW = layout.username.maxW * width;
  const baseUserSize = layout.username.size * height;

  const nameSize = fitFontSize(
    ctx,
    username,
    "700",
    maxUserW,
    baseUserSize,
    11,
  );
  const labelSize = Math.max(
    10,
    Math.min(nameSize * 0.72, baseUserSize * 0.72),
  );
  const lineGap = nameSize * 0.25;
  const labelY = nameY - nameSize - lineGap;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `500 ${labelSize}px ${FONT}`;
  ctx.fillText(userLabel, userX, labelY);

  ctx.fillStyle = WHITE;
  ctx.font = `700 ${nameSize}px ${FONT}`;
  ctx.fillText(username, userX, nameY);
}

export async function renderEarningsPoster(
  meta: PosterPeriodMeta,
  username: string,
  labels: PosterLabels,
): Promise<string> {
  const templateSrc = POSTER_TEMPLATES[meta.period];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const template = await loadImage(templateSrc);
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  wipeStaticRegions(ctx, meta.period, canvas.width, canvas.height);
  drawStaticLabels(ctx, meta.period, labels, canvas.width, canvas.height);
  drawDynamicText(ctx, meta, username, labels, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

export { downloadDataUrl } from "@/lib/download";
