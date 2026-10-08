"use client";

export function Step6Placeholder({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Step 6
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          This step is reserved for the next phase.
        </p>
      </header>

      <section className="rounded-2xl border border-dashed border-line-strong bg-surface-tint px-5 py-10 text-center">
        <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deeper ring-1 ring-brand-muted">
          Coming soon
        </span>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
          Nothing to do here yet. Your final review is complete — this step will
          be added in the next phase.
        </p>
      </section>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
      </div>
    </div>
  );
}
