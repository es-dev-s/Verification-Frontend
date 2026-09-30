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
  onNextPlaceholder,
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
  onNextPlaceholder: () => void;
}) {
  const blocks: ConfirmationQualification[] = buildConfirmationQualifications(
    selectedLevels,
    qualifications,
  );

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[1.75rem] font-semibold tracking-tight text-[#1a2332]">
          Confirmation
        </h2>
        <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-[#6b7a8d]">
          Review the details captured in Step 1. To change any autofilled values,
          go back — only the engineering-titled degree question is editable here.
        </p>
        {saveMsg ? (
          <p className="mt-2 text-sm text-[#2c5f8a]">{saveMsg}</p>
        ) : null}
      </header>

      <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
        <h3 className="mb-4 text-base font-semibold text-[#1a2332]">
          Qualifications
        </h3>
        {!blocks.length ? (
          <p className="text-sm text-[#6b7a8d]">No degree levels selected.</p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <div
                key={block.degreeLevel}
                className="rounded-xl border border-[#e4eaf2] bg-[#fafbfc] px-4 py-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5f7388]">
                  {block.label}
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[#6b7a8d]">Degree title</dt>
                    <dd className="font-medium text-[#1a2332]">
                      {block.degreeTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#6b7a8d]">Institution</dt>
                    <dd className="font-medium text-[#1a2332]">
                      {block.institution}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#6b7a8d]">Country</dt>
                    <dd className="font-medium text-[#1a2332]">{block.country}</dd>
                  </div>
                  <div>
                    <dt className="text-[#6b7a8d]">Duration (years)</dt>
                    <dd className="font-medium text-[#1a2332]">
                      {block.durationYears}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
        <h3 className="mb-4 text-base font-semibold text-[#1a2332]">
          Work experience
        </h3>
        <div className="space-y-3">
          {experience.map((row, index) => (
            <div
              key={row.id ?? index}
              className="rounded-xl border border-[#e4eaf2] bg-[#fafbfc] px-4 py-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5f7388]">
                Role {index + 1}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[#6b7a8d]">Employer</dt>
                  <dd className="font-medium text-[#1a2332]">
                    {(row.employer || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6b7a8d]">Title</dt>
                  <dd className="font-medium text-[#1a2332]">
                    {(row.title || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6b7a8d]">Start</dt>
                  <dd className="font-medium text-[#1a2332]">
                    {(row.start || "").trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6b7a8d]">End</dt>
                  <dd className="font-medium text-[#1a2332]">
                    {(row.end || "").trim() || "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-[#1a2332]">
                Engineering-related role:{" "}
                <span className="font-medium">
                  {isEngineeringRelatedChecked(row) ? "Yes" : "No"}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border-2 border-[#2c5f8a]/35 bg-[#f3f7fb] p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
        <h3 className="text-base font-semibold text-[#1a2332]">
          Engineering-titled degree
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#6b7a8d]">
          Separate from the per-role engineering checkboxes above. Answer for the
          case overall — not set by AI.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#2c5f8a]"
            checked={engineeringTitledDegree === true}
            onChange={(e) => onEngineeringTitledChange(e.target.checked)}
          />
          <span className="text-sm font-medium text-[#1a2332]">
            Is this an engineering-titled degree?
          </span>
        </label>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[#d5dde8] bg-white px-5 py-2.5 text-sm font-medium text-[#1a2332]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNextPlaceholder}
          className="rounded-full bg-[#1a2332] px-5 py-2.5 text-sm font-medium text-white"
        >
          Next
        </button>
      </div>
    </div>
  );
}
