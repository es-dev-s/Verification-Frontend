import type {
  DurationCheckStatus,
  QualificationTranscriptSummary,
} from "@/lib/types";

const UNIT_PLURAL: Record<string, string> = {
  semester: "semesters",
  trimester: "trimesters",
  quarter: "quarters",
};

/** "4 years", "3.5 years", "1 year". */
export function formatYears(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 100) / 100;
  return `${v} ${v === 1 ? "year" : "years"}`;
}

/** "4 years · 8 semesters" when the transcript is semester-based. */
export function formatCountedDuration(q: QualificationTranscriptSummary): string {
  const years = q.effective.countedYears;
  if (years == null) return "Not counted";
  const manual = q.overrides.countedYears != null;
  const terms = !manual ? q.transcript.terms : null;
  const unit = q.transcript.unit ? UNIT_PLURAL[q.transcript.unit] : null;
  return terms && unit ? `${formatYears(years)} · ${terms} ${unit}` : formatYears(years);
}

export function formatCredits(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10} credits`;
}

export function formatShare(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

const STATUS_LABEL: Record<DurationCheckStatus, string> = {
  match: "Durations match",
  mismatch: "Requires manual review",
  fallback: "Stated duration used",
  no_stated: "Counted duration used",
  missing: "Requires manual review",
};

const STATUS_CLASS: Record<DurationCheckStatus, string> = {
  match: "bg-success-soft text-success",
  mismatch: "bg-[#fff7ed] text-[#b45309] ring-1 ring-[#fdba74]/60",
  missing: "bg-[#fff7ed] text-[#b45309] ring-1 ring-[#fdba74]/60",
  fallback: "bg-surface-tint text-ink-muted ring-1 ring-line",
  no_stated: "bg-surface-tint text-ink-muted ring-1 ring-line",
};

export function DurationStatusPill({ status }: { status: DurationCheckStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Small label/value tile used by Transcript data and Verify details. */
export function DataTile({
  label,
  value,
  hint,
  tag,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tag?: string | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        {label}
        {tag ? (
          <span className="rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand">
            {tag}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}
