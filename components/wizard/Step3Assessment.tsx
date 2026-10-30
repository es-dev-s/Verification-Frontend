"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnzscoCandidate,
  AssessmentResult,
  CoreBand,
  RubricSubjectCatalogEntry,
  SubjectMatchRow,
  VocationalAssessmentDetail,
  VocationalUnitMatch,
} from "@/lib/types";
import { gateBlocksScoring } from "@/lib/types";
import { Gate1Box } from "./Gate1Box";
import { ManualOccupationPicker } from "./ManualOccupationPicker";
import { QualificationEvidenceBox } from "./QualificationEvidenceBox";

const CORE_BAND_LABEL: Record<CoreBand, string> = {
  no_risk: "No Risk",
  low_risk: "Low Risk",
  medium_risk: "Medium Risk",
  high_risk: "High Risk",
};

function electiveStatusLabel(v: VocationalAssessmentDetail): string {
  if (v.electiveStatus === "not_assessed") return "Not assessed – minimum not set";
  return v.electiveStatus === "met" ? "Met" : "Not met";
}

function unitMatchLabel(m: VocationalUnitMatch): string {
  switch (m.matchType) {
    case "exact":
      return "Code";
    case "release":
      return `Release ${m.transcriptCode ?? ""}`.trim();
    case "equivalent":
      return `Via ${m.transcriptCode ?? "equivalent code"}`;
    case "typo":
      return `Typo ${m.transcriptCode ?? ""}`.trim();
    case "title":
      return "Title only";
  }
}

function coverageLabel(matched: number, expected: number, pct: number): string {
  const rounded = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${matched} / ${expected} — ${rounded}%`;
}

function methodBadge(method: SubjectMatchRow["method"]): {
  label: string;
  className: string;
} {
  switch (method) {
    case "exact":
      return {
        label: "Exact match",
        className: "bg-brand-soft text-brand-deeper",
      };
    case "fuzzy":
      return {
        label: "Variant match",
        className: "bg-brand-soft text-brand-dark",
      };
    case "llm":
      return {
        label: "AI-matched",
        className: "bg-brand-soft text-brand ring-1 ring-brand-ring",
      };
    default:
      return {
        label: "Unclassified",
        className: "bg-surface-tint text-ink-muted",
      };
  }
}

function confidenceBadge(confidence: AnzscoCandidate["confidence"] | AssessmentResult["confidence"]): {
  label: string;
  className: string;
} | null {
  if (!confidence) return null;
  switch (confidence) {
    case "high":
      return {
        label: "High",
        className: "bg-success-soft text-success",
      };
    case "medium":
      return {
        label: "Medium",
        className: "bg-brand-soft text-brand-dark",
      };
    case "low":
      return {
        label: "Low",
        className: "bg-[var(--warning-soft)] text-[var(--warning-ink)]",
      };
    default:
      return null;
  }
}

/** Fallback numeric score when API field is missing (cached legacy results). */
function resolveConfidenceScore(c: AnzscoCandidate): number {
  if (typeof c.confidenceScore === "number" && Number.isFinite(c.confidenceScore)) {
    return Math.max(0, Math.min(100, Math.round(c.confidenceScore)));
  }
  const coverage = c.corePct * 0.65 + c.foundationalPct * 0.35;
  if (c.confidence === "high") return Math.round(78 + coverage * 0.18);
  if (c.confidence === "medium") return Math.round(52 + coverage * 0.22);
  if (c.confidence === "low") return Math.round(35 + coverage * 0.15);
  return Math.round(8 + coverage * 0.34);
}

function formatConfidencePct(score: number): string {
  return `${Math.round(score)}%`;
}

/** Family-adjusted % (one decimal when needed, e.g. 67.5%). */
function formatAdjustedPct(score: number): string {
  const r = Math.round(score * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

/** Tier / unit coverage lines for a candidate card. */
function CandidateMetrics({
  c,
  compact = false,
  className,
}: {
  c: AnzscoCandidate;
  compact?: boolean;
  className: string;
}) {
  const rows: Array<[string, string]> = c.vocational
    ? [
        [
          "Core units",
          `${c.vocational.coreMatched}/${c.vocational.coreTotal} · ${CORE_BAND_LABEL[c.vocational.coreBand]}`,
        ],
        ["Electives", electiveStatusLabel(c.vocational)],
        ["Qualification", c.vocational.qualificationMet ? "Accepted" : "To confirm"],
      ]
    : [
        ["Tier 1", coverageLabel(c.foundationalMatched, c.foundationalExpected, c.foundationalPct)],
        ["Tier 2", coverageLabel(c.coreMatched, c.coreExpected, c.corePct)],
        ["Capstone", c.tier3GateMet ? "Capstone found" : "Capstone not found"],
      ];
  const shown = compact ? rows.slice(0, 2) : rows;
  return (
    <dl className={className}>
      {shown.map(([label, value]) => (
        <div key={label} className="flex min-w-0 justify-between gap-2">
          <dt className="shrink-0 text-ink-muted">{label}</dt>
          <dd className={`min-w-0 break-words text-right ${/\d/.test(value) ? "font-mono tabular-nums" : ""}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function determinationLabel(
  determination: AnzscoCandidate["determination"] | AssessmentResult["determination"] | undefined,
): string | null {
  if (!determination || determination === "no_match") return null;
  return determination.replace(/_/g, " ");
}

function isScoringMatch(m: SubjectMatchRow): boolean {
  return Boolean(
    m.rubricSubject &&
      m.method !== "none" &&
      m.category !== "catchAll" &&
      m.rubricSubject !== "Others",
  );
}

function lightNormalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Gate 1 stops scoring (an assessor-selected occupation re-opens it). */
function isGateBlocked(assessment: AssessmentResult | null | undefined): boolean {
  return gateBlocksScoring(assessment);
}

const TRACK_SHORT: Record<NonNullable<AnzscoCandidate["track"]>, string> = {
  professional_engineer: "Professional Engineer track",
  engineering_technologist: "Engineering Technologist track",
  engineering_associate: "Engineering Associate track",
};

function candidatesFromAssessment(
  assessment: AssessmentResult,
): AnzscoCandidate[] {
  // Gate 1 blocked (not eligible / manual review): nothing was scored.
  if (isGateBlocked(assessment)) return [];
  // Up to 3 matched + ET (Maybe Suitable) when ET took a top-3 slot.
  if (assessment.candidates?.length) return assessment.candidates.slice(0, 4);

  // Legacy cached results without candidates[] — synthesize one card.
  if (!assessment.anzscoCode && !assessment.title) {
    return [
      {
        anzscoCode: "—",
        title: "No occupation match",
        foundationalMatched: assessment.foundationalMatched,
        foundationalExpected: assessment.foundationalExpected,
        foundationalPct: assessment.foundationalPct,
        coreMatched: assessment.coreMatched,
        coreExpected: assessment.coreExpected,
        corePct: assessment.corePct,
        tier3GateMet: assessment.tier3GateMet,
        confidence: assessment.confidence,
        confidenceScore: assessment.confidenceScore,
        determination: assessment.determination,
        recommended: assessment.recommended,
        matches: assessment.matches,
        missingSubjects: assessment.missingSubjects ?? { tier1: [], tier2: [] },
        unmatched: assessment.unmatched,
        subjectCatalog: [],
      },
    ];
  }

  return [
    {
      anzscoCode: assessment.anzscoCode ?? "—",
      title: assessment.title ?? "Occupation",
      foundationalMatched: assessment.foundationalMatched,
      foundationalExpected: assessment.foundationalExpected,
      foundationalPct: assessment.foundationalPct,
      coreMatched: assessment.coreMatched,
      coreExpected: assessment.coreExpected,
      corePct: assessment.corePct,
      tier3GateMet: assessment.tier3GateMet,
      confidence: assessment.confidence,
      confidenceScore: assessment.confidenceScore,
      determination: assessment.determination,
      recommended: assessment.recommended,
      matches: assessment.matches,
      missingSubjects: assessment.missingSubjects ?? { tier1: [], tier2: [] },
      unmatched: assessment.unmatched,
      subjectCatalog: [],
    },
  ];
}

function transcriptSourceLabel(assessment: AssessmentResult): string {
  if (assessment.transcriptSource?.label) return assessment.transcriptSource.label;
  if (assessment.mastersFallbackUsed) {
    return "Matched using: Master's transcript (fallback — Bachelor's core coverage was below threshold)";
  }
  const used = assessment.qualificationsUsed ?? [];
  if (used.includes("bachelor") && !used.includes("master")) {
    return "Matched using: Bachelor's transcript";
  }
  if (used.includes("master") && !used.includes("bachelor")) {
    return "Matched using: Master's transcript";
  }
  if (used.includes("bachelor") && used.includes("master")) {
    return "Matched using: Bachelor's and Master's transcript subjects";
  }
  return "Matched using: transcript subjects";
}

type GroupedRubricSubject = {
  rubricSubject: string;
  tier: "tier1" | "tier2";
  hits: SubjectMatchRow[];
  bestMethod: SubjectMatchRow["method"];
};

function groupMatchedByRubric(
  matches: SubjectMatchRow[],
  tier: "tier1" | "tier2",
): GroupedRubricSubject[] {
  const map = new Map<string, SubjectMatchRow[]>();
  for (const m of matches) {
    if (!isScoringMatch(m) || m.tier !== tier || !m.rubricSubject) continue;
    const list = map.get(m.rubricSubject) ?? [];
    list.push(m);
    map.set(m.rubricSubject, list);
  }
  const methodRank: Record<SubjectMatchRow["method"], number> = {
    exact: 0,
    fuzzy: 1,
    llm: 2,
    none: 3,
  };
  return [...map.entries()].map(([rubricSubject, hits]) => {
    const bestMethod = hits.reduce(
      (best, h) =>
        methodRank[h.method] < methodRank[best] ? h.method : best,
      hits[0]!.method,
    );
    return { rubricSubject, tier, hits, bestMethod };
  });
}

function splitVariants(
  catalog: RubricSubjectCatalogEntry | undefined,
  hits: SubjectMatchRow[],
): { matchedVariants: string[]; unmatchedVariants: string[] } {
  const variants = catalog?.variants ?? [];
  const hitNorms = new Set(
    hits.map((h) => lightNormalize(h.transcriptName)).filter(Boolean),
  );
  // Also treat exact variant equality against transcript names
  const matchedVariants: string[] = [];
  const unmatchedVariants: string[] = [];

  for (const v of variants) {
    const vn = lightNormalize(v);
    const hit = [...hitNorms].some(
      (hn) => hn === vn || hn.includes(vn) || vn.includes(hn),
    );
    if (hit) matchedVariants.push(v);
    else unmatchedVariants.push(v);
  }

  // Transcript hits that don't line up with a listed variant still count as matched evidence
  const coveredNorms = new Set(matchedVariants.map(lightNormalize));
  for (const h of hits) {
    const n = lightNormalize(h.transcriptName);
    if (!n) continue;
    if (![...coveredNorms].some((c) => c === n || c.includes(n) || n.includes(c))) {
      if (!matchedVariants.includes(h.transcriptName)) {
        matchedVariants.unshift(h.transcriptName);
      }
    }
  }

  return { matchedVariants, unmatchedVariants };
}

function TierGroupHeader({
  title,
  coverage,
}: {
  title: string;
  coverage: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {title}
      </h4>
      <span className="font-mono text-[11px] tabular-nums text-ink-muted">
        {coverage}
      </span>
    </div>
  );
}

function EmptyListNote({ text }: { text: string }) {
  return <p className="py-2 text-xs text-ink-faint">{text}</p>;
}

function SubjectVariantsModal({
  subjectName,
  tierLabel,
  catalog,
  hits,
  onClose,
}: {
  subjectName: string;
  tierLabel: string;
  catalog: RubricSubjectCatalogEntry | undefined;
  hits: SubjectMatchRow[];
  onClose: () => void;
}) {
  const { matchedVariants, unmatchedVariants } = splitVariants(catalog, hits);
  const covered = hits.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(36,31,42,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-variants-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {tierLabel}
              {covered ? " · Covered" : " · Missing"}
            </p>
            <h3
              id="subject-variants-title"
              className="mt-1 text-base font-semibold text-ink"
            >
              {subjectName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface-tint"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(85vh-5.5rem)] space-y-5 overflow-y-auto px-5 py-4">
          {hits.length ? (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Transcript matches ({hits.length})
              </h4>
              <ul className="mt-2 space-y-1.5">
                {hits.map((h, i) => {
                  const badge = methodBadge(h.method);
                  return (
                    <li
                      key={`hit-${h.transcriptName}-${i}`}
                      className="flex items-start justify-between gap-2 rounded-lg bg-surface-tint px-3 py-2"
                    >
                      <span className="text-xs font-medium text-ink">
                        {h.transcriptName}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
              Matched variants ({matchedVariants.length})
            </h4>
            {matchedVariants.length ? (
              <ul className="mt-2 space-y-1.5">
                {matchedVariants.map((v) => (
                  <li
                    key={`mv-${v}`}
                    className="rounded-lg border border-success-line bg-success-soft px-3 py-2 text-xs text-ink"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">
                No listed naming variants lined up with the transcript.
              </p>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Unmatched variants ({unmatchedVariants.length})
            </h4>
            {unmatchedVariants.length ? (
              <ul className="mt-2 space-y-1.5">
                {unmatchedVariants.map((v) => (
                  <li
                    key={`uv-${v}`}
                    className="rounded-lg bg-surface-tint px-3 py-2 text-xs text-ink-muted"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">
                {variantsEmptyMessage(catalog)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 3 breakdown for unit-code occupations (e.g. 312311). */
function VocationalBreakdown({ detail }: { detail: VocationalAssessmentDetail }) {
  const t = detail.thresholds;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Core units
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            {detail.coreMatched}/{detail.coreTotal} · {CORE_BAND_LABEL[detail.coreBand]}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            No Risk {t.noRisk}–{detail.coreTotal} · Low {t.lowRisk}–{t.noRisk - 1} · Medium{" "}
            {t.mediumRisk}–{t.lowRisk - 1} · High 0–{t.mediumRisk - 1}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Electives
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{electiveStatusLabel(detail)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{detail.electiveNote}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Qualification
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            {detail.qualificationMet ? "Accepted" : "To confirm"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{detail.qualificationNote}</p>
        </div>
      </div>

      {detail.flags.length ? (
        <ul className="space-y-1 rounded-xl border border-line bg-[var(--warning-soft)] px-3.5 py-3">
          {detail.flags.map((f, i) => (
            <li key={`vf-${i}`} className="text-[12px] leading-snug text-[var(--warning-ink)]">
              {f}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
          <h3 className="mb-3 shrink-0 text-sm font-semibold text-ink">
            Matched core units ({detail.matchedCore.length})
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            {detail.matchedCore.length ? (
              <ul className="space-y-2">
                {detail.matchedCore.map((m) => (
                  <li key={`vm-${m.unitId}`} className="rounded-lg bg-surface px-2.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-ink">
                        <span className="font-mono">{m.code}</span> — {m.title}
                      </p>
                      <span className="shrink-0 rounded-md bg-surface-tint px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                        {unitMatchLabel(m)}
                      </span>
                    </div>
                    {m.matchType !== "exact" ? (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {m.note}
                        {m.source ? (
                          <>
                            {" "}
                            <a
                              href={m.source}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              source
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyListNote text="No core units matched" />
            )}
          </div>
        </div>

        <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
          <h3 className="mb-3 shrink-0 text-sm font-semibold text-ink">
            Missing core units ({detail.missingCore.length})
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            {detail.missingCore.length ? (
              <ul className="space-y-1.5">
                {detail.missingCore.map((u) => (
                  <li
                    key={`vx-${u.unitId}`}
                    className="rounded-lg bg-surface px-2.5 py-2 text-xs text-ink-muted"
                  >
                    <span className="font-mono">{u.code}</span> — {u.title}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyListNote text="All core units found" />
            )}
          </div>
        </div>

        <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
          <h3 className="mb-3 shrink-0 text-sm font-semibold text-ink">
            Electives found ({detail.electivesFound.length})
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            {detail.electivesFound.length ? (
              <ul className="space-y-1.5">
                {detail.electivesFound.map((e) => (
                  <li
                    key={`ve-${e.code}`}
                    className="rounded-lg bg-surface px-2.5 py-2 text-xs text-ink-muted"
                  >
                    <span className="font-mono">{e.code}</span>
                    {e.name ? ` — ${e.name}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyListNote text="No other unit codes on the transcript" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function variantsEmptyMessage(catalog: RubricSubjectCatalogEntry | undefined): string {
  if (!catalog) return "Variant list not available for this subject.";
  if (!catalog.variants.length) return "No naming variants listed for this subject.";
  return "All listed variants appear covered.";
}

export function Step3Assessment({
  assessment,
  loading,
  error,
  onBack,
  onRetry,
  onConfirmOccupation,
  onRunManualOccupation,
}: {
  assessment: AssessmentResult | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  /** Re-score the saved subjects (no transcript re-read). */
  onRetry: () => void;
  onConfirmOccupation?: (candidate: AnzscoCandidate) => void;
  /** Gate 1 manual review: score the assessor-selected occupation. */
  onRunManualOccupation?: (occupationId: string) => void;
}) {
  const candidates = useMemo(
    () => (assessment ? candidatesFromAssessment(assessment) : []),
    [assessment],
  );

  // Family rules (API): primary first, alternatives by adjusted confidence.
  const family = assessment?.familyAdjustment ?? null;
  const adjByCode = useMemo(
    () => new Map((family?.occupations ?? []).map((o) => [o.anzscoCode, o])),
    [family],
  );
  const recommendedCandidate = useMemo(() => {
    if (!candidates.length) return null;
    const recommended = candidates.filter((c) => c.recommended);
    const pool = recommended.length ? recommended : candidates;
    return [...pool].sort(
      (a, b) => resolveConfidenceScore(b) - resolveConfidenceScore(a),
    )[0] ?? null;
  }, [candidates]);
  const primaryCandidate = useMemo(
    () =>
      (family ? candidates.find((c) => c.anzscoCode === family.primaryCode) : null) ??
      recommendedCandidate,
    [family, candidates, recommendedCandidate],
  );
  const alternativeCandidates = useMemo(() => {
    if (!primaryCandidate) return [];
    // ET shown once, as the Maybe Suitable card.
    const etCode = family?.maybeSuitable?.inCandidates
      ? family.maybeSuitable.anzscoCode
      : null;
    const order = new Map((family?.occupations ?? []).map((o, i) => [o.anzscoCode, i]));
    return candidates
      .filter((c) => c.anzscoCode !== primaryCandidate.anzscoCode && c.anzscoCode !== etCode)
      .sort((a, b) => (order.get(a.anzscoCode) ?? 99) - (order.get(b.anzscoCode) ?? 99));
  }, [family, candidates, primaryCandidate]);

  // Top matches row layout (UI only): primary + alternatives + ET in one row.
  const hasMaybeSuitable = Boolean(family?.maybeSuitable);
  const rowCardCount = 1 + alternativeCandidates.length + (hasMaybeSuitable ? 1 : 0);

  const [viewingCode, setViewingCode] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [detailSubject, setDetailSubject] = useState<{
    name: string;
    tier: "tier1" | "tier2";
  } | null>(null);

  useEffect(() => {
    if (!candidates.length) {
      setViewingCode(null);
      setConfirmedCode(null);
      setDetailSubject(null);
      return;
    }
    setViewingCode((prev) =>
      prev && candidates.some((c) => c.anzscoCode === prev)
        ? prev
        : (primaryCandidate ?? candidates[0]!).anzscoCode,
    );
    setConfirmedCode(null);
    setDetailSubject(null);
  }, [candidates, primaryCandidate]);

  const gateBlocked = isGateBlocked(assessment);
  const selected =
    candidates.find((c) => c.anzscoCode === viewingCode) ??
    primaryCandidate ??
    candidates[0] ??
    null;

  const matchedTier1 = useMemo(
    () => groupMatchedByRubric(selected?.matches ?? [], "tier1"),
    [selected],
  );
  const matchedTier2 = useMemo(
    () => groupMatchedByRubric(selected?.matches ?? [], "tier2"),
    [selected],
  );

  const missingTier1 = selected?.missingSubjects.tier1 ?? [];
  const missingTier2 = selected?.missingSubjects.tier2 ?? [];
  const unclassified = selected?.unmatched ?? [];
  const catalog = selected?.subjectCatalog ?? [];

  const catalogByName = useMemo(() => {
    const map = new Map<string, RubricSubjectCatalogEntry>();
    for (const s of catalog) map.set(s.name, s);
    return map;
  }, [catalog]);

  const tier1Coverage = selected
    ? coverageLabel(
        selected.foundationalMatched,
        selected.foundationalExpected,
        selected.foundationalPct,
      )
    : "";
  const tier2Coverage = selected
    ? coverageLabel(
        selected.coreMatched,
        selected.coreExpected,
        selected.corePct,
      )
    : "";

  const selectedConfidence = confidenceBadge(
    selected?.confidence ?? assessment?.confidence ?? null,
  );
  const selectedScore = selected
    ? resolveConfidenceScore(selected)
    : typeof assessment?.confidenceScore === "number"
      ? assessment.confidenceScore
      : null;
  const selectedDetermination = determinationLabel(
    selected?.determination ?? assessment?.determination,
  );

  const selectedWorkAnalysis = selected?.workExperienceAnalysis ?? null;
  const selectedWorkRelated = Boolean(
    selectedWorkAnalysis?.related ??
      selected?.workExperienceBoost ??
      assessment?.workExperienceBoost,
  );
  const workConfidenceBefore =
    typeof selectedWorkAnalysis?.confidenceScoreBefore === "number"
      ? selectedWorkAnalysis.confidenceScoreBefore
      : selectedWorkRelated && typeof selectedScore === "number"
        ? Math.max(0, selectedScore - 4)
        : typeof selectedScore === "number"
          ? selectedScore
          : null;
  const workConfidenceAfter =
    typeof selectedWorkAnalysis?.confidenceScoreAfter === "number"
      ? selectedWorkAnalysis.confidenceScoreAfter
      : typeof selectedScore === "number"
        ? selectedScore
        : null;
  const workConfidenceDelta =
    workConfidenceBefore != null && workConfidenceAfter != null
      ? workConfidenceAfter - workConfidenceBefore
      : null;
  const matchedWorkJobs =
    selectedWorkAnalysis?.matchedJobs?.filter((j) => j.title) ?? [];

  const detailCatalog = detailSubject
    ? catalogByName.get(detailSubject.name)
    : undefined;
  const detailHits = detailSubject
    ? (selected?.matches ?? []).filter(
        (m) =>
          isScoringMatch(m) &&
          m.rubricSubject === detailSubject.name &&
          m.tier === detailSubject.tier,
      )
    : [];

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          ANZSCO matching
        </h1>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface/95 p-8 text-center">
          <p className="text-sm font-medium text-ink">
            Matching subjects against ANZSCO rubrics
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Uses the subjects saved in Transcript data. This may take a moment.
          </p>
        </div>
      ) : null}

      {error && !loading ? (
        <div className="mb-5 rounded-2xl border border-line bg-surface-tint p-5">
          <p className="text-sm font-medium text-ink">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Retry
          </button>
        </div>
      ) : null}

      {assessment && !loading ? (
        <div className="space-y-4">
          <section
            aria-label="Extracted subjects"
            className="rounded-2xl border border-line bg-surface/95 p-4 sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Extracted subjects
              </p>
              <p className="text-xs font-medium tabular-nums text-ink-faint">
                {(assessment.extractedSubjects ?? []).length} subjects
              </p>
            </div>
            {(assessment.extractedSubjects ?? []).length ? (
              <ul className="grid max-h-64 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-2 [scrollbar-gutter:stable]">
                {(assessment.extractedSubjects ?? []).map((s, i) => (
                  <li
                    key={`ex-${s.name}-${i}`}
                    className="rounded-lg bg-surface-subtle px-2.5 py-2 text-xs leading-snug text-ink"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.qualification && s.qualification !== "unknown" ? (
                      <span className="ml-1.5 text-ink-faint">
                        · {s.qualification}
                      </span>
                    ) : null}
                    {s.code ? (
                      <span className="ml-1.5 text-ink-faint">{s.code}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-surface-tint px-3 py-2.5 text-sm text-ink-muted">
                No subjects extracted from the transcript.
              </p>
            )}
          </section>

          {assessment.gate1 ? <Gate1Box gate={assessment.gate1} /> : null}

          {assessment.gate1?.result === "manual_review" && onRunManualOccupation ? (
            <ManualOccupationPicker
              key={assessment.assessorSelected?.occupationId ?? "none"}
              current={assessment.assessorSelected}
              busy={loading}
              onRun={onRunManualOccupation}
            />
          ) : null}


          {!assessment.gate1 && assessment.routing?.note ? (
            <section
              aria-label="Qualification route"
              className="rounded-xl border border-line bg-surface/95 px-4 py-2.5"
            >
              <p className="text-sm leading-snug text-ink">{assessment.routing.note}</p>
              {assessment.routing.notes.length ? (
                <ul className="mt-1 space-y-0.5">
                  {assessment.routing.notes.map((note, i) => (
                    <li key={`route-${i}`} className="text-[12px] leading-snug text-ink-muted">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {assessment.qualificationEvidence && !gateBlocked ? (
            <QualificationEvidenceBox evidence={assessment.qualificationEvidence} />
          ) : null}

          {/* 1. Suggested ANZSCOs — primary (large) + alternatives (small) + ET Maybe Suitable */}
          {!gateBlocked && primaryCandidate ? (
          <section aria-label="Suggested ANZSCO occupations" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Top matches
              </p>
            </div>
            <div
              className={`grid items-start gap-3 ${
                rowCardCount >= 4
                  ? "md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
                  : rowCardCount === 3
                    ? "md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"
                    : rowCardCount === 2
                      ? "md:grid-cols-[1.5fr_1fr]"
                      : ""
              }`}
            >
            {(() => {
              const c = primaryCandidate;
              const active = selected?.anzscoCode === c.anzscoCode;
              const conf = confidenceBadge(c.confidence ?? assessment.confidence);
              const primaryScore =
                family?.primaryConfidence ?? resolveConfidenceScore(c);
              return (
                <button
                  type="button"
                  onClick={() => setViewingCode(c.anzscoCode)}
                  className={`w-full min-w-0 rounded-2xl border p-4 text-left transition ${
                    rowCardCount === 3 ? "md:col-span-2 lg:col-span-1" : ""
                  } ${
                    active
                      ? "border-brand bg-surface shadow-[0_0_0_1px_var(--brand)]"
                      : "border-line bg-surface/95 hover:border-line-strong"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            c.recommended
                              ? "bg-success-soft text-success"
                              : "bg-surface-tint text-ink-muted"
                          }`}
                        >
                          {c.recommended ? "Recommended" : "Best coverage · not recommended"}
                        </span>
                        {assessment.assessorSelected ? (
                          <span className="rounded-full bg-surface-tint px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                            Assessor-selected occupation
                          </span>
                        ) : null}
                        {conf ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${conf.className}`}
                          >
                            {conf.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 break-words text-base font-semibold leading-snug text-ink">
                        {c.title}
                        <span className="font-mono tabular-nums"> · {c.anzscoCode}</span>
                      </p>
                      {c.track ? (
                        <p className="mt-0.5 text-[11px] text-ink-faint">{TRACK_SHORT[c.track]}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-brand-deeper">
                      {formatAdjustedPct(primaryScore)}
                    </p>
                  </div>
                  <CandidateMetrics
                    c={c}
                    className={`mt-3 grid gap-x-5 gap-y-1 text-xs text-ink-muted ${
                      rowCardCount >= 4 ? "sm:grid-cols-2 lg:grid-cols-1" : "sm:grid-cols-2"
                    }`}
                  />
                </button>
              );
            })()}

            {alternativeCandidates.map((c) => {
                  const active = selected?.anzscoCode === c.anzscoCode;
                  const adj = adjByCode.get(c.anzscoCode);
                  const shown = adj?.adjustedConfidence ?? resolveConfidenceScore(c);
                  return (
                    <button
                      key={c.anzscoCode}
                      type="button"
                      onClick={() => setViewingCode(c.anzscoCode)}
                      className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-brand bg-surface shadow-[0_0_0_1px_var(--brand)]"
                          : "border-line bg-surface/95 hover:border-line-strong"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] tabular-nums text-ink-muted">
                            {c.anzscoCode}
                          </p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[13px] font-medium leading-snug text-ink">
                            {c.title}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink">
                          {formatAdjustedPct(shown)}
                        </p>
                      </div>
                      {adj?.changed ? (
                        <p className="mt-1 text-[10px] leading-snug text-ink-muted">
                          <span className="font-mono tabular-nums">
                            {formatAdjustedPct(adj.originalConfidence)} →{" "}
                            {formatAdjustedPct(adj.adjustedConfidence)}
                          </span>
                          <span className="text-ink-faint"> · {adj.reason}</span>
                        </p>
                      ) : null}
                      <CandidateMetrics c={c} compact className="mt-1.5 space-y-0.5 text-[10px] text-ink-muted" />
                    </button>
                  );
                })}
            {family?.maybeSuitable ? (
              (() => {
                const et = family.maybeSuitable;
                const etCandidate = et.inCandidates
                  ? candidates.find((c) => c.anzscoCode === et.anzscoCode) ?? null
                  : null;
                const active = etCandidate && selected?.anzscoCode === etCandidate.anzscoCode;
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] tabular-nums text-ink-muted">
                          {et.anzscoCode}
                        </p>
                        <p className="mt-0.5 line-clamp-2 break-words text-[13px] font-medium leading-snug text-ink">
                          {et.title}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink">
                        {formatAdjustedPct(et.adjustedConfidence)}
                      </p>
                    </div>
                    <span className="mt-1.5 inline-block rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning-ink)]">
                      {et.label}
                    </span>
                  </>
                );
                const cls = `min-w-0 rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-brand bg-surface shadow-[0_0_0_1px_var(--brand)]"
                    : "border-line bg-surface/95"
                }`;
                return etCandidate ? (
                  <button
                    type="button"
                    onClick={() => setViewingCode(etCandidate.anzscoCode)}
                    className={`${cls} ${active ? "" : "hover:border-line-strong"}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                );
              })()
            ) : null}
            </div>

          </section>
          ) : null}

          {selected && !gateBlocked ? (
            <>
              {/* Meta strip: source + work experience + confidence */}
              <div className="grid gap-3 md:grid-cols-3">
                <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Transcript source
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-ink">
                    {transcriptSourceLabel(assessment)}
                  </p>
                </section>
                <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Confidence
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-ink">
                    {selectedScore != null
                      ? `${formatConfidencePct(selectedScore)}${
                          selectedConfidence
                            ? ` · ${selectedConfidence.label}`
                            : " · Not recommended"
                        }`
                      : selectedConfidence
                        ? selectedConfidence.label
                        : "No confidence score (not recommended)"}
                  </p>
                  {selectedDetermination ? (
                    <p className="mt-1 text-[11px] capitalize text-ink-faint">
                      Determination: {selectedDetermination}
                    </p>
                  ) : null}
                </section>
                <section className="rounded-2xl border border-dashed border-line-strong bg-surface-tint px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Work experience
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-ink">
                    {selectedWorkRelated
                      ? "Relevant to this occupation"
                      : "Not clearly related"}
                  </p>
                  {workConfidenceBefore != null &&
                  workConfidenceAfter != null ? (
                    <p className="mt-1.5 text-sm font-medium tabular-nums text-ink">
                      {formatConfidencePct(workConfidenceBefore)}
                      <span className="mx-1.5 text-ink-faint">→</span>
                      {formatConfidencePct(workConfidenceAfter)}
                      {workConfidenceDelta != null &&
                      workConfidenceDelta !== 0 ? (
                        <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                          ({workConfidenceDelta > 0 ? "+" : ""}
                          {workConfidenceDelta} pts)
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {matchedWorkJobs.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {matchedWorkJobs.map((job, i) => (
                        <li
                          key={`${job.title}-${i}`}
                          className="text-[12px] leading-snug text-ink"
                        >
                          <span className="font-medium">{job.title}</span>
                          {job.employer ? (
                            <span className="text-ink-muted">
                              {" "}
                              @ {job.employer}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {selectedWorkAnalysis?.analysis ? (
                    <p className="mt-2 text-[12px] leading-snug text-ink-muted">
                      {selectedWorkAnalysis.analysis}
                    </p>
                  ) : null}
                </section>
              </div>

              {selected.qualificationNotes?.length ? (
                <section
                  aria-label="Qualification check"
                  className="rounded-2xl border border-line bg-[var(--warning-soft)] px-4 py-3.5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warning-ink)]">
                    Qualification check
                    {selected.qualificationCapped
                      ? " · capped at conditional"
                      : ""}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {selected.qualificationNotes.map((note, i) => (
                      <li
                        key={`${i}-${note}`}
                        className="text-sm leading-snug text-[var(--warning-ink)]"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* 2. Full breakdown — three lists */}
              <section
                aria-label={`Breakdown for ${selected.title}`}
                className="rounded-2xl border border-line bg-surface/95 p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Subject breakdown
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-ink">
                      {selected.anzscoCode} — {selected.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedCode(selected.anzscoCode);
                      onConfirmOccupation?.(selected);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      confirmedCode === selected.anzscoCode
                        ? "bg-brand-dark text-white"
                        : "bg-brand text-white shadow-[0_6px_16px_rgba(146,86,169,0.22)] hover:bg-brand-dark"
                    }`}
                  >
                    {confirmedCode === selected.anzscoCode
                      ? "Continue to risk →"
                      : "Select & continue to risk"}
                  </button>
                </div>

                {selected.vocational ? (
                  <VocationalBreakdown detail={selected.vocational} />
                ) : (
                <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                  {/* Matched */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-ink">
                        Matched subjects
                      </h3>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      <div>
                        <TierGroupHeader
                          title="Tier 1 · Foundational"
                          coverage={tier1Coverage}
                        />
                        {matchedTier1.length ? (
                          <ul className="space-y-2">
                            {matchedTier1.map((g) => {
                              const badge = methodBadge(g.bestMethod);
                              return (
                                <li key={`m1-${g.rubricSubject}`}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailSubject({
                                        name: g.rubricSubject,
                                        tier: "tier1",
                                      })
                                    }
                                    className="w-full rounded-lg bg-surface px-2.5 py-2 text-left transition hover:ring-1 hover:ring-brand-ring"
                                  >
                                    <p className="text-xs font-medium text-ink">
                                      {g.rubricSubject}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-ink-muted">
                                      {g.hits.length === 1
                                        ? `from ${g.hits[0]!.transcriptName}`
                                        : `${g.hits.length} transcript subjects`}
                                    </p>
                                    <span
                                      className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <EmptyListNote text="No Tier 1 matches" />
                        )}
                      </div>

                      <div>
                        <TierGroupHeader
                          title="Tier 2 · Core"
                          coverage={tier2Coverage}
                        />
                        {matchedTier2.length ? (
                          <ul className="space-y-2">
                            {matchedTier2.map((g) => {
                              const badge = methodBadge(g.bestMethod);
                              return (
                                <li key={`m2-${g.rubricSubject}`}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailSubject({
                                        name: g.rubricSubject,
                                        tier: "tier2",
                                      })
                                    }
                                    className="w-full rounded-lg bg-surface px-2.5 py-2 text-left transition hover:ring-1 hover:ring-brand-ring"
                                  >
                                    <p className="text-xs font-medium text-ink">
                                      {g.rubricSubject}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-ink-muted">
                                      {g.hits.length === 1
                                        ? `from ${g.hits[0]!.transcriptName}`
                                        : `${g.hits.length} transcript subjects`}
                                    </p>
                                    <span
                                      className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <EmptyListNote text="No Tier 2 matches" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Missing */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-ink">
                        Missing subjects
                      </h3>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      <div>
                        <TierGroupHeader
                          title="Tier 1 · Foundational"
                          coverage={tier1Coverage}
                        />
                        {missingTier1.length ? (
                          <ul className="space-y-1.5">
                            {missingTier1.map((name) => (
                              <li key={`miss1-${name}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailSubject({ name, tier: "tier1" })
                                  }
                                  className="w-full rounded-lg bg-surface px-2.5 py-2 text-left text-xs text-ink-muted transition hover:ring-1 hover:ring-brand-ring"
                                >
                                  {name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyListNote text="All Tier 1 expected subjects covered" />
                        )}
                      </div>

                      <div>
                        <TierGroupHeader
                          title="Tier 2 · Core"
                          coverage={tier2Coverage}
                        />
                        {missingTier2.length ? (
                          <ul className="space-y-1.5">
                            {missingTier2.map((name) => (
                              <li key={`miss2-${name}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailSubject({ name, tier: "tier2" })
                                  }
                                  className="w-full rounded-lg bg-surface px-2.5 py-2 text-left text-xs text-ink-muted transition hover:ring-1 hover:ring-brand-ring"
                                >
                                  {name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyListNote text="All Tier 2 core subjects covered" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unclassified */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-ink">
                        Unclassified subjects
                      </h3>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      {unclassified.length ? (
                        <ul className="space-y-1.5">
                          {unclassified.map((u, i) => (
                            <li
                              key={`u-${u.name}-${i}`}
                              className="rounded-lg bg-surface px-2.5 py-2 text-xs text-ink-muted"
                            >
                              {u.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyListNote text="No unclassified transcript subjects" />
                      )}
                    </div>
                  </div>
                </div>
                )}
              </section>

              {confirmedCode ? (
                <p className="text-center text-xs text-ink-muted">
                  Opening risk analysis for{" "}
                  <span className="font-medium text-ink">
                    {
                      candidates.find((c) => c.anzscoCode === confirmedCode)
                        ?.title
                    }{" "}
                    ({confirmedCode})
                  </span>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {detailSubject && selected ? (
        <SubjectVariantsModal
          subjectName={detailSubject.name}
          tierLabel={
            detailSubject.tier === "tier1"
              ? "Tier 1 · Foundational"
              : "Tier 2 · Core"
          }
          catalog={detailCatalog}
          hits={detailHits}
          onClose={() => setDetailSubject(null)}
        />
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        {assessment && !loading ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
          >
            Re-run matching
          </button>
        ) : null}
      </div>
    </div>
  );
}
