import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const cols = [
  {
    title: "Platform",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/trade", label: "Trade" },
      { href: "/dashboard/portfolio", label: "Portfolio" },
      { href: "/dashboard/referrals", label: "Referrals" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#yield", label: "Yield model" },
      { href: "/docs", label: "Documentation" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/risk", label: "Risk Disclosure" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-32 border-t border-border-subtle bg-bg-elevated/30">
      <div className="container grid gap-10 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo size="md" showWordmark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
            A premium Web3 yield and trading ecosystem on BNB Chain & Polygon.
            Stake. Trade. Build a network. All on-chain, all transparent.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {c.title}
            </h4>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-secondary transition-colors hover:text-gold"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-text-muted md:flex-row">
          <span>© {new Date().getFullYear()} Valtrix Capital. All rights reserved.</span>
          <span className="font-mono">
            BNB Chain · Polygon · BEP20 · Web3
          </span>
        </div>
      </div>
    </footer>
  );
}
