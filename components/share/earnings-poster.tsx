"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import type { EarningsBreakdown } from "@/lib/admin/analytics";
import { formatNumber } from "@/lib/utils";

interface EarningsPosterProps {
  username: string;
  earnings: EarningsBreakdown;
}

export function EarningsPoster({ username, earnings }: EarningsPosterProps) {
  const { t } = useI18n();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const w = 1080;
    const h = 1080;
    canvas.width = w;
    canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0A0A0F");
    grad.addColorStop(1, "#1A1510");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(212,175,55,0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, w - 96, h - 96);

    ctx.fillStyle = "#D4AF37";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.fillText("VALTRIX CAPITAL", 80, 130);

    ctx.fillStyle = "#F5F5F7";
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText(`@${username}`, 80, 200);

    ctx.fillStyle = "#9CA0AB";
    ctx.font="28px system-ui, sans-serif";
    ctx.fillText(
      earnings.hasNetwork
        ? t("share.poster.networkUser")
        : t("share.poster.soloUser"),
      80,
      250,
    );

    ctx.fillStyle = "#D4AF37";
    ctx.font = "bold 120px system-ui, sans-serif";
    ctx.fillText(
      `$${formatNumber(earnings.displayTotal, { decimals: 0 })}`,
      80,
      420,
    );

    ctx.fillStyle = "#F5F5F7";
    ctx.font="32px system-ui, sans-serif";
    const rows = [
      [t("share.poster.daily"), earnings.daily],
      [t("share.poster.weekly"), earnings.weekly],
      [t("share.poster.monthly"), earnings.monthly],
      [t("share.poster.threeMonths"), earnings.threeMonths],
    ] as const;

    let y = 520;
    for (const [label, amount] of rows) {
      ctx.fillStyle = "#9CA0AB";
      ctx.fillText(label, 80, y);
      ctx.fillStyle = "#F5F5F7";
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.fillText(`$${formatNumber(amount, { decimals: 2 })}`, 80, y + 44);
      ctx.font = "32px system-ui, sans-serif";
      y += 110;
    }

    ctx.fillStyle = "#6B7280";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(t("share.poster.footer"), 80, h - 80);

    return canvas.toDataURL("image/png");
  }

  function download() {
    const dataUrl = draw();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `valtrix-earnings-${username}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        className="hidden"
        width={1080}
        height={1080}
        aria-hidden
      />
      <div className="rounded-xl border border-gold/30 bg-gradient-to-br from-bg-elevated to-bg-base p-8">
        <p className="text-xs uppercase tracking-wider text-gold">Valtrix Capital</p>
        <p className="mt-2 font-display text-2xl font-semibold">@{username}</p>
        <p className="mt-1 text-sm text-text-muted">
          {earnings.hasNetwork
            ? t("share.poster.networkUser")
            : t("share.poster.soloUser")}
        </p>
        <p className="mt-6 font-mono text-5xl text-gold">
          ${formatNumber(earnings.displayTotal, { decimals: 0 })}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <PosterStat label={t("share.poster.daily")} value={earnings.daily} />
          <PosterStat label={t("share.poster.weekly")} value={earnings.weekly} />
          <PosterStat label={t("share.poster.monthly")} value={earnings.monthly} />
          <PosterStat label={t("share.poster.threeMonths")} value={earnings.threeMonths} />
        </div>
      </div>
      <Button variant="primary" size="md" onClick={download}>
        <Download className="h-4 w-4" />
        {t("share.download")}
      </Button>
    </div>
  );
}

function PosterStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-mono text-lg text-text-primary">
        ${formatNumber(value, { decimals: 2 })}
      </p>
    </div>
  );
}
