"use client";

import { useMemo } from "react";
import type {
  AssessmentResult,
  DegreeLevel,
  ExperienceRow,
  RiskAssessmentResult,
} from "@/lib/types";
import {
  buildConfirmationQualifications,
  isEngineeringRelatedChecked,
} from "@/lib/wizard";
import {
  competenceLabel,
  determinationText,
  formatPct,
  precedentRiskBadge,
  resolveAssessmentSummary,
  riskBadge,
  riskBandRange,
  type AssessmentSummary,
} from "@/lib/riskDisplay";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const CARD = "rounded-2xl border border-line bg-surface/95 px-4 py-4 sm:px-5";

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <p className={LABEL}>{title}</p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-ink-muted">{text}</p>;
}

function DetailItem({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-sm text-ink ${
          emphasis ? "font-semibold" : "font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-tint px-3 py-2.5">
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

function coverage(matched: number, expected: number, pct: number): string {
  if (!expected) return `${matched} matched`;
  return `${matched} / ${expected} · ${formatPct(pct)}`;
}

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function competenceClass(competent: boolean): string {
  return competent
    ? "bg-success-soft text-success ring-1 ring-success-line"
    : "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]";
}

/** Build the overall review sentences strictly from data already on screen. */
function buildOverallReview(
  occupation: { code: string; title: string } | null,
  risk: RiskAssessmentResult | null,
  summary: AssessmentSummary | null,
): string[] {
  const lines: string[] = [];
  const name = occupation
    ? `${occupation.title} (ANZSCO ${occupation.code})`
    : "The selected occupation";

  if (risk) {
    lines.push(
      `${name} is rated ${riskBadge(risk.riskLevel).label.toLowerCase()} with ${formatPct(risk.overallPct)} overall alignment (${riskBandRange(risk.riskLevel)} band).`,
    );
  } else if (occupation) {
    lines.push(`${name} has no risk result yet — run Step 4 to complete the review.`);
  }

  if (summary) {
    const det = determinationText(summary.determination);
    lines.push(
      `Subject matching covered ${coverage(summary.foundationalMatched, summary.foundationalExpected, summary.foundationalPct)} foundational and ${coverage(summary.coreMatched, summary.coreExpected, summary.corePct)} core subjects${det ? `, with a determination of ${det.toLowerCase()}` : ""}.`,
    );
  } else if (risk) {
    lines.push(
      `Fundamentals scored ${formatPct(risk.fundamentalPct)} and core subjects ${formatPct(risk.corePct)}.`,
    );
  }

  if (risk) {
    const p = risk.precedent;
    if (p && p.matchingCases > 0) {
      lines.push(
        `${p.matchingCases} matching past case${p.matchingCases === 1 ? "" : "s"} show a ${formatPct(p.positiveOutcomeRate)} positive outcome rate${p.overallRisk ? `, mostly ${precedentRiskBadge(p.overallRisk).label.toLowerCase()}` : ""}.`,
      );
    } else {
      lines.push("No matching past cases were found for this occupation.");
    }
    if (risk.workExperienceBoost && risk.workExperienceDelta > 0) {
      lines.push(
        `Related work experience added ${risk.workExperienceDelta} pts (from ${formatPct(risk.overallPctBeforeWork)}).`,
      );
    }
    lines.push(
      `Competency outcome: ${competenceLabel(risk.competence)} (${risk.competenceSource === "manual" ? "manually set" : "AI suggestion"}).`,
    );
  }
  return lines;
}

export function Step5FinalReview({
  risk,
  assessment,
  selectedAnzsco,
  selectedLevels,
  qualifications,
  experience,
  engineeringTitledDegree,
  onBack,
  onContinue,
}: {
  risk: RiskAssessmentResult | null;
  assessment: AssessmentResult | null;
  selectedAnzsco: { anzscoCode: string; title: string } | null;
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
  experience: ExperienceRow[];
  engineeringTitledDegree: boolean | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const occupation = useMemo(() => {
    const code = risk?.anzscoCode || selectedAnzsco?.anzscoCode || "";
    const title = risk?.title || selectedAnzsco?.title || "";
    return code || title ? { code: code || "—", title: title || "—" } : null;
  }, [risk, selectedAnzsco]);

  const summary = useMemo(
    () => resolveAssessmentSummary(assessment, occupation?.code),
    [assessment, occupation],
  );

  const degreeBlocks = useMemo(
    () => buildConfirmationQualifications(selectedLevels, qualifications),
    [selectedLevels, qualifications],
  );

  const roles = useMemo(
    () =>
      experience.filter(
        (r) =>
          (r.employer ?? "").trim() ||
          (r.title ?? "").trim() ||
          (r.start ?? "").trim() ||
          (r.end ?? "").trim(),
      ),
    [experience],
  );

  const overallLines = useMemo(
    () => buildOverallReview(occupation, risk, summary),
    [occupation, risk, summary],
  );

  const badge = risk ? riskBadge(risk.riskLevel) : null;
  const precedent = risk?.precedent ?? null;
  const precedentBadge = precedent?.overallRisk
    ? precedentRiskBadge(precedent.overallRisk)
    : null;
  const competent = risk?.competence === "competent";
  const determination = determinationText(summary?.determination);

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Final review
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          Read through every detail below and verify it before continuing. This
          page is read-only — go back to a previous step to make changes.
        </p>
      </header>

      <div className="space-y-4">
        {/* Hero — nominated occupation */}
        <section className="rounded-2xl border border-brand-muted bg-brand-soft p-5 shadow-[0_8px_24px_rgba(146,86,169,0.12)] sm:p-6">
          {occupation ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deeper">
                  Nominated occupation
                </p>
                <div className="mt-3 inline-flex items-baseline gap-2 rounded-xl bg-surface px-3.5 py-2 ring-1 ring-brand-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
                    ANZSCO
                  </span>
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-brand-deeper sm:text-4xl">
                    {occupation.code}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
                  {occupation.title}
                </h2>
              </div>
              {risk ? (
                <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:flex-col sm:items-end">
                  {badge ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${competenceClass(competent)}`}
                  >
                    {competenceLabel(risk.competence)}
                  </span>
                  <span className="text-xs tabular-nums text-ink-muted sm:pt-1">
                    {formatPct(risk.overallPct)} overall alignment
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deeper">
                Nominated occupation
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                No occupation selected yet — confirm one in Step 3.
              </p>
            </div>
          )}
        </section>

        {/* Applicant details */}
        <section className={CARD}>
          <SectionHeader
            title="Qualifications"
            hint="Education details confirmed in Steps 1–2"
          />
          {degreeBlocks.length ? (
            <div className="space-y-3">
              {degreeBlocks.map((block) => (
                <div
                  key={block.degreeLevel}
                  className="rounded-xl border border-line bg-surface px-3.5 py-3"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {block.label}
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem label="Degree title" value={block.degreeTitle} emphasis />
                    <DetailItem label="Institution" value={block.institution} />
                    <DetailItem label="Country" value={block.country} />
                    <DetailItem label="Duration (years)" value={block.durationYears} />
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote text="No degree levels were selected in Step 1." />
          )}
          <dl className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            <DetailItem
              label="Engineering-titled degree"
              value={yesNo(engineeringTitledDegree)}
            />
          </dl>
        </section>

        <section className={CARD}>
          <SectionHeader title="Work experience" hint="Roles entered in Step 1" />
          {roles.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {roles.map((row, i) => {
                const related = isEngineeringRelatedChecked(row);
                const period = [row.start, row.end]
                  .map((v) => (v ?? "").trim())
                  .filter(Boolean)
                  .join(" – ");
                return (
                  <li
                    key={row.id ?? `role-${i}`}
                    className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {(row.title ?? "").trim() || "Untitled role"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {(row.employer ?? "").trim() || "Employer not set"}
                        {period ? ` · ${period}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        related
                          ? "bg-success-soft text-success ring-1 ring-success-line"
                          : "bg-surface-tint text-ink-muted ring-1 ring-line"
                      }`}
                    >
                      {related ? "Engineering-related" : "Not engineering"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyNote text="No work experience was entered." />
          )}
        </section>

        {/* Step 3 — assessment */}
        <section className={CARD}>
          <SectionHeader
            title="Assessment summary"
            hint="ANZSCO subject matching from Step 3 for the nominated occupation"
          />
          {summary ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile
                  label="Foundational"
                  value={coverage(
                    summary.foundationalMatched,
                    summary.foundationalExpected,
                    summary.foundationalPct,
                  )}
                  hint="Tier 1 subjects"
                />
                <MetricTile
                  label="Core"
                  value={coverage(
                    summary.coreMatched,
                    summary.coreExpected,
                    summary.corePct,
                  )}
                  hint="Tier 2 subjects"
                />
                <MetricTile
                  label="Confidence"
                  value={
                    summary.confidenceScore != null
                      ? `${Math.round(summary.confidenceScore)}%`
                      : summary.confidence
                        ? summary.confidence[0]!.toUpperCase() +
                          summary.confidence.slice(1)
                        : "—"
                  }
                  hint={
                    summary.confidenceScore != null && summary.confidence
                      ? `${summary.confidence} confidence`
                      : undefined
                  }
                />
                <MetricTile
                  label="Determination"
                  value={determination ?? "—"}
                />
              </div>
              <dl className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
                <DetailItem label="Recommended" value={yesNo(summary.recommended)} />
                <DetailItem
                  label="Capstone gate (Tier 3)"
                  value={summary.tier3GateMet ? "Met" : "Not met"}
                />
                <DetailItem
                  label="Work experience boost"
                  value={yesNo(summary.workExperienceBoost)}
                />
              </dl>
              {summary.workExperienceAnalysis ? (
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  {summary.workExperienceAnalysis}
                </p>
              ) : null}
            </>
          ) : (
            <EmptyNote
              text={
                assessment
                  ? "No Step 3 figures were found for this occupation."
                  : "Assessment has not been run yet."
              }
            />
          )}
        </section>

        {/* Step 4 — risk */}
        <section className={CARD}>
          <SectionHeader
            title="Risk assessment"
            hint="Alignment score and risk level from Step 4"
          />
          {risk ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Overall alignment
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-ink">
                    {formatPct(risk.overallPct)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {risk.workExperienceBoost && risk.workExperienceDelta > 0
                      ? `Includes +${risk.workExperienceDelta} pts work experience (from ${formatPct(risk.overallPctBeforeWork)})`
                      : "No related work experience boost"}
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

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MetricTile
                  label="Fundamentals"
                  value={formatPct(risk.fundamentalPct)}
                  hint="30% weight"
                />
                <MetricTile
                  label="Core"
                  value={formatPct(risk.corePct)}
                  hint="50% weight"
                />
                <MetricTile
                  label="Historical"
                  value={formatPct(risk.historicalPct)}
                  hint={
                    risk.historical.totalCases > 0
                      ? `${risk.historical.positive}/${risk.historical.totalCases} positive · 20% weight`
                      : "No cases · 20% weight"
                  }
                />
              </div>

              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Precedent check
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricTile
                    label="Matching cases"
                    value={String(precedent?.matchingCases ?? 0)}
                  />
                  <MetricTile
                    label="Positive outcome rate"
                    value={
                      precedent && precedent.matchingCases > 0
                        ? formatPct(precedent.positiveOutcomeRate)
                        : "—"
                    }
                  />
                  <div className="rounded-xl bg-surface-tint px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Overall precedent risk
                    </p>
                    <div className="mt-1.5">
                      {precedentBadge ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${precedentBadge.className}`}
                        >
                          {precedentBadge.label}
                        </span>
                      ) : (
                        <span className="text-lg font-semibold text-ink-faint">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Reducing risk
                  </p>
                  {risk.reducingRisk.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {risk.reducingRisk.map((line, i) => (
                        <li
                          key={`reduce-${i}`}
                          className="flex gap-2 text-sm leading-snug text-ink"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-faint">None listed</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Increasing risk
                  </p>
                  {risk.increasingRisk.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {risk.increasingRisk.map((line, i) => (
                        <li
                          key={`increase-${i}`}
                          className="flex gap-2 text-sm leading-snug text-ink"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8a3a3a]"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-faint">None listed</p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-line-strong bg-surface-tint px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Missing major domains
                </p>
                <p className="mt-1 text-sm leading-snug text-ink">
                  {risk.missingMajorDomains?.trim() || "None"}
                </p>
              </div>

              {risk.insight ? (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Insight
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {risk.insight}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyNote text="Risk assessment has not been run yet — go back to Step 4." />
          )}
        </section>

        {/* Competency outcome */}
        <section className={CARD}>
          <SectionHeader title="Competency outcome" />
          {risk ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${competenceClass(competent)}`}
                >
                  {competent ? "✓" : "✕"}
                </span>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-ink">
                    {competenceLabel(risk.competence)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {risk.competenceSource === "manual"
                      ? "Manually set by you in Step 4"
                      : "AI suggestion — change it in Step 4 if needed"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface-tint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted ring-1 ring-line">
                {risk.competenceSource === "manual" ? "Manual" : "AI"}
              </span>
            </div>
          ) : (
            <EmptyNote text="No competency outcome yet." />
          )}
        </section>

        {/* Overall review */}
        <section className="rounded-2xl border border-line bg-surface-tint px-4 py-4 sm:px-5">
          <SectionHeader title="Overall review" />
          {overallLines.length ? (
            <ul className="space-y-2">
              {overallLines.map((line, i) => (
                <li
                  key={`overall-${i}`}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote text="Complete Steps 3 and 4 to generate the overall review." />
          )}
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] hover:bg-brand-dark"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
