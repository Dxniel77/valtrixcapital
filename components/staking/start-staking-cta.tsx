"use client";

import * as React from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { StakeDepositModal } from "./stake-deposit-modal";
import { useI18n } from "@/lib/i18n/context";

interface StartStakingCTAProps {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
  /** When true, shows a Plus icon instead of the Sparkles (e.g. "Add stake"). */
  add?: boolean;
}

export function StartStakingCTA({
  variant = "primary",
  size = "md",
  className,
  label,
  add = false,
}: StartStakingCTAProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const Icon = add ? Plus : Sparkles;
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Icon className="h-4 w-4" />
        {label ?? t("staking.startStaking")}
      </Button>
      <StakeDepositModal open={open} onOpenChange={setOpen} />
    </>
  );
}
