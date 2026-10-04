"use client";

import type {
  Competence,
  RiskAssessmentResult,
  RiskLevel,
} from "@/lib/types";

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}%`;
}

function riskBadge(level: RiskLevel): {
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

function ScoreTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface/95 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {formatPct(value)}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">{hint}</p>
      ) : null}
    </section>
  );
}

export function Step4Risk({
  risk,
  loading,
  error,
  competenceBusy,
  onBack,
  onRetry,
  onCompetenceChange,
}: {
  risk: RiskAssessmentResult | null;
  loading: boolean;
  error: string | null;
  competenceBusy?: boolean;
  onBack: () => void;
  onRetry: () => void;
  onCompetenceChange: (competence: Competence) => void;
}) {
  const badge = risk ? riskBadge(risk.riskLevel) : null;

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Risk analysis
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          Alignment from fundamentals, core subjects, and historical outcomes.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface/95 p-8 text-center">
          <p className="text-sm font-medium text-ink">Calculating risk…</p>
          <p className="mt-2 text-xs text-ink-muted">
            Scoring subjects, historical cases, and work experience.
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

      {risk && !loading ? (
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
                  Overall alignment
                </p>
                <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatPct(risk.overallPct)}
                </p>
              </div>
              {risk.workExperienceBoost ? (
                <p className="pb-1 text-sm text-ink-muted">
                  Includes work experience{" "}
                  <span className="font-medium text-ink">
                    +{risk.workExperienceDelta} pts
                  </span>
                  {risk.overallPctBeforeWork !== risk.overallPct ? (
                    <span className="text-ink-faint">
                      {" "}
                      (from {formatPct(risk.overallPctBeforeWork)})
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="pb-1 text-sm text-ink-faint">
                  No related work experience boost
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreTile
              label="Fundamentals"
              value={risk.fundamentalPct}
              hint="30% weight"
            />
            <ScoreTile label="Core" value={risk.corePct} hint="50% weight" />
            <ScoreTile
              label="Historical"
              value={risk.historicalPct}
              hint={
                risk.historical.totalCases > 0
                  ? `${risk.historical.positive}/${risk.historical.totalCases} positive · 20% weight`
                  : "No cases · neutral 50% · 20% weight"
              }
            />
          </div>

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
        {risk && !loading ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
          >
            Re-run risk
          </button>
        ) : null}
      </div>
    </div>
  );
}
