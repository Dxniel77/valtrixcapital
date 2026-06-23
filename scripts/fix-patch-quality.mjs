/**
 * Applies quality overrides to lib/i18n/patch-translations.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patchPath = path.join(__dirname, "../lib/i18n/patch-translations.json");

const FIXES = {
  de: {
    "admin.audit.colDetail": "Einzelheit",
    "admin.cashflow.inflow": "Zuflüsse",
    "admin.grant.uplineLabel": "Empfehlungsgeber (optional)",
    "admin.movements.colType": "Typ",
    "admin.nav.treasury": "Kasse",
    "admin.notifications.kindLabel": "Typ",
    "admin.notifications.linkLabel": "Verknüpfung (optional)",
    "admin.notifications.titleLabel": "Titel",
    "botPage.live": "Echtzeit",
    "botPage.pause": "Pausieren",
    "dashboard.nav.portfolio": "Depot",
    "dashboard.overview.payoutCapLabel": "Obergrenze",
    "dashboard.overview.quickPortfolio": "Depot",
    "dashboard.pages.portfolio.title": "Depot",
    "dashboard.pages.profile.disconnected": "Getrennt",
    "hero.mockNav.portfolio": "Depot",
    "historyPage.colDetail": "Einzelheit",
    "liquidationPage.live": "Echtzeit",
    "notifications.kind.system": "Systemmeldung",
    "referralsPage.colType": "Typ",
    "signIn.signIn": "Anmelden",
    "staking.deposit.maxBtn": "HÖCHST",
    "staking.portfolio.title": "Depot",
    "staking.portfolio.yieldRate": "Satz",
    "supportPage.nameLabel": "Bezeichnung",
    "trade.live": "Echtzeit · {source}",
    "trade.offline": "Getrennt",
    "trade.strategies.trend": "Trendrichtung",
  },
  fr: {
    "admin.audit.colAction": "Opération",
    "admin.audit.colTime": "Horodatage",
    "admin.grant.previewRule": "Critère",
    "admin.lookup.volume": "Vol. échangé",
    "admin.movements.colDate": "Horodatage",
    "admin.movements.summaryCount": "Opérations",
    "admin.nav.audit": "Journal d'audit",
    "admin.nav.notifications": "Alertes",
    "admin.notifications.bodyLabel": "Contenu",
    "admin.reports.audit": "Journal d'audit",
    "admin.settings.yieldTitle": "Rendement",
    "admin.users.colDirectRefs": "Filleuls",
    "admin.users.noteLabel": "Remarque",
    "admin.users.registrationFilterDirect": "Filleuls",
    "botPage.colVolume": "Vol. échangé",
    "botPage.pause": "Mettre en pause",
    "dashboard.header.notifications": "Alertes",
    "dashboard.pages.history.colDate": "Horodatage",
    "dashboard.pages.support.email": "Courriel",
    "footer.docs": "Manuels",
    "historyPage.colDate": "Horodatage",
    "historyPage.feeLabel": "frais",
    "historyPage.filterCommissions": "Frais",
    "historyPage.filterYield": "Rendement",
    "notifications.kind.promo": "Offre promo",
    "notifications.title": "Alertes",
    "referralsPage.colCommissions": "Frais",
    "staking.deposit.range": "Min. ${min} · Max. ${max}",
    "staking.portfolio.yieldDate": "Horodatage",
    "supportPage.messageLabel": "Contenu",
    "trade.drawing.rect": "Forme rectangulaire",
    "trade.indicators.volume": "Vol. échangé",
    "walletPage.category.COMMISSION": "Frais",
    "walletPage.category.YIELD": "Rendement",
    "walletPage.withdraw.minError": "Min. ${min} USDT",
  },
  it: {
    "admin.lookup.volume": "Volume scambiato",
    "botPage.colVolume": "Volume scambiato",
    "dashboard.nav.portfolio": "Portafoglio",
    "dashboard.overview.quickPortfolio": "Portafoglio",
    "dashboard.pages.portfolio.title": "Portafoglio",
    "dashboard.pages.profile.account": "Profilo",
    "dashboard.pages.profile.accountCard": "Profilo",
    "hero.mockNav.portfolio": "Portafoglio",
    "signIn.signIn": "Accedi",
    "staking.deposit.range": "Min. ${min} · Max. ${max}",
    "staking.portfolio.title": "Portafoglio",
    "supportPage.categories.account": "Profilo",
    "trade.indicators.volume": "Volume scambiato",
  },
  pt: {
    "admin.lookup.volume": "Volume negociado",
    "botPage.colVolume": "Volume negociado",
    "trade.indicators.volume": "Volume negociado",
  },
};

async function main() {
  const patch = JSON.parse(await fs.readFile(patchPath, "utf8"));
  let count = 0;
  for (const [locale, fixes] of Object.entries(FIXES)) {
    for (const [key, value] of Object.entries(fixes)) {
      patch[locale][key] = value;
      count++;
    }
  }
  await fs.writeFile(patchPath, JSON.stringify(patch, null, 2) + "\n", "utf8");
  console.log(`Applied ${count} quality fixes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
