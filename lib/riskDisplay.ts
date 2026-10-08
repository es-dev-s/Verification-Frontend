import type {
  AnzscoCandidate,
  AssessmentResult,
  PrecedentRiskLevel,
  RiskLevel,
} from "./types";

/** Shared display helpers for the risk (Step 4) and final review (Step 5) screens. */

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}%`;
}

export function riskBadge(level: RiskLevel): {
  label: string;
  className: string;
} {
  switch (level) {
    case "no_risk":
      return {
        label: "No risk",
        className: "bg-success-soft text-success ring-1 ring-success-line",
      };
    case "low":
      return {
        label: "Low risk",
        className: "bg-brand-soft text-brand-deeper ring-1 ring-brand-muted",
      };
    case "medium":
      return {
        label: "Medium risk",
        className: "bg-[#faf4ec] text-[#7a5c32] ring-1 ring-[#ead9b8]",
      };
    case "high":
      return {
        label: "High risk",
        className: "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]",
      };
  }
}

export function precedentRiskBadge(level: PrecedentRiskLevel): {
  label: string;
  className: string;
} {
  switch (level) {
    case "no_risk":
      return {
        label: "No risk",
        className: "bg-success-soft text-success ring-1 ring-success-line",
      };
    case "slight_risk":
      return {
        label: "Slight risk",
        className: "bg-[#faf4ec] text-[#7a5c32] ring-1 ring-[#ead9b8]",
      };
    case "high_risk":
      return {
        label: "High risk",
        className: "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]",
      };
  }
}

/** Mirrors api/src/risk/scoreRisk.ts riskLevelFromScore bands. */
export function riskBandFromScore(pct: number): RiskLevel {
  if (pct >= 85) return "no_risk";
  if (pct >= 75) return "low";
  if (pct >= 50) return "medium";
  return "high";
}

export function riskBandRange(level: RiskLevel): string {
  switch (level) {
    case "no_risk":
      return "85% and above";
    case "low":
      return "75–84.9%";
    case "medium":
      return "50–74.9%";
    case "high":
      return "below 50%";
  }
}

export function normalizeAnzsco(code: string | null | undefined): string {
  return (code ?? "").replace(/\s+/g, "");
}

/** Step 3 figures for one occupation (candidate row or legacy top-level result). */
export type AssessmentSummary = {
  anzscoCode: string | null;
  title: string | null;
  determination: AssessmentResult["determination"] | null;
  confidence: AssessmentResult["confidence"];
  confidenceScore: number | null;
  foundationalMatched: number;
  foundationalExpected: number;
  foundationalPct: number;
  coreMatched: number;
  coreExpected: number;
  corePct: number;
  tier3GateMet: boolean;
  recommended: boolean | null;
  workExperienceBoost: boolean | null;
  workExperienceAnalysis: string | null;
};

/**
 * Resolve the Step 3 summary for the chosen ANZSCO code: the matching candidate
 * first, then the top-level result when its code matches. Returns null otherwise
 * so callers never show figures for a different occupation.
 */
export function resolveAssessmentSummary(
  assessment: AssessmentResult | null | undefined,
  anzscoCode: string | null | undefined,
): AssessmentSummary | null {
  if (!assessment) return null;
  const code = normalizeAnzsco(anzscoCode);
  const candidate: AnzscoCandidate | undefined = code
    ? assessment.candidates?.find((c) => normalizeAnzsco(c.anzscoCode) === code)
    : undefined;
  if (candidate) {
    return {
      anzscoCode: candidate.anzscoCode,
      title: candidate.title,
      determination: candidate.determination ?? null,
      confidence: candidate.confidence ?? null,
      confidenceScore:
        typeof candidate.confidenceScore === "number" &&
        Number.isFinite(candidate.confidenceScore)
          ? candidate.confidenceScore
          : null,
      foundationalMatched: candidate.foundationalMatched,
      foundationalExpected: candidate.foundationalExpected,
      foundationalPct: candidate.foundationalPct,
      coreMatched: candidate.coreMatched,
      coreExpected: candidate.coreExpected,
      corePct: candidate.corePct,
      tier3GateMet: candidate.tier3GateMet,
      recommended:
        typeof candidate.recommended === "boolean" ? candidate.recommended : null,
      workExperienceBoost:
        candidate.workExperienceAnalysis?.related ??
        candidate.workExperienceBoost ??
        null,
      workExperienceAnalysis:
        candidate.workExperienceAnalysis?.analysis?.trim() || null,
    };
  }
  if (code && normalizeAnzsco(assessment.anzscoCode) === code) {
    return {
      anzscoCode: assessment.anzscoCode,
      title: assessment.title,
      determination: assessment.determination ?? null,
      confidence: assessment.confidence ?? null,
      confidenceScore:
        typeof assessment.confidenceScore === "number" &&
        Number.isFinite(assessment.confidenceScore)
          ? assessment.confidenceScore
          : null,
      foundationalMatched: assessment.foundationalMatched,
      foundationalExpected: assessment.foundationalExpected,
      foundationalPct: assessment.foundationalPct,
      coreMatched: assessment.coreMatched,
      coreExpected: assessment.coreExpected,
      corePct: assessment.corePct,
      tier3GateMet: assessment.tier3GateMet,
      recommended: assessment.recommended,
      workExperienceBoost: assessment.workExperienceBoost,
      workExperienceAnalysis: null,
    };
  }
  return null;
}

export function determinationText(
  determination: AssessmentResult["determination"] | null | undefined,
): string | null {
  switch (determination) {
    case "verified_no_risk":
      return "Verified — no risk";
    case "conditional":
      return "Conditional";
    case "not_verified":
      return "Not verified";
    case "no_match":
      return "No match";
    default:
      return null;
  }
}

export function competenceLabel(
  competence: "competent" | "not_competent",
): string {
  return competence === "competent" ? "Competent" : "Not competent";
}
