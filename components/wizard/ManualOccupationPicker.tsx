"use client";

import { useEffect, useMemo, useState } from "react";
import { getAssessOccupations } from "@/lib/api";
import type { ManualOccupationOption } from "@/lib/types";
import { BTN_PRIMARY, FOCUS_RING } from "./UploadTile";

const INPUT = `w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 ${FOCUS_RING}`;

type Current = { anzscoCode: string; title: string; occupationId: string } | null | undefined;

/**
 * Step 4, Gate 1 = manual review: the assessor picks one ANZSCO occupation
 * (code or searchable name) and runs the normal matching for it only.
 */
export function ManualOccupationPicker({
  current,
  busy,
  onRun,
}: {
  current: Current;
  busy?: boolean;
  onRun: (occupationId: string) => void;
}) {
  const [options, setOptions] = useState<ManualOccupationOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState(current?.anzscoCode ?? "");
  const [query, setQuery] = useState(current?.title ?? "");
  const [pickedId, setPickedId] = useState<string | null>(current?.occupationId ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getAssessOccupations()
      .then((list) => {
        if (alive) setOptions(list);
      })
      .catch(() => {
        if (alive) setLoadError("Could not load the occupation list.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const picked = useMemo(
    () => options?.find((o) => o.occupationId === pickedId && o.available) ?? null,
    [options, pickedId],
  );

  // Message for the typed code (no rubric / more than one occupation).
  const codeMessage = useMemo(() => {
    const c = code.replace(/\s+/g, "");
    if (!options || picked || !/^\d{6}$/.test(c)) return null;
    const hits = options.filter((o) => o.anzscoCode === c);
    if (!hits.length) return `No rubric for ANZSCO ${c}. Matching is not available for this code.`;
    const usable = hits.filter((o) => o.available);
    if (!usable.length) return `ANZSCO ${c} (${hits[0]!.title}): ${hits[0]!.unavailableReason ?? "no rubric."}`;
    if (usable.length > 1) return `More than one occupation uses ANZSCO ${c}. Pick one from the list.`;
    return null;
  }, [code, options, picked]);

  const filtered = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    const c = code.replace(/\s+/g, "");
    return options.filter((o) => {
      if (picked) return true;
      if (/^\d{6}$/.test(c) && o.anzscoCode !== c && !q) return false;
      if (!q) return true;
      return o.title.toLowerCase().includes(q) || o.anzscoCode.includes(q);
    });
  }, [options, query, code, picked]);

  function choose(o: ManualOccupationOption) {
    setCode(o.anzscoCode);
    setQuery(o.title);
    setPickedId(o.available ? o.occupationId : null);
    setOpen(false);
  }

  function onCodeChange(value: string) {
    const c = value.replace(/[^\d]/g, "").slice(0, 6);
    setCode(c);
    setPickedId(null);
    const usable = options?.filter((o) => o.anzscoCode === c && o.available) ?? [];
    if (c.length === 6 && usable.length === 1) {
      setQuery(usable[0]!.title);
      setPickedId(usable[0]!.occupationId);
    } else if (c.length === 6) {
      const any = options?.find((o) => o.anzscoCode === c);
      setQuery(usable.length > 1 ? "" : (any?.title ?? ""));
      if (usable.length > 1) setOpen(true);
    } else {
      setQuery("");
    }
  }

  const message = loadError ?? codeMessage;

  return (
    <section
      aria-label="Assessor-selected occupation"
      className="rounded-xl border border-line bg-surface/95 px-5 py-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Assessor-selected occupation
      </p>
      <p className="mt-1 text-sm leading-snug text-ink-muted">
        Gate 1 needs manual review. Pick the ANZSCO occupation to match the saved subjects
        against.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">ANZSCO code</span>
          <input
            className={`${INPUT} font-mono tabular-nums`}
            inputMode="numeric"
            placeholder="e.g. 233512"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        </label>
        <div className="relative">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Occupation</span>
            <input
              className={INPUT}
              role="combobox"
              aria-expanded={open}
              aria-controls="manual-occupation-list"
              placeholder={options ? "Search occupations" : "Loading occupations…"}
              value={query}
              disabled={!options}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onChange={(e) => {
                setQuery(e.target.value);
                setPickedId(null);
                setCode("");
                setOpen(true);
              }}
            />
          </label>
          {open && options ? (
            <ul
              id="manual-occupation-list"
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(36,31,42,0.12)]"
            >
              {filtered.length ? (
                filtered.map((o) => (
                  <li
                    key={`${o.anzscoCode}-${o.occupationId ?? o.title}`}
                    role="option"
                    aria-selected={o.occupationId !== null && o.occupationId === pickedId}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(o);
                    }}
                    className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-soft/50 ${
                      o.available ? "text-ink" : "text-ink-faint"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono tabular-nums text-ink-muted">{o.anzscoCode}</span>
                      <span className="ml-2">{o.title}</span>
                    </span>
                    {!o.available ? (
                      <span className="shrink-0 text-[11px]">No rubric</span>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-ink-muted">No matching occupation</li>
              )}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!picked || busy}
          onClick={() => picked?.occupationId && onRun(picked.occupationId)}
        >
          Run matching
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-sm leading-snug text-[var(--warning-ink)]">{message}</p>
      ) : null}
    </section>
  );
}
