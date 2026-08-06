import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "lib", "i18n", "locales");

const KEYS = {
  en: {
    selectPage: "Select page",
    deleteSelected: "Delete ({n})",
    confirmDelete: "Hide {n} selected trader(s) from the marketplace?",
    deleted: "Removed {n} trader(s).",
    deletedWithSkipped:
      "Removed {deleted} trader(s). Skipped {skipped} with active copies.",
  },
  es: {
    selectPage: "Seleccionar página",
    deleteSelected: "Eliminar ({n})",
    confirmDelete: "¿Ocultar {n} trader(s) seleccionados del marketplace?",
    deleted: "Se eliminaron {n} trader(s).",
    deletedWithSkipped:
      "Se eliminaron {deleted} trader(s). Se omitieron {skipped} con copias activas.",
  },
  ar: {
    selectPage: "تحديد الصفحة",
    deleteSelected: "حذف ({n})",
    confirmDelete: "إخفاء {n} من المتداولين المحددين من السوق؟",
    deleted: "تمت إزالة {n} من المتداولين.",
    deletedWithSkipped:
      "تمت إزالة {deleted}. تم تخطي {skipped} لديهم نسخ نشطة.",
  },
  hi: {
    selectPage: "पेज चुनें",
    deleteSelected: "हटाएँ ({n})",
    confirmDelete: "चयनित {n} ट्रेडर को मार्केटप्लेस से छिपाएँ?",
    deleted: "{n} ट्रेडर हटाए गए।",
    deletedWithSkipped:
      "{deleted} हटाए गए। सक्रिय कॉपी वाले {skipped} छोड़ दिए गए।",
  },
  zh: {
    selectPage: "选择本页",
    deleteSelected: "删除（{n}）",
    confirmDelete: "从市场隐藏所选的 {n} 位交易员？",
    deleted: "已移除 {n} 位交易员。",
    deletedWithSkipped: "已移除 {deleted} 位。跳过 {skipped} 位仍有活跃跟单。",
  },
  ja: {
    selectPage: "このページを選択",
    deleteSelected: "削除（{n}）",
    confirmDelete: "選択した {n} 人のトレーダーをマーケットから非表示にしますか？",
    deleted: "{n} 人のトレーダーを削除しました。",
    deletedWithSkipped:
      "{deleted} 人を削除。アクティブなコピーがある {skipped} 人はスキップ。",
  },
  it: {
    selectPage: "Seleziona pagina",
    deleteSelected: "Elimina ({n})",
    confirmDelete: "Nascondere {n} trader selezionati dal marketplace?",
    deleted: "Rimossi {n} trader.",
    deletedWithSkipped:
      "Rimossi {deleted} trader. Saltati {skipped} con copie attive.",
  },
  pt: {
    selectPage: "Selecionar página",
    deleteSelected: "Excluir ({n})",
    confirmDelete: "Ocultar {n} trader(s) selecionado(s) do marketplace?",
    deleted: "Removido(s) {n} trader(s).",
    deletedWithSkipped:
      "Removidos {deleted}. Ignorados {skipped} com cópias ativas.",
  },
  fr: {
    selectPage: "Sélectionner la page",
    deleteSelected: "Supprimer ({n})",
    confirmDelete: "Masquer {n} trader(s) sélectionné(s) du marketplace ?",
    deleted: "{n} trader(s) supprimé(s).",
    deletedWithSkipped:
      "{deleted} supprimé(s). {skipped} ignoré(s) avec copies actives.",
  },
  de: {
    selectPage: "Seite auswählen",
    deleteSelected: "Löschen ({n})",
    confirmDelete: "{n} ausgewählte Trader aus dem Marketplace ausblenden?",
    deleted: "{n} Trader entfernt.",
    deletedWithSkipped:
      "{deleted} entfernt. {skipped} mit aktiven Copies übersprungen.",
  },
};

function findCopyTrading(node) {
  if (!node || typeof node !== "object") return null;
  if (
    node.copyTrading &&
    typeof node.copyTrading === "object" &&
    "simulationNotice" in node.copyTrading
  ) {
    return node.copyTrading;
  }
  for (const value of Object.values(node)) {
    const found = findCopyTrading(value);
    if (found) return found;
  }
  return null;
}

for (const [lang, keys] of Object.entries(KEYS)) {
  const file = join(localesDir, `${lang}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  const block = findCopyTrading(json);
  if (!block) {
    console.warn(`  ${lang}: skipped`);
    continue;
  }
  let added = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (!(k in block)) {
      block[k] = v;
      added++;
    } else {
      block[k] = v;
    }
  }
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`  ${lang}: ${added} new / updated`);
}
