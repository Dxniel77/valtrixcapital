/**
 * Generates lib/i18n/patch-translations.json from tmp-key-pairs.json.
 * Uses Spanish as semantic reference; translates to de, ar, zh, fr, hi, it, ja, pt.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translate as googleTranslate } from "google-translate-api-x";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pairsPath = path.join(root, "tmp-key-pairs.json");
const outPath = path.join(root, "lib/i18n/patch-translations.json");

const LOCALES = ["de", "ar", "zh", "fr", "hi", "it", "ja", "pt"];
const GOOGLE_LOCALE = { zh: "zh-CN", pt: "pt" };
const CONCURRENCY = 4;
const cache = new Map();

/** Per-locale manual overrides (key path → value) */
const MANUAL = {
  de: {
    "common.open": "OFFEN",
    "common.win": "GEWONNEN",
    "common.loss": "VERLUST",
    "common.buy": "KAUFEN",
    "common.sell": "VERKAUFEN",
    "common.buyArrow": "KAUFEN ↑",
    "common.sellArrow": "VERKAUFEN ↓",
    "hero.mockTrade.buy": "KAUFEN ↑",
    "hero.mockTrade.sell": "VERKAUFEN ↓",
    "dashboard.header.balance": "Auszahlbar",
    "dashboard.nav.support": "Support",
    "footer.support": "Support",
    "dashboard.pages.support.title": "Support",
    "errors.backendRequired":
      "Dienst vorübergehend nicht verfügbar. Bitte versuche es in einigen Minuten erneut.",
    "admin.grant.previewRule": "Bedingung",
    "admin.grant.selected": "Aktiv",
    "admin.grant.uplineLabel": "Sponsor (optional)",
    "dashboard.overview.days.tue": "Di",
    "historyPage.colType": "Typ",
    "walletPage.deposit.registerDeposit": "Einzahlung registrieren",
  },
  ar: {
    "common.open": "مفتوحة",
    "common.win": "ربح",
    "common.loss": "خسارة",
    "common.buy": "شراء",
    "common.sell": "بيع",
    "common.buyArrow": "شراء ↑",
    "common.sellArrow": "بيع ↓",
    "hero.mockTrade.buy": "شراء ↑",
    "hero.mockTrade.sell": "بيع ↓",
    "dashboard.header.balance": "قابل للسحب",
    "dashboard.nav.support": "الدعم",
    "footer.support": "الدعم",
    "dashboard.pages.support.title": "الدعم",
    "errors.backendRequired": "الخدمة غير متاحة مؤقتًا. يرجى المحاولة مرة أخرى بعد بضع دقائق.",
    "admin.grant.previewRule": "الشرط",
    "admin.grant.selected": "نشط",
    "admin.grant.uplineLabel": "الراعي (اختياري)",
    "dashboard.overview.days.tue": "ثل",
    "historyPage.colType": "النوع",
    "walletPage.deposit.registerDeposit": "تسجيل الإيداع",
  },
  zh: {
    "common.open": "持仓中",
    "common.win": "盈利",
    "common.loss": "亏损",
    "common.buy": "买入",
    "common.sell": "卖出",
    "common.buyArrow": "买入 ↑",
    "common.sellArrow": "卖出 ↓",
    "hero.mockTrade.buy": "买入 ↑",
    "hero.mockTrade.sell": "卖出 ↓",
    "dashboard.header.balance": "可提现",
    "dashboard.nav.support": "支持",
    "footer.support": "支持",
    "dashboard.pages.support.title": "支持",
    "errors.backendRequired": "服务暂时不可用，请几分钟后再试。",
    "admin.grant.previewRule": "条件",
    "admin.grant.selected": "活跃",
    "admin.grant.uplineLabel": "推荐人（可选）",
    "dashboard.overview.days.tue": "周二",
    "historyPage.colType": "类型",
    "walletPage.deposit.registerDeposit": "登记存款",
  },
  fr: {
    "common.open": "OUVERT",
    "common.win": "GAGNÉ",
    "common.loss": "PERTE",
    "common.buy": "ACHAT",
    "common.sell": "VENTE",
    "common.buyArrow": "ACHAT ↑",
    "common.sellArrow": "VENTE ↓",
    "hero.mockTrade.buy": "ACHAT ↑",
    "hero.mockTrade.sell": "VENTE ↓",
    "dashboard.header.balance": "Retirable",
    "dashboard.nav.support": "Support",
    "footer.support": "Support",
    "dashboard.pages.support.title": "Support",
    "errors.backendRequired":
      "Service temporairement indisponible. Veuillez réessayer dans quelques minutes.",
    "admin.grant.previewRule": "Condition",
    "admin.grant.selected": "Actif",
    "admin.grant.uplineLabel": "Parrain (facultatif)",
    "dashboard.overview.days.tue": "Mar",
    "historyPage.colType": "Type",
    "walletPage.deposit.registerDeposit": "Enregistrer le dépôt",
  },
  hi: {
    "common.open": "खुला",
    "common.win": "जीत",
    "common.loss": "हानि",
    "common.buy": "खरीदें",
    "common.sell": "बेचें",
    "common.buyArrow": "खरीदें ↑",
    "common.sellArrow": "बेचें ↓",
    "hero.mockTrade.buy": "खरीदें ↑",
    "hero.mockTrade.sell": "बेचें ↓",
    "dashboard.header.balance": "निकासी योग्य",
    "dashboard.nav.support": "सहायता",
    "footer.support": "सहायता",
    "dashboard.pages.support.title": "सहायता",
    "errors.backendRequired":
      "सेवा अस्थायी रूप से अनुपलब्ध है। कृपया कुछ मिनट बाद पुनः प्रयास करें।",
    "admin.grant.previewRule": "शर्त",
    "admin.grant.selected": "सक्रिय",
    "admin.grant.uplineLabel": "प्रायोजक (वैकल्पिक)",
    "dashboard.overview.days.tue": "मंगल",
    "historyPage.colType": "प्रकार",
    "walletPage.deposit.registerDeposit": "जमा रजिस्टर करें",
  },
  it: {
    "common.open": "APERTO",
    "common.win": "VINTO",
    "common.loss": "PERDITA",
    "common.buy": "ACQUISTA",
    "common.sell": "VENDI",
    "common.buyArrow": "ACQUISTA ↑",
    "common.sellArrow": "VENDI ↓",
    "hero.mockTrade.buy": "ACQUISTA ↑",
    "hero.mockTrade.sell": "VENDI ↓",
    "dashboard.header.balance": "Prelevabile",
    "dashboard.nav.support": "Supporto",
    "footer.support": "Supporto",
    "dashboard.pages.support.title": "Supporto",
    "errors.backendRequired":
      "Servizio temporaneamente non disponibile. Riprova tra qualche minuto.",
    "admin.grant.previewRule": "Condizione",
    "admin.grant.selected": "Attivo",
    "admin.grant.uplineLabel": "Sponsor (facoltativo)",
    "dashboard.overview.days.tue": "Mar",
    "historyPage.colType": "Tipo",
    "walletPage.deposit.registerDeposit": "Registra deposito",
  },
  ja: {
    "common.open": "未決済",
    "common.win": "勝ち",
    "common.loss": "負け",
    "common.buy": "買い",
    "common.sell": "売り",
    "common.buyArrow": "買い ↑",
    "common.sellArrow": "売り ↓",
    "hero.mockTrade.buy": "買い ↑",
    "hero.mockTrade.sell": "売り ↓",
    "dashboard.header.balance": "出金可能",
    "dashboard.nav.support": "サポート",
    "footer.support": "サポート",
    "dashboard.pages.support.title": "サポート",
    "errors.backendRequired": "サービスは一時的に利用できません。数分後にもう一度お試しください。",
    "admin.grant.previewRule": "条件",
    "admin.grant.selected": "アクティブ",
    "admin.grant.uplineLabel": "スポンサー（任意）",
    "dashboard.overview.days.tue": "火",
    "historyPage.colType": "種類",
    "walletPage.deposit.registerDeposit": "入金を登録",
  },
  pt: {
    "common.open": "ABERTA",
    "common.win": "GANHA",
    "common.loss": "PERDA",
    "common.buy": "COMPRAR",
    "common.sell": "VENDER",
    "common.buyArrow": "COMPRAR ↑",
    "common.sellArrow": "VENDER ↓",
    "hero.mockTrade.buy": "COMPRAR ↑",
    "hero.mockTrade.sell": "VENDER ↓",
    "dashboard.header.balance": "Retirável",
    "dashboard.nav.support": "Suporte",
    "footer.support": "Suporte",
    "dashboard.pages.support.title": "Suporte",
    "errors.backendRequired":
      "Serviço temporariamente indisponível. Tente novamente em alguns minutos.",
    "admin.grant.previewRule": "Condição",
    "admin.grant.selected": "Ativo",
    "admin.grant.uplineLabel": "Patrocinador (opcional)",
    "dashboard.overview.days.tue": "Ter",
    "historyPage.colType": "Tipo",
    "walletPage.deposit.registerDeposit": "Registrar depósito",
  },
};

const KEEP_LITERAL = new Set([
  "USDT",
  "BSC",
  "Polygon",
  "BEP-20",
  "Binance",
  "Bybit",
  "Gate.io",
  "MetaMask",
  "UTC",
  "EMA",
  "RSI",
  "Bollinger",
  "Fibonacci",
  "CSV",
  "Web3",
  "TVL",
  "ROI",
  "MAX",
  "PIN",
  "0x",
]);

function protectText(text) {
  const map = new Map();
  let i = 0;
  let out = text;
  out = out.replace(/\$\{(\w+)\}/g, (m) => {
    const token = `__PH${i++}__`;
    map.set(token, m);
    return token;
  });
  out = out.replace(/\{(\w+)\}/g, (m) => {
    const token = `__PH${i++}__`;
    map.set(token, m);
    return token;
  });
  return { protectedText: out, map };
}

function restoreText(text, map) {
  let out = text;
  for (const [token, value] of map) {
    out = out.replaceAll(token, value);
  }
  return out;
}

function shouldSkipTranslate(text) {
  if (!text.trim()) return true;
  if (/^[\d\s$.,:+\-/%↑↓→·…]+$/.test(text)) return true;
  if (KEEP_LITERAL.has(text.trim())) return true;
  return false;
}

async function translateText(text, from, to) {
  if (shouldSkipTranslate(text)) return text;
  const { protectedText, map } = protectText(text);
  const key = `${from}|${to}|${protectedText}`;
  if (cache.has(key)) return cache.get(key);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await googleTranslate(protectedText, { from, to, forceBatch: false });
      const raw = (typeof result === "string" ? result : result.text)?.trim();
      if (raw) {
        const restored = restoreText(raw, map);
        cache.set(key, restored);
        return restored;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
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
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const pairs = JSON.parse(await fs.readFile(pairsPath, "utf8"));
  const keys = Object.keys(pairs);
  console.log(`Translating ${keys.length} keys × ${LOCALES.length} locales…`);

  const patch = { es: {} };
  patch.es["errors.backendRequired"] =
    "Servicio temporalmente no disponible. Inténtalo de nuevo en unos minutos.";
  patch.es["walletPage.deposit.registerDeposit"] = "Registrar depósito";

  for (const locale of LOCALES) {
    patch[locale] = {};
    const to = GOOGLE_LOCALE[locale] ?? locale;
    let done = 0;

    await mapPool(
      keys,
      async (keyPath) => {
        if (MANUAL[locale]?.[keyPath]) {
          patch[locale][keyPath] = MANUAL[locale][keyPath];
          return;
        }
        const entry = pairs[keyPath];
        const source = entry.es ?? entry.en;
        const from = entry.es ? "es" : "en";
        patch[locale][keyPath] = await translateText(source, from, to);
        done++;
        if (done % 25 === 0) process.stdout.write(".");
      },
      CONCURRENCY,
    );

    // Ensure errors.backendRequired is always present
    if (!patch[locale]["errors.backendRequired"] && MANUAL[locale]?.["errors.backendRequired"]) {
      patch[locale]["errors.backendRequired"] = MANUAL[locale]["errors.backendRequired"];
    }

    console.log(`\n${locale}: ${Object.keys(patch[locale]).length} keys`);
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(patch, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
