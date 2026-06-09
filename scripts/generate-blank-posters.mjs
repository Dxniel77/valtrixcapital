/**
 * Strips baked sample text from filled poster templates so the canvas
 * only needs to overlay dynamic values (no clear rectangles at runtime).
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "public", "images");

/** [x, y, w, h] as fractions of image size — left-column text only. */
const STRIP_REGIONS = {
  weekly: [
    [0.07, 0.33, 0.55, 0.105],
    [0.2, 0.488, 0.53, 0.052],
    [0.19, 0.628, 0.36, 0.038],
  ],
  monthly: [
    [0.07, 0.325, 0.55, 0.105],
    [0.2, 0.484, 0.53, 0.052],
    [0.19, 0.624, 0.36, 0.038],
  ],
  threeMonths: [
    [0.07, 0.33, 0.55, 0.105],
    [0.2, 0.488, 0.53, 0.052],
    [0.19, 0.628, 0.36, 0.038],
  ],
};

const FILE_NAMES = {
  weekly: "poster-weekly.png",
  monthly: "poster-monthly.png",
  threeMonths: "poster-3months.png",
};

async function stripPoster(period) {
  const filled = path.join(root, FILE_NAMES[period]);
  const backup = filled.replace(".png", ".filled.bak.png");
  const input = fs.existsSync(backup) ? backup : filled;
  const meta = await sharp(input).metadata();
  const { width, height } = meta;

  const rects = STRIP_REGIONS[period].map(([x, y, w, h]) => ({
    input: {
      create: {
        width: Math.round(w * width),
        height: Math.round(h * height),
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    },
    left: Math.round(x * width),
    top: Math.round(y * height),
  }));

  const out = filled.replace(".png", "-blank.png");
  const buf = await sharp(input).composite(rects).jpeg({ quality: 96 }).toBuffer();
  fs.writeFileSync(out, buf);
  console.log(`Stripped ${period} → ${out} (backup ${backup})`);
}

for (const period of ["weekly", "monthly", "threeMonths"]) {
  await stripPoster(period);
}
