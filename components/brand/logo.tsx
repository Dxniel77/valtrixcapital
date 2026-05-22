import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
  className?: string;
  showWordmark?: boolean;
}

const dims = {
  sm: { w: 36, h: 36, text: "text-base" },
  md: { w: 44, h: 44, text: "text-lg" },
  lg: { w: 64, h: 64, text: "text-2xl" },
} as const;

export function Logo({
  size = "md",
  asLink = true,
  className,
  showWordmark = false,
}: LogoProps) {
  const d = dims[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative overflow-hidden rounded-md ring-1 ring-gold/20 bg-bg-elevated"
        style={{ width: d.w, height: d.h }}
      >
        <Image
          src="/brand/valtrix-logo.png"
          alt="Valtrix Capital"
          width={d.w * 2}
          height={d.h * 2}
          priority
          className="h-full w-full object-cover"
        />
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-gradient-silver",
            d.text,
          )}
        >
          VALTRIX
          <span className="text-gradient-gold ml-1">CAPITAL</span>
        </span>
      ) : null}
    </span>
  );

  if (asLink) {
    return (
      <Link href="/" aria-label="Inicio de Valtrix Capital">
        {content}
      </Link>
    );
  }
  return content;
}
