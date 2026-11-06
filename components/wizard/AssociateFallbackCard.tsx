"use client";

import type { AssociateFallback } from "@/lib/types";

/**
 * 312999 Building and Engineering Technicians nec (fallback only, no rubric):
 * one slim line shown just above the subject breakdown when no specific
 * Engineering Associate ANZSCO reaches the threshold.
 */
export function AssociateFallbackCard({ fallback }: { fallback: AssociateFallback }) {
  const closest = fallback.nearMisses.find((n) => n.confidenceScore != null);
  const firstMissing = closest?.missing[0];
  const moreMissing = closest ? closest.missing.length - 1 : 0;
  return (
    <p
      role="note"
      aria-label="Engineering Associate fallback"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--warning-soft)] px-4 py-2.5 text-[13px] leading-snug text-[var(--warning-ink)]"
    >
      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-ink)] ring-1 ring-line">
        Fallback · {fallback.anzscoCode}
      </span>
      <span className="min-w-0">
        No specific Associate ANZSCO reached {fallback.threshold}%
        {closest
          ? ` (closest ${closest.title} ${closest.confidenceScore}%${
              firstMissing ? `, missing ${firstMissing}${moreMissing > 0 ? ` +${moreMissing} more` : ""}` : ""
            })`
          : ""}
        . Assess manually under {fallback.title}.
      </span>
    </p>
  );
}
