import type { Gate1Decision, Gate1Result } from "@/lib/types";

const RESULT_LABEL: Record<Gate1Result, string> = {
  open: "Eligible for assessment",
  manual_review: "Manual review",
  not_eligible: "Not eligible",
};

const RESULT_CLASS: Record<Gate1Result, string> = {
  open: "bg-success-soft text-success",
  manual_review: "bg-surface-tint text-[var(--warning-ink)]",
  not_eligible: "bg-surface-tint text-[var(--warning-ink)]",
};

const AWARD_LABEL: Record<string, string> = {
  certificate: "Certificate",
  diploma: "Diploma",
  advanced_diploma: "Advanced Diploma",
  associate_degree: "Associate Degree",
  bachelor: "Bachelor",
  honours: "Honours",
  graduate_diploma: "Graduate Diploma",
  master: "Master",
  doctorate: "Doctorate",
  unknown: "Not identified",
};

const ENGINEERING_LABEL = { yes: "Yes", no: "No", unclear: "Unclear" } as const;

const years = (n: number | null) => (n == null ? "—" : `${n} yr`);

/** Per-qualification outcome without the rule number, e.g. "passes (rule 3)" → "passes". */
const outcomeLabel = (outcome: string) => outcome.replace(/\s*\(rule \d\)/i, "");

const CHIP = "inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium leading-none";

/** Step 4 box: Gate 1 qualification eligibility (decided before any scoring). */
export function Gate1Box({ gate }: { gate: Gate1Decision }) {
  const open = gate.tracks.filter((t) => t.open).sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
  const closed = gate.tracks.filter((t) => !t.open);
  return (
    <section
      aria-label="Gate 1 qualification check"
      className="rounded-xl border border-line bg-surface/95 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Gate 1 · Qualification check
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {gate.durationFallback ? (
            <span className="rounded-full bg-surface-tint px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
              Stated duration used
            </span>
          ) : null}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${RESULT_CLASS[gate.result]}`}>
            {RESULT_LABEL[gate.result]}
          </span>
        </div>
      </div>

      {gate.result !== "open" ? (
        <p className="mt-3 text-sm leading-snug text-ink">{gate.reason}</p>
      ) : null}

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-medium text-ink-faint">Open tracks</p>
          {open.length ? (
            <ul className="flex flex-wrap gap-2">
              {open.map((t) => (
                <li key={t.track} className={`${CHIP} border-success-line bg-success-soft text-success`}>
                  {t.label}
                  {t.priority != null ? (
                    <span className="ml-1.5 font-normal opacity-80">· Priority {t.priority}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-ink-muted">None</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium text-ink-faint">Closed tracks</p>
          {closed.length ? (
            <ul className="flex flex-wrap gap-2">
              {closed.map((t) => (
                <li key={t.track} className={`${CHIP} border-line bg-surface-tint text-ink-muted`}>
                  {t.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-ink-muted">None</p>
          )}
        </div>
      </div>

      {gate.qualifications.length ? (
        <table className="mt-5 w-full text-left text-[12px] leading-snug">
          <thead className="text-ink-faint">
            <tr>
              <th className="py-0.5 pr-3 font-medium">Qualification</th>
              <th className="py-0.5 pr-3 font-medium">Level</th>
              <th className="py-0.5 pr-3 font-medium">Engineering</th>
              <th className="py-0.5 pr-3 font-medium">Stated</th>
              <th className="py-0.5 pr-3 font-medium">Counted</th>
              <th className="py-0.5 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {gate.qualifications.map((q, i) => (
              <tr key={`g1q-${i}`} title={q.durationMethod}>
                <td className="py-0.5 pr-3">
                  {q.title || AWARD_LABEL[q.award] || q.award}
                  {q.used ? <span className="text-ink-faint"> (used)</span> : null}
                </td>
                <td className="py-0.5 pr-3">
                  {AWARD_LABEL[q.award] ?? q.award}
                  {q.aqfLevel != null ? <span className="text-ink-faint"> · AQF {q.aqfLevel}</span> : null}
                </td>
                <td className="py-0.5 pr-3" title={q.engineeringReason}>
                  {ENGINEERING_LABEL[q.engineering]}
                </td>
                <td className="py-0.5 pr-3 tabular-nums">{years(q.statedYears)}</td>
                <td className="py-0.5 pr-3 tabular-nums">{years(q.countedYears)}</td>
                <td className="py-0.5">
                  {outcomeLabel(q.outcome)}
                  {q.flags.length ? (
                    <span className="text-[var(--warning-ink)]"> · {q.flags.join(", ")}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
