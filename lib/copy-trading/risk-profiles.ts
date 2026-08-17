export type CopyRiskProfileLevel = "LOW" | "MEDIUM" | "HIGH";

export type CopyRiskProfile = {
  leverageMin: number;
  leverageMax: number;
  durationMinMinutes: number;
  durationMaxMinutes: number;
};

/** Daniel HTML profiles: conservador / moderado / agresivo. */
export const COPY_RISK_PROFILES: Record<CopyRiskProfileLevel, CopyRiskProfile> = {
  LOW: {
    leverageMin: 1,
    leverageMax: 4,
    durationMinMinutes: 6,
    durationMaxMinutes: 10,
  },
  MEDIUM: {
    leverageMin: 3,
    leverageMax: 8,
    durationMinMinutes: 4,
    durationMaxMinutes: 8,
  },
  HIGH: {
    leverageMin: 6,
    leverageMax: 15,
    durationMinMinutes: 3,
    durationMaxMinutes: 6,
  },
};

export function riskProfileOf(level: CopyRiskProfileLevel): CopyRiskProfile {
  return COPY_RISK_PROFILES[level] ?? COPY_RISK_PROFILES.MEDIUM;
}
