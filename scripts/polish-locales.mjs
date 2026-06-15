/**
 * Post-process machine-translated locale files — fix known bad strings.
 * Run after: node scripts/generate-locales.mjs de ar zh fr hi it ja pt
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../lib/i18n/locales");

/** path → value overrides per locale */
const POLISH = {
  de: {
    "theme.light": "Heller Modus",
    "notFound.dashboard": "Dashboard",
    "nav.dashboard": "Dashboard",
    "signIn.dashboard": "Dashboard",
    "dashboard.nav.dashboard": "Dashboard",
  },
  ar: {
    "notFound.dashboard": "لوحة التحكم",
    "nav.dashboard": "لوحة التحكم",
    "signIn.dashboard": "لوحة التحكم",
    "dashboard.nav.dashboard": "لوحة التحكم",
  },
  zh: {
    "theme.light": "浅色模式",
    "theme.switchToLight": "启用浅色模式",
    "notFound.dashboard": "仪表板",
    "nav.dashboard": "仪表板",
    "signIn.dashboard": "仪表板",
    "dashboard.nav.dashboard": "仪表板",
  },
  fr: {
    "theme.light": "Mode clair",
    "common.user": "Utilisateur",
    "notFound.dashboard": "Tableau de bord",
    "nav.dashboard": "Tableau de bord",
    "signIn.dashboard": "Tableau de bord",
    "dashboard.nav.dashboard": "Tableau de bord",
  },
  hi: {
    "theme.light": "लाइट मोड",
    "common.chain": "चेन",
    "notFound.dashboard": "डैशबोर्ड",
    "nav.dashboard": "डैशबोर्ड",
    "signIn.dashboard": "डैशबोर्ड",
    "dashboard.nav.dashboard": "डैशबोर्ड",
  },
  it: {
    "theme.light": "Modalità chiara",
    "notFound.dashboard": "Dashboard",
    "nav.dashboard": "Dashboard",
    "signIn.dashboard": "Dashboard",
    "dashboard.nav.dashboard": "Dashboard",
  },
  ja: {
    "theme.light": "ライトモード",
    "common.chain": "チェーン",
    "notFound.dashboard": "ダッシュボード",
    "nav.dashboard": "ダッシュボード",
    "signIn.dashboard": "ダッシュボード",
    "dashboard.nav.dashboard": "ダッシュボード",
  },
  pt: {
    "common.user": "Usuário",
    "theme.switchToLight": "Ativar modo claro",
    "notFound.dashboard": "Painel",
  },
};

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

async function main() {
  for (const [locale, overrides] of Object.entries(POLISH)) {
    const filePath = path.join(localesDir, `${locale}.json`);
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    for (const [p, value] of Object.entries(overrides)) {
      setByPath(data, p, value);
    }
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`Polished ${locale}.json (${Object.keys(overrides).length} fixes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
