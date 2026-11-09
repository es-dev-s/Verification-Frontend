import type { LateralEntryView } from "@/lib/types";

const PILL = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/** Lateral-entry status after Verify details (routes 2-4 only; route 1 shows nothing). */
const LATERAL_STATUS: Record<2 | 3 | 4, { label: string; className: string }> = {
  3: { label: "Confirmed", className: "bg-brand/15 text-[#8a4f12]" },
  2: { label: "Not lateral entry", className: "bg-surface-tint text-ink ring-1 ring-line" },
  4: { label: "Manual review", className: "bg-[var(--warning-soft)] text-[var(--warning-ink)]" },
};

/** True when the lateral-entry status pill has something to show (routes 2-4). */
export function hasLateralEntryStatus(view: LateralEntryView | null | undefined): boolean {
  const route = view?.route;
  return route === 2 || route === 3 || route === 4;
}

/** Shared lateral-entry status pill (Assessment and Final review). */
export function LateralEntryPill({ view }: { view: LateralEntryView | null | undefined }) {
  const route = view?.route;
  if (route !== 2 && route !== 3 && route !== 4) return null;
  const status = LATERAL_STATUS[route];
  // Only a warning (manual review / contradiction) keeps its short reason; the routine sentence is dropped.
  const note = route === 4 || view?.flagged ? view?.reason : null;
  return (
    <>
      <span className={`${PILL} font-semibold ${status.className}`}>{status.label}</span>
      {note ? (
        <p className="mt-1.5 text-[12px] font-normal leading-snug text-[var(--warning-ink)]">{note}</p>
      ) : null}
    </>
  );
}
