"use client";

import { useEffect, useMemo, useState } from "react";
import { listCareerEpisodes } from "@/lib/api";
import type {
  AssessmentResult,
  CareerEpisode,
  CaseDocument,
  MissingSubjectsByTier,
  RiskAssessmentResult,
} from "@/lib/types";
import {
  competenceLabel,
  determinationText,
  formatPct,
  normalizeAnzsco,
  resolveAssessmentSummary,
  riskBadge,
  type AssessmentSummary,
} from "@/lib/riskDisplay";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const CARD = "rounded-2xl border border-line bg-surface/95 px-4 py-4 sm:px-5";
const MAX_FIXES = 5;
/** OCR confidence (0–100) below this is flagged as a possible misread. */
const LOW_OCR_CONFIDENCE = 70;

type EpisodesState = CareerEpisode[] | "error" | null;

function CountTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-tint px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function listPreview(items: string[], max = 3): string {
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown} (+${items.length - max} more)` : shown;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Missing Tier 1 / Tier 2 subjects for the reported occupation (Step 3 data). */
function missingSubjectsFor(
  assessment: AssessmentResult | null,
  code: string | null | undefined,
): MissingSubjectsByTier | null {
  if (!assessment) return null;
  const key = normalizeAnzsco(code);
  if (!key) return null;
  const candidate = assessment.candidates?.find(
    (c) => normalizeAnzsco(c.anzscoCode) === key,
  );
  if (candidate) return candidate.missingSubjects ?? null;
  if (normalizeAnzsco(assessment.anzscoCode) === key) {
    return assessment.missingSubjects ?? null;
  }
  return null;
}

function hasAnyEvidence(ep: CareerEpisode): boolean {
  return Boolean(
    ep.hasCalculations ||
      ep.hasDrawingsCad ||
      ep.hasDataTables ||
      ep.hasSiteProductImages ||
      ep.hasStandardsReferenced ||
      ep.hasQuantifiableOutcomes,
  );
}

/** Short, ordered fix list built only from data already loaded in the wizard. */
function buildSuggestedFixes({
  documents,
  episodes,
  missing,
  risk,
}: {
  documents: CaseDocument[];
  episodes: EpisodesState;
  missing: MissingSubjectsByTier | null;
  risk: RiskAssessmentResult | null;
}): string[] {
  const fixes: string[] = [];

  if (!documents.some((d) => d.type === "CV")) {
    fixes.push("Upload the applicant's CV.");
  }
  if (!documents.some((d) => d.type === "TRANSCRIPT")) {
    fixes.push("Upload the academic transcript(s).");
  }
  const failed = documents.filter((d) => d.status === "FAILED");
  if (failed.length) {
    fixes.push(
      `Re-upload ${plural(failed.length, "document")} that failed to extract: ${listPreview(failed.map((d) => d.originalName), 2)}.`,
    );
  }

  if (missing?.tier1.length) {
    fixes.push(
      `Provide evidence for missing foundational subjects: ${listPreview(missing.tier1)}.`,
    );
  }
  if (missing?.tier2.length) {
    fixes.push(
      `Provide evidence for missing core subjects: ${listPreview(missing.tier2)}.`,
    );
  }

  for (const line of (risk?.increasingRisk ?? []).slice(0, 2)) {
    const text = line.trim();
    if (text) fixes.push(`Address: ${text.replace(/\.$/, "")}.`);
  }

  if (Array.isArray(episodes)) {
    if (!episodes.length) {
      fixes.push("Add at least one career episode or project.");
    } else {
      const unlinked = episodes.filter(
        (ep) => !ep.experienceRowId && !ep.experienceLabel,
      ).length;
      if (unlinked) {
        fixes.push(
          `Link ${plural(unlinked, "career episode")} to a CV work experience.`,
        );
      }
      const noEvidence = episodes.filter((ep) => !hasAnyEvidence(ep)).length;
      if (noEvidence) {
        fixes.push(
          `Tick the evidence included in ${plural(noEvidence, "career episode")}.`,
        );
      }
    }
  }

  const lowOcr = documents.filter(
    (d) =>
      d.status === "DONE" &&
      typeof d.ocrConfidence === "number" &&
      d.ocrConfidence < LOW_OCR_CONFIDENCE,
  );
  if (lowOcr.length) {
    fixes.push(
      `Check ${listPreview(lowOcr.map((d) => d.originalName), 2)} — low OCR confidence; a clearer scan may help.`,
    );
  }

  return fixes.slice(0, MAX_FIXES);
}

function confidenceText(summary: AssessmentSummary | null): string | null {
  if (!summary) return null;
  if (summary.confidenceScore != null) {
    return `${Math.round(summary.confidenceScore)}% confidence${summary.confidence ? ` (${summary.confidence})` : ""}`;
  }
  return summary.confidence ? `${summary.confidence} confidence` : null;
}

/**
 * Step 6 — final verification report. Read-only: it only reads the case data
 * already in the wizard plus the saved career-episode list.
 */
export function Step6VerificationReport({
  caseId,
  documents,
  risk,
  assessment,
  selectedAnzsco,
  onBack,
}: {
  caseId: string | null;
  documents: CaseDocument[];
  risk: RiskAssessmentResult | null;
  assessment: AssessmentResult | null;
  selectedAnzsco: { anzscoCode: string; title: string } | null;
  onBack: () => void;
}) {
  const [episodes, setEpisodes] = useState<EpisodesState>(null);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    listCareerEpisodes(caseId)
      .then((res) => {
        if (alive) setEpisodes(res.episodes);
      })
      .catch(() => {
        // e.g. career-episode migration not applied yet — show "—" instead.
        if (alive) setEpisodes("error");
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  const occupation = useMemo(() => {
    const code =
      risk?.anzscoCode || selectedAnzsco?.anzscoCode || assessment?.anzscoCode || "";
    const title = risk?.title || selectedAnzsco?.title || assessment?.title || "";
    return code || title ? { code: code || "—", title: title || "—" } : null;
  }, [risk, selectedAnzsco, assessment]);

  const summary = useMemo(
    () => resolveAssessmentSummary(assessment, occupation?.code),
    [assessment, occupation],
  );

  const missing = useMemo(
    () => missingSubjectsFor(assessment, occupation?.code),
    [assessment, occupation],
  );

  const fixes = useMemo(
    () => buildSuggestedFixes({ documents, episodes, missing, risk }),
    [documents, episodes, missing, risk],
  );

  const counts = useMemo(
    () => ({
      transcripts: documents.filter((d) => d.type === "TRANSCRIPT").length,
      cv: documents.filter((d) => d.type === "CV").length,
      certificates: documents.filter((d) => d.type === "CERTIFICATE").length,
    }),
    [documents],
  );

  const episodeCount = !caseId
    ? "—"
    : episodes === null
      ? "…"
      : episodes === "error"
        ? "—"
        : String(episodes.length);

  const badge = risk ? riskBadge(risk.riskLevel) : null;
  const determination = determinationText(summary?.determination);
  const confidence = confidenceText(summary);
  const detLine = [determination, confidence].filter(Boolean).join(" · ");
  const verdict =
    occupation && risk && badge
      ? `${competenceLabel(risk.competence)} — ${badge.label.toLowerCase()} for ${occupation.title} (${formatPct(risk.overallPct)} overall alignment).`
      : null;

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Final verification report
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          A short read-only summary of this case. Go back to a previous step to
          make changes.
        </p>
      </header>

      {!occupation && !risk ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface-tint px-5 py-10 text-center">
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-muted">
            No assessment or risk result yet. Complete Steps 3 and 4 to generate
            the verification report.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {/* Recommended occupation + risk */}
          <section className="rounded-2xl border border-brand-muted bg-brand-soft p-5 shadow-[0_8px_24px_rgba(146,86,169,0.12)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deeper">
                  Recommended ANZSCO
                </p>
                {occupation ? (
                  <>
                    <div className="mt-3 inline-flex items-baseline gap-2 rounded-xl bg-surface px-3.5 py-2 ring-1 ring-brand-muted">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
                        ANZSCO
                      </span>
                      <span className="text-3xl font-semibold tabular-nums tracking-tight text-brand-deeper">
                        {occupation.code}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-ink sm:text-2xl">
                      {occupation.title}
                    </h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      {detLine || "No determination available"}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">
                    No occupation selected yet — confirm one in Step 3.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deeper">
                  Overall risk
                </p>
                {risk && badge ? (
                  <>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                      {formatPct(risk.overallPct)}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      overall alignment
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-ink-muted">
                    Not assessed yet — run Step 4.
                  </span>
                )}
              </div>
            </div>
            {verdict ? (
              <p className="mt-4 border-t border-brand-muted pt-3 text-sm font-medium text-ink">
                {verdict}
              </p>
            ) : null}
          </section>

          {/* Documents */}
          <section className={CARD}>
            <p className={`${LABEL} mb-3`}>Documents added</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CountTile label="Transcripts" value={String(counts.transcripts)} />
              <CountTile label="CV" value={String(counts.cv)} />
              <CountTile label="Certificates" value={String(counts.certificates)} />
              <CountTile label="Career episodes" value={episodeCount} />
            </div>
          </section>

          {/* Suggested fixes */}
          <section className="rounded-2xl border border-line bg-surface-tint px-4 py-4 sm:px-5">
            <p className={`${LABEL} mb-3`}>Suggested fixes</p>
            {fixes.length ? (
              <ul className="space-y-2">
                {fixes.map((line, i) => (
                  <li
                    key={`fix-${i}`}
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
              <p className="text-sm text-ink-muted">No fixes suggested.</p>
            )}
          </section>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Print
        </button>
      </div>
    </div>
  );
}
