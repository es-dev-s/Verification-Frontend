"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmAnswers, EmCheckStatus, EmJobLevel, EngineeringManagerCheck } from "@/lib/types";
import { BTN_PRIMARY, FOCUS_RING } from "./UploadTile";

const SELECT = `w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 ${FOCUS_RING}`;

const LEVELS: Array<{ value: EmJobLevel; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "manager", label: "Manager" },
  { value: "project", label: "Project manager / engineer" },
  { value: "other", label: "Not counted" },
];

const OUTCOME: Record<EngineeringManagerCheck["outcome"], { label: string; className: string }> = {
  qualified: { label: "Qualified", className: "bg-success-soft text-success" },
  not_qualified: { label: "Not qualified", className: "bg-[var(--warning-soft)] text-[var(--warning-ink)]" },
  redirect: { label: "Professional Engineer", className: "bg-brand-soft text-brand-deeper" },
  pending: { label: "Needs answers", className: "bg-surface-tint text-ink-muted" },
};

type Confirmation = "managerialRole" | "managersReport" | "rseApplied";

const CONFIRMATIONS: Array<{ key: Confirmation; label: string }> = [
  { key: "managerialRole", label: "Proper managerial role (plans, budgets, people, quality and safety)" },
  { key: "managersReport", label: "The people reporting to the client are managers" },
  { key: "rseApplied", label: "RSE assessment applied (in addition to the CDR)" },
];

function draftFrom(check: EngineeringManagerCheck): EmAnswers {
  return {
    ...check.answers,
    jobLevels: Object.fromEntries(check.jobs.map((j) => [j.key, j.level])),
  };
}

function StatusIcon({ status }: { status: EmCheckStatus }) {
  if (status === "met") {
    return (
      <svg aria-label="Met" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-success">
        <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
      </svg>
    );
  }
  if (status === "not_met") {
    return (
      <svg aria-label="Not met" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-ink)]">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    );
  }
  return <span aria-label="Open" className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-line" />;
}

function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${FOCUS_RING} ${
      on ? "bg-brand text-white" : "border border-line bg-surface text-ink-muted hover:bg-surface-tint"
    }`;
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-1.5">
      <button type="button" aria-pressed={value === true} className={pill(value === true)} onClick={() => onChange(true)}>
        Yes
      </button>
      <button type="button" aria-pressed={value === false} className={pill(value === false)} onClick={() => onChange(false)}>
        No
      </button>
    </div>
  );
}

/**
 * Engineering Manager (133211) check inside "Check an ANZSCO": the assessor
 * answers, then sees the outcome and the five requirements.
 */
export function EngineeringManagerCheck({
  load,
  onClose,
}: {
  /** No answers: read the saved check. With answers: save them and check. */
  load: (answers?: EmAnswers) => Promise<EngineeringManagerCheck>;
  onClose: () => void;
}) {
  const [check, setCheck] = useState<EngineeringManagerCheck | null>(null);
  const [draft, setDraft] = useState<EmAnswers | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let alive = true;
    loadRef.current()
      .then((c) => {
        if (!alive) return;
        setCheck(c);
        setDraft(draftFrom(c));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load the Engineering Manager check.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const redirectOpen = useMemo(() => {
    const levels = Object.values(draft?.jobLevels ?? {});
    return levels.includes("project") && !levels.includes("manager");
  }, [draft]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const c = await loadRef.current({ ...draft, redirectConfirmed: redirectOpen ? draft.redirectConfirmed : null });
      setCheck(c);
      setDraft(draftFrom(c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the answers.");
    } finally {
      setBusy(false);
    }
  }

  const outcome = check ? OUTCOME[check.outcome] : null;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {outcome ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${outcome.className}`}>{outcome.label}</span>
          ) : null}
          <p className="mt-2 break-words text-base font-semibold leading-snug text-ink">
            Engineering Manager
            <span className="font-mono tabular-nums"> · 133211</span>
          </p>
          {check ? <p className="mt-0.5 text-sm text-ink-muted">{check.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close check"
          className={`shrink-0 rounded-full p-1.5 text-ink-muted transition hover:bg-surface-subtle hover:text-ink ${FOCUS_RING}`}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {error ? <p className="mt-3 text-sm leading-snug text-[var(--warning-ink)]">{error}</p> : null}
      {!check && busy ? <p className="mt-3 text-sm text-ink-muted">Loading…</p> : null}

      {check ? (
        <ul className="mt-3 divide-y divide-line rounded-xl bg-surface-tint">
          {check.checks.map((c) => (
            <li key={c.id} className="flex gap-2.5 px-3 py-2">
              <StatusIcon status={c.status} />
              <div className="min-w-0">
                <p className="text-sm text-ink">{c.label}</p>
                {c.detail ? <p className="mt-0.5 text-xs leading-snug text-ink-muted">{c.detail}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {check && draft ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Engineering discipline</span>
            <select
              className={`mt-1.5 ${SELECT}`}
              value={draft.disciplineId ?? ""}
              onChange={(e) => setDraft({ ...draft, disciplineId: e.target.value || null })}
            >
              <option value="">Pick the Professional Engineer occupation</option>
              {check.disciplines.map((d) => (
                <option key={d.occupationId} value={d.occupationId}>
                  {d.title} ({d.anzscoCode})
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-ink">Job levels</p>
            {check.jobs.length ? (
              <ul className="mt-1.5 space-y-2">
                {check.jobs.map((j) => (
                  <li
                    key={j.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm text-ink">
                        {j.title || "Untitled role"}
                        {j.employer ? <span className="text-ink-muted"> · {j.employer}</span> : null}
                      </p>
                      <p className="text-xs tabular-nums text-ink-muted">
                        {j.start || "?"} – {j.end || "?"}
                        {j.years != null ? ` · ${j.years} yrs${j.partTime ? " (part-time)" : ""}` : ""}
                      </p>
                    </div>
                    <select
                      aria-label={`Level for ${j.title || "this job"}`}
                      className={`w-auto ${SELECT}`}
                      value={draft.jobLevels[j.key] ?? j.suggestedLevel}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          jobLevels: { ...draft.jobLevels, [j.key]: e.target.value as EmJobLevel },
                        })
                      }
                    >
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-ink-muted">No jobs saved on the CV.</p>
            )}
          </div>

          {redirectOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft px-3 py-2">
              <p className="min-w-0 text-sm text-ink">
                Project Manager / Project Engineer role. Assess as an engineering professional instead?
              </p>
              <YesNo
                label="Assess as an engineering professional"
                value={draft.redirectConfirmed}
                onChange={(v) => setDraft({ ...draft, redirectConfirmed: v })}
              />
            </div>
          ) : null}

          <ul className="space-y-2">
            {CONFIRMATIONS.map((q) => (
              <li key={q.key} className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm text-ink">{q.label}</p>
                <YesNo label={q.label} value={draft[q.key]} onChange={(v) => setDraft({ ...draft, [q.key]: v })} />
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void save()}>
              {busy ? "Checking…" : "Save and check"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}