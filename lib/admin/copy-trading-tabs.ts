export const COPY_TRADING_TABS = [
  {
    href: "/admin/copy-trading",
    key: "tabTraders",
    labelKey: "admin.copyTrading.tabTraders",
  },
  {
    href: "/admin/copy-trading/income",
    key: "tabEarnings",
    labelKey: "admin.copyTrading.tabEarnings",
  },
  {
    href: "/admin/copy-trading/live",
    key: "tabLive",
    labelKey: "admin.copyTrading.tabLive",
  },
  {
    href: "/admin/copy-trading/copiers",
    key: "tabCopiers",
    labelKey: "admin.copyTrading.tabCopiers",
  },
] as const;

const COPY_TRADING_SUBPATHS = [
  "/admin/copy-trading/income",
  "/admin/copy-trading/live",
  "/admin/copy-trading/copiers",
] as const;

export function isCopyTradingSection(pathname: string): boolean {
  return (
    pathname === "/admin/copy-trading" ||
    pathname.startsWith("/admin/copy-trading/")
  );
}

export function copyTradingTabActive(href: string, pathname: string): boolean {
  if (href === "/admin/copy-trading") {
    if (pathname === "/admin/copy-trading") return true;
    if (!pathname.startsWith("/admin/copy-trading/")) return false;
    return !COPY_TRADING_SUBPATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
