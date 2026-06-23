/**
 * Applies lib/i18n/patch-translations.json to locale files.
 * Run: node scripts/apply-i18n-patches.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localesDir = path.join(root, "lib/i18n/locales");
const patchPath = path.join(root, "lib/i18n/patch-translations.json");
const patch2Path = path.join(root, "lib/i18n/patch-translations-2.json");
const patch3Path = path.join(root, "lib/i18n/patch-translations-3.json");
const patch4Path = path.join(root, "lib/i18n/patch-translations-4.json");
const enPath = path.join(localesDir, "en.json");

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === undefined || cur[part] === null || typeof cur[part] !== "object") {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(obj, pathStr) {
  const parts = pathStr.split(".").filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

async function main() {
  const patch = JSON.parse(await fs.readFile(patchPath, "utf8"));
  let patch2 = {};
  try {
    patch2 = JSON.parse(await fs.readFile(patch2Path, "utf8"));
  } catch {
    /* optional second patch file */
  }
  let patch3 = {};
  try {
    patch3 = JSON.parse(await fs.readFile(patch3Path, "utf8"));
  } catch {
    /* optional third patch file */
  }
  let patch4 = {};
  try {
    patch4 = JSON.parse(await fs.readFile(patch4Path, "utf8"));
  } catch {
    /* optional fourth patch file */
  }
  const merged = { ...patch };
  for (const [locale, entries] of Object.entries(patch2)) {
    merged[locale] = { ...(merged[locale] ?? {}), ...entries };
  }
  for (const [locale, entries] of Object.entries(patch3)) {
    merged[locale] = { ...(merged[locale] ?? {}), ...entries };
  }
  for (const [locale, entries] of Object.entries(patch4)) {
    merged[locale] = { ...(merged[locale] ?? {}), ...entries };
  }
  const en = JSON.parse(await fs.readFile(enPath, "utf8"));
  const counts = {};

  for (const [locale, entries] of Object.entries(merged)) {
    const localePath = path.join(localesDir, `${locale}.json`);
    let data;
    try {
      data = JSON.parse(await fs.readFile(localePath, "utf8"));
    } catch {
      console.warn(`Skipping missing locale: ${locale}.json`);
      continue;
    }

    let applied = 0;
    for (const [keyPath, value] of Object.entries(entries)) {
      const prev = getByPath(data, keyPath);
      setByPath(data, keyPath, value);
      if (prev !== value) applied++;

      // Ensure key exists in en reference when patch includes it
      if (getByPath(en, keyPath) === undefined) {
        setByPath(en, keyPath, getByPath(en, keyPath) ?? value);
      }
    }

    await fs.writeFile(localePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    counts[locale] = { total: Object.keys(entries).length, changed: applied };
    console.log(`${locale}: patched ${Object.keys(entries).length} keys (${applied} changed)`);
  }

  return counts;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
