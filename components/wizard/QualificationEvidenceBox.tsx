import type { QualificationEvidence } from "@/lib/types";

const ENGINEERING_PILL = {
  yes: { label: "Yes", className: "bg-success-soft text-success" },
  no: { label: "No", className: "bg-surface-tint text-[var(--warning-ink)]" },
  unclear: { label: "Unclear", className: "bg-surface-tint text-ink-muted" },
} as const;

const PILL = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/** Step 4 box: engineering decision and final-year project (duration is shown in the Gate 1 box). */
export function QualificationEvidenceBox({ evidence }: { evidence: QualificationEvidence }) {
  const { engineering, finalProject } = evidence;
  const eng = ENGINEERING_PILL[engineering.decision];
  return (
    <section
      aria-label="Qualification evidence"
      className="rounded-xl border border-line bg-surface/95 px-5 py-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Qualification evidence
      </p>
      <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[11rem_1fr]">
        <dt className="text-[12px] font-medium text-ink-faint sm:pt-0.5">Engineering qualification</dt>
        <dd className="min-w-0">
          <span className={`${PILL} ${eng.className}`}>{eng.label}</span>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{engineering.reason}</p>
        </dd>
        {finalProject?.title ? (
          <>
            <dt className="text-[12px] font-medium text-ink-faint sm:pt-0.5">Final-year project</dt>
            <dd className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="leading-snug text-ink">{finalProject.title}</span>
                {finalProject.term ? (
                  <span className={`${PILL} bg-surface-tint text-ink-muted`}>{finalProject.term}</span>
                ) : null}
              </div>
              {finalProject.note ? (
                <p className="mt-1.5 text-[12px] leading-snug text-[var(--warning-ink)]">{finalProject.note}</p>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
