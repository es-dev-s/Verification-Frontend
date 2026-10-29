"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnzscoCandidate,
  AssessmentResult,
  Competence,
  DegreeLevel,
  MissingSubjectsByTier,
  PrecedentCaseRow,
  PrecedentCheck,
  RiskAssessmentResult,
  RiskComponentScore,
  RiskLevel,
  RiskScoringBreakdown,
  SubjectMatchRow,
} from "@/lib/types";
import {
  buildConfirmationQualifications,
  type ConfirmationQualification,
} from "@/lib/wizard";
import {
  formatPct,
  normalizeAnzsco,
  precedentRiskBadge,
  riskBadge,
} from "@/lib/riskDisplay";

const PAGE_SIZE = 10;

function StatMiniCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-snug text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function emptyPrecedent(): PrecedentCheck {
  return {
    matchingCases: 0,
    positiveOutcomeRate: 0,
    overallRisk: null,
    riskCounts: { no_risk: 0, slight_risk: 0, high_risk: 0 },
    cases: [],
  };
}

function MatchingCasesModal({
  precedent,
  qualifications,
  onClose,
}: {
  precedent: PrecedentCheck;
  qualifications: ConfirmationQualification[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(precedent.cases.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return precedent.cases.slice(start, start + PAGE_SIZE);
  }, [page, precedent.cases]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overall = precedent.overallRisk
    ? precedentRiskBadge(precedent.overallRisk)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(36,31,42,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="precedent-cases-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Past cases
            </p>
            <h3
              id="precedent-cases-title"
              className="mt-1 text-base font-semibold text-ink"
            >
              Matching cases
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Historical risk and outcome from past cases with the same occupation
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

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-line bg-surface-tint px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Your degree details
            </p>
            {!qualifications.length ? (
              <p className="mt-2 text-sm text-ink-muted">
                No degree details from Step 1.
              </p>
            ) : (
              <div className="mt-2.5 space-y-3">
                {qualifications.map((block) => (
                  <div
                    key={block.degreeLevel}
                    className="rounded-lg border border-line bg-surface px-3 py-2.5"
                  >
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      {block.label}
                    </p>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-[11px] text-ink-muted">
                          Degree title
                        </dt>
                        <dd className="font-medium text-ink">
                          {block.degreeTitle}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-muted">
                          Institution
                        </dt>
                        <dd className="font-medium text-ink">
                          {block.institution}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-muted">Country</dt>
                        <dd className="font-medium text-ink">
                          {block.country}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-ink-muted">
                          Duration (years)
                        </dt>
                        <dd className="font-medium text-ink">
                          {block.durationYears}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatMiniCard
              label="Matching cases"
              value={String(precedent.matchingCases)}
            />
            <StatMiniCard
              label="Positive outcome"
              value={formatPct(precedent.positiveOutcomeRate)}
            />
            <StatMiniCard
              label="Most common risk"
              value={overall?.label ?? "—"}
            />
            <StatMiniCard
              label="Slight risk"
              value={String(precedent.riskCounts.slight_risk)}
            />
            <StatMiniCard
              label="High risk"
              value={String(precedent.riskCounts.high_risk)}
            />
            <StatMiniCard
              label="No risk"
              value={String(precedent.riskCounts.no_risk)}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-surface-tint text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Occupation</th>
                  <th className="px-3 py-2.5 font-semibold">Degree</th>
                  <th className="px-3 py-2.5 font-semibold">University</th>
                  <th className="px-3 py-2.5 font-semibold">Country</th>
                  <th className="px-3 py-2.5 font-semibold">Risk</th>
                  <th className="px-3 py-2.5 font-semibold">Outcome</th>
                  <th className="px-3 py-2.5 font-semibold">Verified</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row: PrecedentCaseRow) => {
                  const badge = precedentRiskBadge(row.matchRisk);
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-line align-top text-ink"
                    >
                      <td className="px-3 py-2.5 text-xs leading-snug">
                        {row.occupation || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs leading-snug">
                        {row.degree || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs leading-snug">
                        {row.university || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs leading-snug">
                        {row.country || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs leading-snug">
                        {row.outcome || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs leading-snug text-ink-muted">
                        {row.verifiedDate || "—"}
                      </td>
                    </tr>
                  );
                })}
                {!pageRows.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-ink-muted"
                    >
                      No matching past cases
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {precedent.cases.length > 0 ? (
            <div className="flex items-center justify-between gap-3 pb-1">
              <p className="text-xs text-ink-muted">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, precedent.cases.length)} of{" "}
                {precedent.cases.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs tabular-nums text-ink-muted">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PrecedentCheckCard({
  precedent,
  qualifications,
}: {
  precedent: PrecedentCheck;
  qualifications: ConfirmationQualification[];
}) {
  const [open, setOpen] = useState(false);
  const overall = precedent.overallRisk
    ? precedentRiskBadge(precedent.overallRisk)
    : null;

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Precedent check
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Past cases with the same occupation — risk and outcome reused from
              historical data
            </p>
          </div>
          {precedent.matchingCases >= 1 ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-line bg-surface-subtle px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-tint"
            >
              View all matching cases
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-tint px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Matching cases
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {precedent.matchingCases}
            </p>
          </div>
          <div className="rounded-xl bg-surface-tint px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Positive outcome rate
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {precedent.matchingCases > 0
                ? formatPct(precedent.positiveOutcomeRate)
                : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-surface-tint px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Overall risk
            </p>
            <div className="mt-1.5">
              {overall ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${overall.className}`}
                >
                  {overall.label}
                </span>
              ) : (
                <span className="text-xl font-semibold text-ink-faint">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success ring-1 ring-success-line">
            No risk
            <span className="tabular-nums font-semibold">
              {precedent.riskCounts.no_risk}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#faf4ec] px-2.5 py-1 text-[11px] font-medium text-[#7a5c32] ring-1 ring-[#ead9b8]">
            Slight risk
            <span className="tabular-nums font-semibold">
              {precedent.riskCounts.slight_risk}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f8ecec] px-2.5 py-1 text-[11px] font-medium text-[#8a3a3a] ring-1 ring-[#e2c4c4]">
            High risk
            <span className="tabular-nums font-semibold">
              {precedent.riskCounts.high_risk}
            </span>
          </span>
        </div>
      </section>

      {open ? (
        <MatchingCasesModal
          precedent={precedent}
          qualifications={qualifications}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

type DomainSource = {
  matches: SubjectMatchRow[];
  missingSubjects: MissingSubjectsByTier;
  foundationalExpected: number | null;
  coreExpected: number | null;
};

/** Find the assessment candidate the risk run was computed for. */
function resolveDomainSource(
  assessment: AssessmentResult | null | undefined,
  anzscoCode: string,
): DomainSource | null {
  if (!assessment) return null;
  const code = normalizeAnzsco(anzscoCode);
  const candidate: AnzscoCandidate | undefined = assessment.candidates?.find(
    (c) => normalizeAnzsco(c.anzscoCode) === code,
  );
  if (candidate) {
    return {
      matches: candidate.matches ?? [],
      missingSubjects: candidate.missingSubjects ?? { tier1: [], tier2: [] },
      foundationalExpected: candidate.foundationalExpected ?? null,
      coreExpected: candidate.coreExpected ?? null,
    };
  }
  if (normalizeAnzsco(assessment.anzscoCode) === code) {
    return {
      matches: assessment.matches ?? [],
      missingSubjects: assessment.missingSubjects ?? { tier1: [], tier2: [] },
      foundationalExpected: assessment.foundationalExpected ?? null,
      coreExpected: assessment.coreExpected ?? null,
    };
  }
  return null;
}

/** Unique rubric subjects matched for a tier + category set (same rule as API scoring). */
function matchedSubjects(
  matches: SubjectMatchRow[],
  tier: "tier1" | "tier2",
  categories: string[],
): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    if (m.tier !== tier || !m.rubricSubject) continue;
    if (m.method === "none") continue;
    if (!categories.includes(m.category ?? "")) continue;
    set.add(m.rubricSubject);
  }
  return [...set];
}

type DomainRow = {
  key: string;
  label: string;
  tierLabel: string;
  kind: "matched" | "missing" | "supporting";
  subjects: string[];
  denominator: number | null;
  scored: boolean;
};

function buildDomainRows(source: DomainSource | null): DomainRow[] {
  const matches = source?.matches ?? [];
  const missing = source?.missingSubjects ?? { tier1: [], tier2: [] };
  return [
    {
      key: "major-foundational-matched",
      label: "Major foundational subject matched",
      tierLabel: "Tier 1",
      kind: "matched",
      subjects: matchedSubjects(matches, "tier1", ["expected"]),
      denominator: source?.foundationalExpected ?? null,
      scored: true,
    },
    {
      key: "major-foundational-missing",
      label: "Major foundational subject missing",
      tierLabel: "Tier 1",
      kind: "missing",
      subjects: missing.tier1 ?? [],
      denominator: null,
      scored: true,
    },
    {
      key: "supporting-foundational-matched",
      label: "Supporting foundational subject matched",
      tierLabel: "Tier 1",
      kind: "supporting",
      subjects: matchedSubjects(matches, "tier1", ["optional", "supporting"]),
      denominator: null,
      scored: false,
    },
    {
      key: "major-core-matched",
      label: "Major core matched",
      tierLabel: "Tier 2",
      kind: "matched",
      subjects: matchedSubjects(matches, "tier2", ["core"]),
      denominator: source?.coreExpected ?? null,
      scored: true,
    },
    {
      key: "major-core-missing",
      label: "Major core missing",
      tierLabel: "Tier 2",
      kind: "missing",
      subjects: missing.tier2 ?? [],
      denominator: null,
      scored: true,
    },
    {
      key: "supporting-core-matched",
      label: "Supporting core matched",
      tierLabel: "Tier 2",
      kind: "supporting",
      subjects: matchedSubjects(matches, "tier2", ["optional", "supporting"]),
      denominator: null,
      scored: false,
    },
  ];
}

function domainCountClass(kind: DomainRow["kind"], count: number): string {
  if (count === 0) {
    return "bg-surface-tint text-ink-muted ring-1 ring-line";
  }
  switch (kind) {
    case "matched":
      return "bg-success-soft text-success ring-1 ring-success-line";
    case "missing":
      return "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]";
    case "supporting":
      return "bg-brand-soft text-brand-deeper ring-1 ring-brand-muted";
  }
}

type ScoringView = { scoring: RiskScoringBreakdown; legacy: boolean };

/** Default weights / bands for older saved results without a scoring breakdown. */
const LEGACY_WEIGHTS = { fundamental: 0.3, core: 0.5, historical: 0.2 } as const;
const LEGACY_BANDS = { noRisk: 85, low: 75, medium: 50 } as const;

function scoringOf(risk: RiskAssessmentResult): ScoringView {
  if (risk.scoring) return { scoring: risk.scoring, legacy: false };
  const vocational = risk.assessmentFlow === "vocational_units";
  const components: RiskComponentScore[] = [
    {
      key: "fundamental",
      label: vocational ? "Electives" : "Fundamental subjects",
      pct: vocational ? null : risk.fundamentalPct,
      weight: LEGACY_WEIGHTS.fundamental,
      appliedWeight: vocational ? 0 : LEGACY_WEIGHTS.fundamental,
      used: !vocational,
    },
    {
      key: "core",
      label: vocational ? "Core units" : "Core subjects",
      pct: risk.corePct,
      weight: LEGACY_WEIGHTS.core,
      appliedWeight: LEGACY_WEIGHTS.core,
      used: true,
    },
    {
      key: "historical",
      label: "Historical outcomes",
      pct: risk.historical.totalCases > 0 ? risk.historicalPct : null,
      weight: LEGACY_WEIGHTS.historical,
      appliedWeight: LEGACY_WEIGHTS.historical,
      used: risk.historical.totalCases > 0,
    },
  ];
  return {
    legacy: true,
    scoring: {
      configVersion: "legacy",
      components,
      overallPct: risk.overallPct,
      riskLevel: risk.riskLevel,
      bands: { ...LEGACY_BANDS },
      historicalMinCases: 0,
      renormalised: false,
      notes: [],
    },
  };
}

function weightText(w: number): string {
  return `${Math.round(w * 1000) / 10}%`;
}

function ComponentTile({
  component: c,
  risk,
  legacy,
}: {
  component: RiskComponentScore;
  risk: RiskAssessmentResult;
  legacy: boolean;
}) {
  const hist = risk.historical;
  const weight =
    !c.used
      ? "Not used"
      : !legacy && c.appliedWeight !== c.weight
        ? `Weight ${weightText(c.weight)} → ${weightText(c.appliedWeight)}`
        : `Weight ${weightText(c.weight)}`;
  return (
    <section
      className={`rounded-2xl border border-line px-4 py-3.5 ${c.used ? "bg-surface/95" : "bg-surface-tint"}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {c.label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${c.used ? "text-ink" : "text-ink-faint"}`}
      >
        {c.pct == null ? "—" : formatPct(c.pct)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.used ? "bg-brand-soft text-brand-deeper" : "bg-surface text-ink-muted ring-1 ring-line"}`}
        >
          {weight}
        </span>
        {c.key === "historical" && hist.totalCases > 0 ? (
          <span className="text-[11px] tabular-nums text-ink-muted">
            {hist.positive}/{hist.totalCases} positive
          </span>
        ) : null}
      </div>
      {!c.used && c.reason ? (
        <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{c.reason}</p>
      ) : null}
    </section>
  );
}

function below(n: number): number {
  return Math.round((n - 0.1) * 10) / 10;
}

function bandRows(bands: RiskScoringBreakdown["bands"]): Array<{ level: RiskLevel; range: string }> {
  return [
    { level: "no_risk", range: `≥ ${bands.noRisk}%` },
    { level: "low", range: `${bands.low}–${below(bands.noRisk)}%` },
    { level: "medium", range: `${bands.medium}–${below(bands.low)}%` },
    { level: "high", range: `< ${bands.medium}%` },
  ];
}

/** Formula, risk-band thresholds and notes behind the overall score. */
function ScoreBreakdownCard({
  scoring,
  legacy,
  riskLevel,
  notes,
}: {
  scoring: RiskScoringBreakdown;
  legacy: boolean;
  riskLevel: RiskLevel;
  notes: string[];
}) {
  const used = scoring.components.filter((c) => c.used && c.pct != null);
  return (
    <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Overall score
      </p>
      {legacy ? (
        <p className="mt-1.5 text-sm leading-snug text-ink">
          Saved with the earlier rating method. Re-run risk to apply the weighted score.
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          {used.map((c, i) => (
            <span key={c.key}>
              {i > 0 ? " + " : ""}
              <span className="tabular-nums">
                {weightText(c.appliedWeight)} × {formatPct(c.pct as number)}
              </span>
              <span className="text-ink-muted"> {c.label.toLowerCase()}</span>
            </span>
          ))}
          {" = "}
          <span className="font-semibold tabular-nums">{formatPct(scoring.overallPct)}</span>
        </p>
      )}
      <ul className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-4">
        {bandRows(scoring.bands).map((row) => {
          const b = riskBadge(row.level);
          const active = row.level === riskLevel;
          return (
            <li
              key={row.level}
              className={`rounded-xl px-3 py-2 ${active ? b.className : "border border-line bg-surface text-ink-muted"}`}
            >
              <p className="text-xs font-semibold">{b.label}</p>
              <p className="mt-0.5 text-[11px] tabular-nums">{row.range}</p>
            </li>
          );
        })}
      </ul>
      {notes.length ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {notes.map((n) => (
            <li key={n} className="text-sm leading-snug text-ink-muted">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DomainCountCard({ source }: { source: DomainSource | null }) {
  const rows = useMemo(() => buildDomainRows(source), [source]);

  return (
    <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Domains used in count
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Major subjects drive the score; supporting subjects never reduce it.
          </p>
        </div>
      </div>
      {!source ? (
        <p className="mt-2 text-xs text-ink-muted">
          Subject match details are unavailable for this occupation — re-run the
          assessment to populate counts.
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((row) => {
          const count = row.subjects.length;
          return (
            <li key={row.key} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-ink">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                    {row.tierLabel} · {row.scored ? "Scored" : "Not scored"}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${domainCountClass(row.kind, count)}`}
                >
                  {row.denominator != null && row.denominator > 0
                    ? `${count} / ${row.denominator}`
                    : count}
                </span>
              </div>
              {count > 0 ? (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {row.subjects.join(", ")}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-ink-faint">None</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Step4Risk({
  risk,
  assessment,
  loading,
  error,
  competenceBusy,
  selectedLevels,
  qualifications,
  onBack,
  onRetry,
  onCompetenceChange,
  onContinue,
}: {
  risk: RiskAssessmentResult | null;
  /** Step 3 assessment — used to derive per-domain match counts for the chosen ANZSCO. */
  assessment?: AssessmentResult | null;
  loading: boolean;
  error: string | null;
  competenceBusy?: boolean;
  selectedLevels: DegreeLevel[];
  qualifications: Partial<
    Record<
      DegreeLevel,
      {
        degreeTitle: string | null;
        institution: string | null;
        country: string | null;
        durationYears: number | null;
      }
    >
  >;
  onBack: () => void;
  onRetry: () => void;
  onCompetenceChange: (competence: Competence) => void;
  /** Go to Step 5 (final review). Only enabled once a risk result exists. */
  onContinue?: () => void;
}) {
  const badge = risk ? riskBadge(risk.riskLevel) : null;
  const scoringView = risk ? scoringOf(risk) : null;
  const precedent = risk?.precedent ?? emptyPrecedent();
  const degreeBlocks = useMemo(
    () => buildConfirmationQualifications(selectedLevels, qualifications),
    [selectedLevels, qualifications],
  );
  // Gate 1 not eligible / manual review: no scores, so no score-based risk.
  const gate = assessment?.gate1 ?? null;
  const gateBlocked = Boolean(gate && gate.result !== "open");
  const riskAnzsco = risk?.anzscoCode ?? "";
  const domainSource = useMemo(
    () => resolveDomainSource(assessment, riskAnzsco),
    [assessment, riskAnzsco],
  );

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Risk analysis
        </h1>
      </header>

      {gate && gateBlocked ? (
        <section
          aria-label="Gate 1 result"
          className="mb-5 rounded-2xl border border-line bg-surface-tint p-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Gate 1 · {gate.result === "not_eligible" ? "Not eligible" : "Manual review"}
          </p>
          <p className="mt-1.5 text-sm font-medium leading-snug text-ink">{gate.reason}</p>
          <p className="mt-1 text-sm text-ink-muted">
            No occupation was scored, so there is no score-based risk for this case.
          </p>
        </section>
      ) : null}

      {loading && !gateBlocked ? (
        <div className="rounded-2xl border border-line bg-surface/95 p-8 text-center">
          <p className="text-sm font-medium text-ink">Calculating risk…</p>
          <p className="mt-2 text-xs text-ink-muted">
            Scoring subject coverage and historical cases.
          </p>
        </div>
      ) : null}

      {error && !loading && !gateBlocked ? (
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

      {risk && scoringView && !loading && !gateBlocked ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Selected occupation
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {risk.title}
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  ANZSCO {risk.anzscoCode}
                </p>
              </div>
              {badge ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Overall alignment score
                </p>
                <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatPct(risk.overallPct)}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            {scoringView.scoring.components.map((c) => (
              <ComponentTile key={c.key} component={c} risk={risk} legacy={scoringView.legacy} />
            ))}
          </div>

          <PrecedentCheckCard
            precedent={precedent}
            qualifications={degreeBlocks}
          />

          <ScoreBreakdownCard
            scoring={scoringView.scoring}
            legacy={scoringView.legacy}
            riskLevel={risk.riskLevel}
            notes={risk.riskNotes ?? []}
          />

          <DomainCountCard source={domainSource} />

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Reducing risk
              </p>
              <ul className="mt-2 space-y-1.5">
                {risk.reducingRisk.map((line) => (
                  <li
                    key={line}
                    className="text-sm leading-snug text-ink"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Increasing risk
              </p>
              <ul className="mt-2 space-y-1.5">
                {risk.increasingRisk.map((line) => (
                  <li
                    key={line}
                    className="text-sm leading-snug text-ink"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-2xl border border-dashed border-line-strong bg-surface-tint px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Missing major domains
            </p>
            <p className="mt-1.5 text-sm leading-snug text-ink">
              {risk.missingMajorDomains}
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Competence
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  {risk.competenceSource === "manual"
                    ? "Manually set"
                    : "AI suggestion — you can change it"}
                </p>
              </div>
              <div className="inline-flex rounded-full border border-line bg-surface-subtle p-1">
                {(
                  [
                    ["competent", "Competent"],
                    ["not_competent", "Not competent"],
                  ] as const
                ).map(([value, label]) => {
                  const active = risk.competence === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={competenceBusy}
                      onClick={() => onCompetenceChange(value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-brand text-white"
                          : "text-ink-muted hover:text-ink"
                      } disabled:opacity-60`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {risk.competenceConflict && risk.competenceSource !== "manual" ? (
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink">
                The competence suggestion differs from the {riskBadge(risk.riskLevel).label.toLowerCase()} rating.
                The rating stands — please review and set competence.
              </p>
            ) : null}
            {risk.insight ? (
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-muted">
                {risk.insight}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {risk && !loading && !gateBlocked ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
            >
              Re-run risk
            </button>
          ) : null}
          {onContinue ? (
            <button
              type="button"
              disabled={!risk || loading || competenceBusy || gateBlocked}
              onClick={onContinue}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
