"use client";

import { useState } from "react";
import {
  DEGREE_LEVEL_LABELS,
  type QualificationTranscriptSummary,
  type TranscriptDataSummary,
  type TranscriptOverrides,
} from "@/lib/types";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, FOCUS_RING, Spinner } from "./UploadTile";
import {
  DataTile,
  formatCountedDuration,
  formatCredits,
  formatShare,
  formatYears,
} from "./transcriptUi";

type OverridePatch = Partial<TranscriptOverrides>;

/**
 * Step 2 — transcript data. Reads the subjects from the transcripts (shown
 * in the ANZSCO step, not here) and summarises what the gate needs: counted
 * duration, credits, final-year project and engineering share. Every value
 * can be corrected; corrections are saved and used by the gate.
 */
export function Step2TranscriptData({
  data,
  loading,
  error,
  onReRead,
  onSaveOverrides,
  onBack,
  onNext,
}: {
  data: TranscriptDataSummary | null;
  loading: boolean;
  error: string | null;
  onReRead: () => void;
  onSaveOverrides: (degreeLevel: QualificationTranscriptSummary["degreeLevel"], patch: OverridePatch) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            Transcript data
          </h2>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
            Duration, credits and final-year project read from the transcripts.
            Correct any value that does not match the documents; the subjects
            themselves are shown in the ANZSCO assessment.
          </p>
        </div>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={loading || !data?.transcriptCount}
          onClick={onReRead}
        >
          Re-read transcripts
        </button>
      </header>

      {loading ? (
        <section className={CARD}>
          <p className="flex items-center gap-2.5 text-sm text-ink-muted">
            <Spinner />
            Reading transcripts…
          </p>
        </section>
      ) : error ? (
        <section className={CARD}>
          <p role="alert" className="text-sm text-[#b45309]">{error}</p>
          <button type="button" className={`mt-3 ${BTN_SECONDARY}`} onClick={onReRead}>
            Try again
          </button>
        </section>
      ) : data ? (
        <>
          <StatusLine data={data} />
          {data.qualifications.length ? (
            data.qualifications.map((q) => (
              <QualificationCard
                key={q.degreeLevel}
                q={q}
                onSave={(patch) => onSaveOverrides(q.degreeLevel, patch)}
              />
            ))
          ) : (
            <section className={CARD}>
              <p className="text-sm text-ink-muted">
                No qualifications yet. Fill in the education details in Upload &amp; details.
              </p>
            </section>
          )}
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
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
          disabled={loading}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] disabled:opacity-60 hover:bg-brand-dark"
        >
          Continue to verify details
        </button>
      </div>
    </div>
  );
}

function StatusLine({ data }: { data: TranscriptDataSummary }) {
  const parts = [
    `${data.transcriptCount} transcript${data.transcriptCount === 1 ? "" : "s"}`,
    `${data.subjectCount} subject${data.subjectCount === 1 ? "" : "s"} read`,
  ];
  return (
    <div className="mb-5">
      <p className="text-sm text-ink-muted">{parts.join(" · ")}</p>
      {data.message ? (
        <p className="mt-2 inline-flex rounded-lg bg-[#fff7ed] px-3 py-1.5 text-sm text-[#b45309] ring-1 ring-[#fdba74]/60">
          {data.message}
        </p>
      ) : null}
    </div>
  );
}

function QualificationCard({
  q,
  onSave,
}: {
  q: QualificationTranscriptSummary;
  onSave: (patch: OverridePatch) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const edited = Object.values(q.overrides).some((v) => v != null);
  const project = q.effective.finalProject;

  return (
    <section className={CARD}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {DEGREE_LEVEL_LABELS[q.degreeLevel] ?? q.degreeLevel}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">
            {q.title?.trim() || "Untitled qualification"}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {q.subjectCount} subject{q.subjectCount === 1 ? "" : "s"} on the transcript
            {edited ? " · includes values you edited" : ""}
          </p>
        </div>
        {!editing ? (
          <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(true)}>
            Edit values
          </button>
        ) : null}
      </div>

      {editing ? (
        <OverrideForm
          q={q}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => {
            await onSave(patch);
            setEditing(false);
          }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <DataTile
            label="Counted duration"
            value={formatCountedDuration(q)}
            tag={q.overrides.countedYears != null ? "Edited" : null}
            hint={
              q.fallback
                ? `Not counted from the transcript — the stated duration (${formatYears(q.statedYears)}) is used.`
                : q.basisLabel
            }
          />
          <DataTile
            label="Total credits"
            value={formatCredits(q.effective.creditTotal)}
            tag={q.overrides.creditTotal != null ? "Edited" : null}
            hint={q.effective.creditTotal == null ? "No credit values on the transcript." : undefined}
          />
          <DataTile
            label="Final-year project"
            value={project ? project.title : "None found"}
            tag={q.overrides.finalProject != null ? "Edited" : null}
            hint={
              project && q.overrides.finalProject == null
                ? project.term
                  ? `${project.term}${project.inFinalYear === false ? " · not in the final year" : ""}`
                  : undefined
                : !project
                  ? "No project or thesis subject found."
                  : undefined
            }
          />
          {q.showEngineeringShare ? (
            <DataTile
              label="Engineering subjects"
              value={formatShare(q.effective.engineeringShare)}
              tag={q.overrides.engineeringShare != null ? "Edited" : null}
              hint="Share of subjects that are engineering or engineering science."
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

const INPUT = `w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 ${FOCUS_RING}`;

function toText(n: number | null | undefined): string {
  return n == null ? "" : String(Math.round(n * 100) / 100);
}

function OverrideForm({
  q,
  onCancel,
  onSave,
}: {
  q: QualificationTranscriptSummary;
  onCancel: () => void;
  onSave: (patch: OverridePatch) => Promise<void>;
}) {
  const [years, setYears] = useState(toText(q.effective.countedYears));
  const [credits, setCredits] = useState(toText(q.effective.creditTotal));
  const [project, setProject] = useState(q.effective.finalProject?.title ?? "");
  const [share, setShare] = useState(
    q.effective.engineeringShare == null ? "" : String(Math.round(q.effective.engineeringShare * 100)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Empty or equal to the transcript value → null (use the transcript value). */
  function numberOverride(text: string, auto: number | null, min: number, max: number, label: string, scale = 1) {
    const t = text.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
    const value = n / scale;
    if (auto != null && Math.abs(value - auto) < 1e-6) return null;
    return value;
  }

  async function submit(patch?: OverridePatch) {
    setError(null);
    let body: OverridePatch;
    try {
      body = patch ?? {
        countedYears: numberOverride(years, q.transcript.countedYears, 0.5, 12, "Counted duration"),
        creditTotal: numberOverride(credits, q.transcript.creditTotal, 0, 10000, "Total credits"),
        finalProject:
          project.trim() && project.trim() !== (q.transcript.finalProject?.title ?? "") ? project.trim() : null,
        ...(q.showEngineeringShare
          ? { engineeringShare: numberOverride(share, q.transcript.engineeringShare, 0, 100, "Engineering subjects", 100) }
          : {}),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setBusy(true);
    try {
      await onSave(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const fromTranscript = (text: string) => (
    <span className="mt-1 block text-xs text-ink-muted">From transcript: {text}</span>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Counted duration (years)</span>
          <input className={INPUT} inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          {fromTranscript(formatYears(q.transcript.countedYears))}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Total credits</span>
          <input className={INPUT} inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} />
          {fromTranscript(formatCredits(q.transcript.creditTotal))}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Final-year project</span>
          <input className={INPUT} value={project} onChange={(e) => setProject(e.target.value)} />
          {fromTranscript(q.transcript.finalProject?.title ?? "none found")}
        </label>
        {q.showEngineeringShare ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Engineering subjects (%)</span>
            <input className={INPUT} inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} />
            {fromTranscript(formatShare(q.transcript.engineeringShare))}
          </label>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-[#b45309]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="mr-auto text-sm font-medium text-ink-muted hover:text-brand disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            void submit({
              countedYears: null,
              creditTotal: null,
              finalProject: null,
              ...(q.showEngineeringShare ? { engineeringShare: null } : {}),
            })
          }
        >
          Use transcript values
        </button>
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
