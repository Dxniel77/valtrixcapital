/**
 * Applies missing web locale keys from scripts/web-i18n-fill/*.json
 * Run: node scripts/fill-missing-web-keys.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../lib/i18n/locales");
const fillDir = path.join(__dirname, "web-i18n-fill");

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split(".").filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] == null || typeof cur[part] !== "object" || Array.isArray(cur[part])) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

const files = fs.readdirSync(fillDir).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const locale = path.basename(file, ".json");
  const entries = JSON.parse(fs.readFileSync(path.join(fillDir, file), "utf8"));
  const localePath = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(localePath, "utf8"));
  for (const [key, value] of Object.entries(entries)) {
    setByPath(data, key, value);
  }
  fs.writeFileSync(localePath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${locale}: applied ${Object.keys(entries).length} keys`);
}
