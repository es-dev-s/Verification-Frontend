"use client";

import { useState } from "react";
import type {
  SpecialisationOutcome,
  SpecialisationResult,
  SpecialisationTier,
} from "@/lib/types";

const TIER: Record<SpecialisationTier, { label: string; cls: string }> = {
  no_risk: {
    label: "No risk",
    cls: "bg-success-soft text-success ring-success-line",
  },
  slight_risk: {
    label: "Slight risk",
    cls: "bg-[#faf4ec] text-[#7a5c32] ring-[#ead9b8]",
  },
  high_risk: {
    label: "High risk",
    cls: "bg-[#f8ecec] text-[#8a3a3a] ring-[#e2c4c4]",
  },
};

function TierPill({ tier }: { tier: SpecialisationTier }) {
  const t = TIER[tier];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${t.cls}`}
    >
      {t.label}
    </span>
  );
}

function pathwaySummary(s: SpecialisationOutcome): string {
  if (!s.chosen) return "Not evaluated — Civil core incomplete";
  const a = s.pathwayA.available ? `Master's ${Math.round(s.pathwayA.relevancePct)}%` : "No Master's";
  const b = s.pathwayB.available
    ? `Work ${Math.round(s.pathwayB.relevancePct)}% · ${s.pathwayB.fteYears} yrs`
    : "No work experience";
  return s.chosen === "A" ? `Pathway A · ${a}` : `Pathway B · ${b}`;
}

function Detail({ s }: { s: SpecialisationOutcome }) {
  return (
    <div className="mt-3 grid gap-3 text-sm text-ink md:grid-cols-3">
      <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Bachelor&apos;s base subjects
        </p>
        <p className="mt-1.5 tabular-nums">
          {s.base.matched.length}/{s.base.matched.length + s.base.missing.length} covered
        </p>
        {s.base.missing.length ? (
          <p className="mt-1 text-xs leading-snug text-ink-muted">
            Missing: {s.base.missing.join(", ")}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Pathway A · Master&apos;s{s.chosen === "A" ? " · used" : ""}
        </p>
        {s.pathwayA.available ? (
          <>
            <p className="mt-1.5 tabular-nums">
              {Math.round(s.pathwayA.relevancePct)}% relevant · title {s.pathwayA.titleFit}
            </p>
            <p className="mt-1 text-xs leading-snug text-ink-muted">
              {s.pathwayA.coursePct == null
                ? "Subjects not extracted"
                : `${s.pathwayA.matched.length}/${s.pathwayA.subjectsCounted} subjects in the specialisation`}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-ink-muted">No Master&apos;s on the case</p>
        )}
      </div>
      <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Pathway B · Work{s.chosen === "B" ? " · used" : ""}
        </p>
        {s.pathwayB.available ? (
          <>
            <p className="mt-1.5 tabular-nums">
              {s.pathwayB.fteYears} FTE yrs · {Math.round(s.pathwayB.relevancePct)}% relevant
            </p>
            <p className="mt-1 text-xs leading-snug text-ink-muted">
              Duties {s.pathwayB.competenciesMatched.length}/
              {s.pathwayB.competenciesMatched.length + s.pathwayB.competenciesMissing.length} evidenced
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-ink-muted">No work experience on the case</p>
        )}
      </div>
      {s.gaps.length ? (
        <ul className="space-y-1 rounded-xl border border-line bg-[var(--warning-soft)] px-3.5 py-3 md:col-span-3">
          {s.gaps.map((g, i) => (
            <li key={`${i}-${g}`} className="text-sm leading-snug text-[var(--warning-ink)]">
              {g}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Civil specialisation pathways (Structural / Geotechnical / Transport, doc 12). */
export function SpecialisationCard({ result }: { result: SpecialisationResult }) {
  const [open, setOpen] = useState<string | null>(null);
  const core = result.civilCore;
  const coreTotal = core.matched.length + core.missing.length;
  return (
    <section
      aria-label="Civil specialisation pathways"
      className="rounded-2xl border border-line bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Specialisation pathways
          </p>
          <p className="mt-1 text-sm text-ink">
            Civil core {core.matched.length}/{coreTotal}
            {core.met ? " · complete" : ` · missing ${core.missing.join(", ")}`}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {result.specialisations.map((s) => {
          const isOpen = open === s.anzscoCode;
          return (
            <div key={s.anzscoCode} className="rounded-xl border border-line bg-surface px-3.5 py-3">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.anzscoCode)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.title} <span className="font-mono text-xs text-ink-faint">{s.anzscoCode}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted" title={s.routing}>
                    {pathwaySummary(s)}
                  </p>
                </div>
                <TierPill tier={s.tier} />
              </button>
              {isOpen ? <Detail s={s} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
