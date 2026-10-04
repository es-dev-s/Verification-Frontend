"use client";

import type { ExperienceRow } from "@/lib/types";
import {
  buildConfirmationQualifications,
  isEngineeringRelatedChecked,
  type ConfirmationQualification,
} from "@/lib/wizard";
import type { DegreeLevel } from "@/lib/types";

export function Step2Confirmation({
  selectedLevels,
  qualifications,
  experience,
  engineeringTitledDegree,
  saveMsg,
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
  onEngineeringTitledChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  nextBusy?: boolean;
}) {
  const blocks: ConfirmationQualification[] = buildConfirmationQualifications(
    selectedLevels,
    qualifications,
  );

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Confirmation
        </h2>
        <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-ink-muted">
          Review the details captured in Step 1. To change any autofilled values,
          go back — only the engineering-titled degree question is editable here.
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
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

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
          disabled={nextBusy}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] disabled:opacity-60 hover:bg-brand-dark"
        >
          {nextBusy ? "Assessing…" : "Next"}
        </button>
      </div>
    </div>
  );
}
