import * as React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  week: number;
  title: string;
  description: string;
  features?: string[];
}

export function ComingSoon({ week, title, description, features }: ComingSoonProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-8 shadow-card md:p-12">
      <div className="absolute inset-0 -z-10 bg-hero-radial opacity-40" />
      <div className="absolute inset-0 -z-10 grid-bg opacity-30" />
      <div className="max-w-2xl">
        <Badge variant="gold" className="mb-4">
          <Sparkles className="h-3 w-3" />
          Week {week} delivery
        </Badge>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary md:text-base">
          {description}
        </p>
        {features?.length ? (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-base/60 p-3 text-sm text-text-secondary"
              >
                <span className="mt-0.5 text-gold">→</span>
                {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
