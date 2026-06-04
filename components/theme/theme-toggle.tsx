"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  size = "icon-sm",
}: {
  className?: string;
  size?: "icon-sm" | "icon";
}) {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        "shrink-0 text-text-secondary hover:text-text-primary",
        className,
      )}
      onClick={toggle}
      disabled={!mounted}
      aria-label={
        mounted
          ? isDark
            ? t("theme.switchToLight")
            : t("theme.switchToDark")
          : t("theme.toggle")
      }
      title={
        mounted
          ? isDark
            ? t("theme.light")
            : t("theme.dark")
          : undefined
      }
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
