import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <Logo size="lg" showWordmark />
      <h1 className="mt-8 font-display text-5xl font-bold tracking-tight text-gradient-gold md:text-7xl">
        404
      </h1>
      <p className="mt-3 max-w-md text-base text-text-secondary">
        {t("notFound.message")}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild variant="primary" size="lg">
          <Link href="/">{t("notFound.backHome")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">{t("notFound.dashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
