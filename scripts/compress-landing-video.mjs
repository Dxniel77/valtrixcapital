#!/usr/bin/env node
/**
 * Re-encode the hero video for faster loading on Hostinger / mobile networks.
 * Target: ~720p, H.264, ~2.5 Mbps → typically 3–6 MB instead of 25+ MB.
 *
 * Requires ffmpeg: https://ffmpeg.org/download.html
 *
 * Usage: node scripts/compress-landing-video.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(root, "public/videos/landing-video.mp4");
const output = join(root, "public/videos/landing-video.optimized.mp4");
const backup = join(root, "public/videos/landing-video.original.mp4");

if (!existsSync(input)) {
  console.error("Missing public/videos/landing-video.mp4");
  process.exit(1);
}

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    input,
    "-vf",
    "scale=min(1280\\,iw):-2",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "28",
    "-movflags",
    "+faststart",
    "-an",
    output,
  ],
  { stdio: "inherit", windowsHide: true },
);

if (ffmpeg.error?.code === "ENOENT" || ffmpeg.status === 127) {
  console.error(
    "\nffmpeg not found. Install it, then re-run:\n  node scripts/compress-landing-video.mjs\n",
  );
  process.exit(1);
}

if (ffmpeg.status !== 0) {
  process.exit(ffmpeg.status ?? 1);
}

if (!existsSync(backup)) {
  renameSync(input, backup);
}
renameSync(output, input);
console.log("\nDone. Original saved as landing-video.original.mp4 (if first run).");
console.log("Redeploy so Hostinger serves the smaller file.");
