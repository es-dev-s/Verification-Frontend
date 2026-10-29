"use client";

import { useState } from "react";
import {
  AWARD_LEVEL_OPTIONS,
  awardOptionLabel,
  type AwardLevel,
  type ExperienceRow,
  type QualificationTranscriptSummary,
  type TranscriptDataSummary,
} from "@/lib/types";
import {
  buildConfirmationQualifications,
  isEngineeringRelatedChecked,
  type ConfirmationQualification,
} from "@/lib/wizard";
import type { DegreeLevel } from "@/lib/types";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING, Spinner } from "./UploadTile";
import { DurationStatusPill, formatYears } from "./transcriptUi";

/** Correction from the duration check; undefined = unchanged, null = clear. */
export type DurationCorrection = {
  statedYears?: number | null;
  countedYears?: number | null;
  award?: AwardLevel | null;
};

export function Step2Confirmation({
  selectedLevels,
  qualifications,
  experience,
  engineeringTitledDegree,
  saveMsg,
  transcriptData,
  transcriptLoading,
  transcriptError,
  onRetryTranscriptData,
  onCorrect,
  onEngineeringTitledChange,
  onBack,
  onNext,
  nextBusy,
}: {
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
  saveMsg: string | null;
  transcriptData: TranscriptDataSummary | null;
  transcriptLoading: boolean;
  transcriptError: string | null;
  onRetryTranscriptData: () => void;
  onCorrect: (degreeLevel: DegreeLevel, correction: DurationCorrection) => Promise<void>;
  onEngineeringTitledChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  nextBusy?: boolean;
}) {
  const blocks: ConfirmationQualification[] = buildConfirmationQualifications(
    selectedLevels,
    qualifications,
  );
  const summaryFor = (level: DegreeLevel) =>
    transcriptData?.qualifications.find((q) => q.degreeLevel === level) ?? null;
  const canContinue = Boolean(transcriptData?.durationOk) && !transcriptLoading;

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Verify details
        </h2>
        <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-ink-muted">
          Review the details captured in Steps 1 and 2. To change other values,
          go back — the duration check and the engineering-titled degree question
          can be answered here.
        </p>
        {saveMsg ? (
          <p className="mt-2 text-sm text-brand">{saveMsg}</p>
        ) : null}
      </header>

      <section className="mb-5 rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
        <h3 className="mb-4 text-base font-semibold text-ink">
          Qualifications
        </h3>
        {!blocks.length ? (
          <p className="text-sm text-ink-muted">No degree levels selected.</p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <div
                key={block.degreeLevel}
                className="rounded-xl border border-line bg-surface-subtle px-4 py-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {block.label}
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Degree title</dt>
                    <dd className="font-medium text-ink">
                      {block.degreeTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Institution</dt>
                    <dd className="font-medium text-ink">
                      {block.institution}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Country</dt>
                    <dd className="font-medium text-ink">{block.country}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Duration (years)</dt>
                    <dd className="font-medium text-ink">
                      {block.durationYears}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Award level</dt>
                    <dd className="font-medium text-ink">
                      {summaryFor(block.degreeLevel)
                        ? awardOptionLabel(summaryFor(block.degreeLevel)!.award)
                        : "—"}
                      {summaryFor(block.degreeLevel)?.awardManual ? (
                        <span className="ml-1.5 text-xs font-normal text-ink-muted">(set manually)</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Field of study</dt>
                    <dd className="font-medium text-ink">
                      {summaryFor(block.degreeLevel)?.fieldOfStudy?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <DurationCheckSection
        selectedLevels={blocks.map((b) => b.degreeLevel)}
        data={transcriptData}
        loading={transcriptLoading}
        error={transcriptError}
        onRetry={onRetryTranscriptData}
        onCorrect={onCorrect}
      />

      <section className="mb-5 rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
        <h3 className="mb-4 text-base font-semibold text-ink">
          Work experience
        </h3>
        <div className="space-y-3">
          {experience.map((row, index) => (
            <div
              key={row.id ?? index}
              className="rounded-xl border border-line bg-surface-subtle px-4 py-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Role {index + 1}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Employer</dt>
                  <dd className="font-medium text-ink">
                    {(row.employer || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Title</dt>
                  <dd className="font-medium text-ink">
                    {(row.title || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Start</dt>
                  <dd className="font-medium text-ink">
                    {(row.start || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">End</dt>
                  <dd className="font-medium text-ink">
                    {(row.end || "").trim() || "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-ink">
                Engineering-related role:{" "}
                <span className="font-medium">
                  {isEngineeringRelatedChecked(row) ? "Yes" : "No"}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border-2 border-brand/35 bg-brand-soft p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
        <h3 className="text-base font-semibold text-ink">
          Engineering-titled degree
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Separate from the per-role engineering checkboxes above. Answer for the
          case overall — not set by AI.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand"
            checked={engineeringTitledDegree === true}
            onChange={(e) => onEngineeringTitledChange(e.target.checked)}
          />
          <span className="text-sm font-medium text-ink">
            Is this an engineering-titled degree?
          </span>
        </label>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextBusy || !canContinue}
          title={canContinue ? undefined : "Resolve the duration check first"}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] disabled:opacity-60 hover:bg-brand-dark"
        >
          {nextBusy ? "Assessing…" : "Continue to ANZSCO assessment"}
        </button>
      </div>
    </div>
  );
}

function DurationCheckSection({
  selectedLevels,
  data,
  loading,
  error,
  onRetry,
  onCorrect,
}: {
  selectedLevels: DegreeLevel[];
  data: TranscriptDataSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCorrect: (degreeLevel: DegreeLevel, correction: DurationCorrection) => Promise<void>;
}) {
  const rows = (data?.qualifications ?? []).filter((q) => selectedLevels.includes(q.degreeLevel));
  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">Duration check</h3>
        {data && !loading ? (
          <span className="text-xs text-ink-muted">
            Tolerance ±{formatYears(data.toleranceYears)}
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-ink-muted">
        The duration counted from the transcript must match the stated duration
        before the ANZSCO assessment.
      </p>
      {loading ? (
        <p className="flex items-center gap-2.5 text-sm text-ink-muted">
          <Spinner />
          Checking durations…
        </p>
      ) : error ? (
        <div>
          <p role="alert" className="text-sm text-[#b45309]">{error}</p>
          <button type="button" className={`mt-3 ${BTN_SECONDARY}`} onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !rows.length ? (
        <p className="text-sm text-ink-muted">No qualifications to check.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((q) => (
            <DurationCheckRow key={q.degreeLevel} q={q} onCorrect={(c) => onCorrect(q.degreeLevel, c)} />
          ))}
        </div>
      )}
    </section>
  );
}

const INPUT = `w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 ${FOCUS_RING}`;

function DurationCheckRow({
  q,
  onCorrect,
}: {
  q: QualificationTranscriptSummary;
  onCorrect: (correction: DurationCorrection) => Promise<void>;
}) {
  const check = q.durationCheck;
  const needsReview = !check.ok;
  const [open, setOpen] = useState(false);
  const showForm = needsReview || open;
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        needsReview ? "border-[#fdba74] bg-[#fffaf3]" : "border-line bg-surface-subtle"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {q.title?.trim() || q.degreeLevel}
        </p>
        <DurationStatusPill status={check.status} />
      </div>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Stated</dt>
          <dd className="font-medium text-ink">{formatYears(q.statedYears)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">
            Counted{q.overrides.countedYears != null ? " (entered manually)" : ""}
          </dt>
          <dd className="font-medium text-ink">{formatYears(q.effective.countedYears)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Difference</dt>
          <dd className="font-medium text-ink">
            {check.differenceYears == null ? "—" : formatYears(check.differenceYears)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{check.message}</p>
      {showForm ? (
        <CorrectionForm
          q={q}
          onCancel={needsReview ? undefined : () => setOpen(false)}
          onSave={async (c) => {
            await onCorrect(c);
            setOpen(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-brand hover:text-brand-dark"
          onClick={() => setOpen(true)}
        >
          Correct values
        </button>
      )}
    </div>
  );
}

function CorrectionForm({
  q,
  onCancel,
  onSave,
}: {
  q: QualificationTranscriptSummary;
  onCancel?: () => void;
  onSave: (c: DurationCorrection) => Promise<void>;
}) {
  const text = (n: number | null) => (n == null ? "" : String(Math.round(n * 100) / 100));
  const [stated, setStated] = useState(text(q.statedYears));
  const [counted, setCounted] = useState(text(q.effective.countedYears));
  const [award, setAward] = useState<string>(q.awardManual ? q.award : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function years(value: string, label: string): number | null {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0.5 || n > 12) throw new Error(`${label} must be between 0.5 and 12 years.`);
    return Math.round(n * 100) / 100;
  }

  async function submit() {
    setError(null);
    const c: DurationCorrection = {};
    try {
      const s = years(stated, "Stated duration");
      if (s !== q.statedYears) c.statedYears = s;
      const n = years(counted, "Counted duration");
      if (n !== q.effective.countedYears) {
        // Back to the transcript value clears the manual entry.
        c.countedYears = n != null && n === q.transcript.countedYears ? null : n;
      }
      const a = (award || null) as AwardLevel | null;
      if (a !== (q.awardManual ? q.award : null)) c.award = a;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setBusy(true);
    try {
      await onSave(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-3 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Stated duration (years)</span>
          <input className={INPUT} inputMode="decimal" value={stated} onChange={(e) => setStated(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Counted duration (years)</span>
          <input className={INPUT} inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <span className="mt-1 block text-xs text-ink-muted">
            From transcript: {formatYears(q.transcript.countedYears)}
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Award level</span>
          <select className={INPUT} value={award} onChange={(e) => setAward(e.target.value)}>
            <option value="">Detect from title ({awardOptionLabel(q.detectedAward)})</option>
            {AWARD_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-[#b45309]">{error}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        {onCancel ? (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>
          {busy ? "Checking…" : "Save and re-check"}
        </button>
      </div>
    </form>
  );
}
