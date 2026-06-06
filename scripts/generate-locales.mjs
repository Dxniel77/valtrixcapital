/**
 * Generates locale JSON files using Google Translate (per-string, concurrent).
 * 1) es → en
 * 2) en → de, ar, zh, fr, hi, it, ja, pt
 *
 * Run: node scripts/generate-locales.mjs [locale...]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translate as googleTranslate } from "google-translate-api-x";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localesDir = path.join(root, "lib/i18n/locales");
const esPath = path.join(localesDir, "es.json");
const enPath = path.join(localesDir, "en.json");

const CONCURRENCY = 5;

const TARGETS = {
  en: { from: "es", to: "en", sourcePath: esPath },
  de: { from: "en", to: "de", sourcePath: enPath },
  ar: { from: "en", to: "ar", sourcePath: enPath },
  zh: { from: "en", to: "zh-CN", sourcePath: enPath },
  fr: { from: "en", to: "fr", sourcePath: enPath },
  hi: { from: "en", to: "hi", sourcePath: enPath },
  it: { from: "en", to: "it", sourcePath: enPath },
  ja: { from: "en", to: "ja", sourcePath: enPath },
  pt: { from: "en", to: "pt", sourcePath: enPath },
};

const cache = new Map();

function protectPlaceholders(text) {
  const map = new Map();
  let i = 0;
  const protectedText = text.replace(/\{(\w+)\}/g, (_, name) => {
    const token = `__PH${i++}__`;
    map.set(token, `{${name}}`);
    return token;
  });
  return { protectedText, map };
}

function restorePlaceholders(text, map) {
  let out = text;
  for (const [token, value] of map) {
    out = out.replaceAll(token, value);
  }
  return out;
}

function shouldSkip(text) {
  if (!text.trim()) return true;
  if (/^[\d\s$.,:+\-/%↑↓→·]+$/.test(text)) return true;
  if (
    /^(USDT|BNB|BTC|ETH|SOL|XRP|MATIC|BSC|CSV|2FA|ROI|TVL|Web3|MetaMask|WalletConnect|BscScan|PolygonScan|QR|API|P\/L|LINEAR|Binance|Bybit|Rainbow|Trust|UTC|OPEN|WON|LOSS|BUY|SELL)$/i.test(
      text.trim(),
    )
  ) {
    return true;
  }
  return false;
}

async function translateText(text, from, to) {
  if (shouldSkip(text)) return text;

  const { protectedText, map } = protectPlaceholders(text);
  const key = `${from}|${to}|${protectedText}`;
  if (cache.has(key)) return cache.get(key);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await googleTranslate(protectedText, { from, to, forceBatch: false });
      const raw = (typeof result === "string" ? result : result.text)?.trim();
      if (raw) {
        const restored = restorePlaceholders(raw, map);
        cache.set(key, restored);
        return restored;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  cache.set(key, text);
  return text;
}

async function mapPool(items, fn, concurrency) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function collectStrings(obj, prefix = "", out = []) {
  if (typeof obj === "string") {
    out.push({ path: prefix, value: obj });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectStrings(v, `${prefix}[${i}]`, out));
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const next = prefix ? `${prefix}.${k}` : k;
      collectStrings(v, next, out);
    }
  }
  return out;
}

function setByPath(obj, pathStr, value) {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

async function translateLocale(locale) {
  const config = TARGETS[locale];
  const source = JSON.parse(await fs.readFile(config.sourcePath, "utf8"));
  const entries = collectStrings(source);
  console.log(`\n${locale}: ${entries.length} strings (${config.from} → ${config.to})`);

  const translated = structuredClone(source);
  let done = 0;

  await mapPool(
    entries,
    async ({ path: p, value }) => {
      const next = await translateText(value, config.from, config.to);
      setByPath(translated, p, next);
      done++;
      if (done % 50 === 0) process.stdout.write(".");
      return next;
    },
    CONCURRENCY,
  );

  const outPath = path.join(localesDir, `${locale}.json`);
  await fs.writeFile(outPath, JSON.stringify(translated, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);

  if (locale === "en") {
    const check = translated.common?.connectWallet ?? "";
    if (/billetera|Conectar/i.test(check)) {
      console.error("WARNING: en.json still contains Spanish — translation may have failed.");
      process.exitCode = 1;
    }
  }
}

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length
    ? requested.filter((l) => TARGETS[l])
    : Object.keys(TARGETS);

  if (targets.includes("en")) {
    await translateLocale("en");
    if (process.exitCode === 1) process.exit(1);
  }

  for (const locale of targets.filter((l) => l !== "en")) {
    try {
      await fs.access(TARGETS[locale].sourcePath);
    } catch {
      console.error(`Missing source for ${locale}. Generate en first.`);
      process.exit(1);
    }
    await translateLocale(locale);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
