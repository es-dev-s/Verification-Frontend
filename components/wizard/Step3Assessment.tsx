"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnzscoCandidate,
  AssessmentResult,
  RubricSubjectCatalogEntry,
  SubjectMatchRow,
} from "@/lib/types";

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

function recommendationSummary(c: AnzscoCandidate): string {
  const score = resolveConfidenceScore(c);
  const t1 = coverageLabel(
    c.foundationalMatched,
    c.foundationalExpected,
    c.foundationalPct,
  );
  const t2 = coverageLabel(c.coreMatched, c.coreExpected, c.corePct);
  const gate = c.tier3GateMet ? "capstone met" : "capstone missing";
  if (c.recommended) {
    return `Recommended ${c.title} (${c.anzscoCode}) at ${formatConfidencePct(score)} confidence — Tier 1 ${t1}, Tier 2 ${t2}, ${gate}.`;
  }
  return `Highest coverage is ${c.title} (${c.anzscoCode}) at ${formatConfidencePct(score)}, but it is not strong enough to recommend — Tier 1 ${t1}, Tier 2 ${t2}.`;
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

function candidatesFromAssessment(
  assessment: AssessmentResult,
): AnzscoCandidate[] {
  if (assessment.candidates?.length) return assessment.candidates.slice(0, 3);

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
            <p className="mt-1 text-xs text-ink-muted">
              Naming variants accepted for this rubric subject
            </p>
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
}: {
  assessment: AssessmentResult | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onConfirmOccupation?: (candidate: AnzscoCandidate) => void;
}) {
  const candidates = useMemo(
    () => (assessment ? candidatesFromAssessment(assessment) : []),
    [assessment],
  );

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
        : candidates[0]!.anzscoCode,
    );
    setConfirmedCode(null);
    setDetailSubject(null);
  }, [candidates]);

  const selected =
    candidates.find((c) => c.anzscoCode === viewingCode) ?? candidates[0] ?? null;

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

  const recommendedCandidate = useMemo(() => {
    if (!candidates.length) return null;
    const recommended = candidates.filter((c) => c.recommended);
    const pool = recommended.length ? recommended : candidates;
    return [...pool].sort(
      (a, b) => resolveConfidenceScore(b) - resolveConfidenceScore(a),
    )[0] ?? null;
  }, [candidates]);

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
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-muted">
          Transcript subjects matched against occupation rubrics. Counts and
          percentages are raw coverage — not a risk determination. Click a
          subject to inspect naming variants.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface/95 p-8 text-center">
          <p className="text-sm font-medium text-ink">
            Running subject matching…
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Extracting subjects and comparing against ANZSCO rubrics. This may
            take a minute.
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
          {recommendedCandidate ? (
            <section
              aria-label="Recommended occupation"
              className="rounded-xl border border-success-line bg-success-soft px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
                    {recommendedCandidate.recommended
                      ? "Recommended"
                      : "Best coverage"}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-ink">
                    {recommendationSummary(recommendedCandidate)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-success">
                  {formatConfidencePct(
                    resolveConfidenceScore(recommendedCandidate),
                  )}
                </p>
              </div>
            </section>
          ) : null}

          {/* 1. Top candidates — bento comparison row */}
          <section aria-label="Top ANZSCO candidates">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Top matches
              </p>
              <p className="text-[11px] text-ink-faint">
                Select a card to inspect its breakdown
              </p>
            </div>
            <div
              className={`grid gap-3 ${
                candidates.length >= 3
                  ? "md:grid-cols-3"
                  : candidates.length === 2
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
              }`}
            >
              {candidates.map((c, rank) => {
                const active = selected?.anzscoCode === c.anzscoCode;
                const conf = confidenceBadge(
                  c.confidence ??
                    (rank === 0 ? assessment.confidence : null),
                );
                const score = resolveConfidenceScore(c);
                const isTopRec =
                  recommendedCandidate?.anzscoCode === c.anzscoCode &&
                  c.recommended;
                return (
                  <button
                    key={c.anzscoCode}
                    type="button"
                    onClick={() => setViewingCode(c.anzscoCode)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-brand bg-surface shadow-[0_0_0_1px_var(--brand)]"
                        : "border-line bg-surface/95 hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] tabular-nums text-ink-muted">
                          #{rank + 1} · {c.anzscoCode}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                          {c.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isTopRec ? (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                            Recommended
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-brand-deeper">
                        {formatConfidencePct(score)}
                      </span>
                      {conf ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${conf.className}`}
                        >
                          {conf.label}
                        </span>
                      ) : (
                        <span className="rounded-md bg-surface-tint px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                          Not recommended
                        </span>
                      )}
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs text-ink-muted">
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">Tier 1</dt>
                        <dd className="font-mono tabular-nums">
                          {coverageLabel(
                            c.foundationalMatched,
                            c.foundationalExpected,
                            c.foundationalPct,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">Tier 2</dt>
                        <dd className="font-mono tabular-nums">
                          {coverageLabel(
                            c.coreMatched,
                            c.coreExpected,
                            c.corePct,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">Capstone</dt>
                        <dd>
                          {c.tier3GateMet
                            ? "Capstone found"
                            : "Capstone not found"}
                        </dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </section>

          {selected ? (
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
                    {assessment.workExperienceBoost
                      ? "Work experience: relevant to this occupation"
                      : "Work experience: not clearly related"}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Separate from academic Tier 1 / Tier 2 coverage
                  </p>
                </section>
              </div>

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
                    <p className="mt-1 text-[11px] text-ink-faint">
                      Click a subject to see matched and unmatched naming
                      variants
                    </p>
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
                      ? "Occupation selected"
                      : "Select this occupation"}
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                  {/* Matched */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-line bg-surface-subtle p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-ink">
                        Matched subjects
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Rubric topics covered by the transcript
                      </p>
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
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Rubric subjects not covered — click for variants
                      </p>
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
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Informational — not counted in coverage
                      </p>
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
              </section>

              {confirmedCode ? (
                <p className="text-center text-xs text-ink-muted">
                  Selected for next phase:{" "}
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
