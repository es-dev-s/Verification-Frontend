"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnzscoCandidate,
  AssessmentResult,
  SubjectMatchRow,
} from "@/lib/types";

function coverageLabel(matched: number, expected: number, pct: number): string {
  const rounded = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${matched} / ${expected} — ${rounded}%`;
}

function methodBadge(method: SubjectMatchRow["method"]): {
  label: string;
  className: string;
} {
  switch (method) {
    case "exact":
      return {
        label: "Exact match",
        className: "bg-[#e8eef4] text-[#3d4f63]",
      };
    case "fuzzy":
      return {
        label: "Variant match",
        className: "bg-[#e8eef4] text-[#3d4f63]",
      };
    case "llm":
      return {
        label: "AI-matched",
        className: "bg-[#e4ebf5] text-[#2c5f8a] ring-1 ring-[#c5d4e3]",
      };
    default:
      return {
        label: "Unclassified",
        className: "bg-[#f0f3f7] text-[#6b7a8d]",
      };
  }
}

function isScoringMatch(m: SubjectMatchRow): boolean {
  return Boolean(
    m.rubricSubject &&
      m.method !== "none" &&
      m.category !== "catchAll" &&
      m.rubricSubject !== "Others",
  );
}

function candidatesFromAssessment(
  assessment: AssessmentResult,
): AnzscoCandidate[] {
  if (assessment.candidates?.length) return assessment.candidates.slice(0, 3);

  // Legacy cached results without candidates[] — synthesize one card.
  if (!assessment.anzscoCode && !assessment.title) {
    return [
      {
        anzscoCode: "233111",
        title: "Chemical Engineer",
        foundationalMatched: assessment.foundationalMatched,
        foundationalExpected: assessment.foundationalExpected,
        foundationalPct: assessment.foundationalPct,
        coreMatched: assessment.coreMatched,
        coreExpected: assessment.coreExpected,
        corePct: assessment.corePct,
        tier3GateMet: assessment.tier3GateMet,
        matches: assessment.matches,
        missingSubjects: assessment.missingSubjects ?? { tier1: [], tier2: [] },
        unmatched: assessment.unmatched,
      },
    ];
  }

  return [
    {
      anzscoCode: assessment.anzscoCode ?? "—",
      title: assessment.title ?? "Occupation",
      foundationalMatched: assessment.foundationalMatched,
      foundationalExpected: assessment.foundationalExpected,
      foundationalPct: assessment.foundationalPct,
      coreMatched: assessment.coreMatched,
      coreExpected: assessment.coreExpected,
      corePct: assessment.corePct,
      tier3GateMet: assessment.tier3GateMet,
      matches: assessment.matches,
      missingSubjects: assessment.missingSubjects ?? { tier1: [], tier2: [] },
      unmatched: assessment.unmatched,
    },
  ];
}

function transcriptSourceLabel(assessment: AssessmentResult): string {
  if (assessment.transcriptSource?.label) return assessment.transcriptSource.label;
  if (assessment.mastersFallbackUsed) {
    return "Matched using: Master's transcript (fallback — Bachelor's core coverage was below threshold)";
  }
  const used = assessment.qualificationsUsed ?? [];
  if (used.includes("bachelor") && !used.includes("master")) {
    return "Matched using: Bachelor's transcript";
  }
  if (used.includes("master") && !used.includes("bachelor")) {
    return "Matched using: Master's transcript";
  }
  if (used.includes("bachelor") && used.includes("master")) {
    return "Matched using: Bachelor's and Master's transcript subjects";
  }
  return "Matched using: transcript subjects";
}

function TierGroupHeader({
  title,
  coverage,
}: {
  title: string;
  coverage: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8eef4] pb-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7a8d]">
        {title}
      </h4>
      <span className="font-mono text-[11px] tabular-nums text-[#3d4f63]">
        {coverage}
      </span>
    </div>
  );
}

function EmptyListNote({ text }: { text: string }) {
  return <p className="py-2 text-xs text-[#8a97a8]">{text}</p>;
}

export function Step3Assessment({
  assessment,
  loading,
  error,
  onBack,
  onRetry,
  onConfirmOccupation,
}: {
  assessment: AssessmentResult | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onConfirmOccupation?: (candidate: AnzscoCandidate) => void;
}) {
  const candidates = useMemo(
    () => (assessment ? candidatesFromAssessment(assessment) : []),
    [assessment],
  );

  const [viewingCode, setViewingCode] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!candidates.length) {
      setViewingCode(null);
      setConfirmedCode(null);
      return;
    }
    setViewingCode((prev) =>
      prev && candidates.some((c) => c.anzscoCode === prev)
        ? prev
        : candidates[0]!.anzscoCode,
    );
    setConfirmedCode(null);
  }, [candidates]);

  const selected =
    candidates.find((c) => c.anzscoCode === viewingCode) ?? candidates[0] ?? null;

  const matchedTier1 = useMemo(
    () =>
      (selected?.matches ?? []).filter(
        (m) => isScoringMatch(m) && m.tier === "tier1",
      ),
    [selected],
  );
  const matchedTier2 = useMemo(
    () =>
      (selected?.matches ?? []).filter(
        (m) => isScoringMatch(m) && m.tier === "tier2",
      ),
    [selected],
  );

  const missingTier1 = selected?.missingSubjects.tier1 ?? [];
  const missingTier2 = selected?.missingSubjects.tier2 ?? [];
  const unclassified = selected?.unmatched ?? [];

  const tier1Coverage = selected
    ? coverageLabel(
        selected.foundationalMatched,
        selected.foundationalExpected,
        selected.foundationalPct,
      )
    : "";
  const tier2Coverage = selected
    ? coverageLabel(
        selected.coreMatched,
        selected.coreExpected,
        selected.corePct,
      )
    : "";

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-[#1a2332]">
          ANZSCO matching
        </h1>
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-[#6b7a8d]">
          Transcript subjects matched against occupation rubrics. Counts and
          percentages are raw coverage — not a risk determination.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-[#d5dde8] bg-white/90 p-8 text-center">
          <p className="text-sm font-medium text-[#1a2332]">
            Running subject matching…
          </p>
          <p className="mt-2 text-xs text-[#6b7a8d]">
            Extracting subjects and comparing against ANZSCO rubrics. This may
            take a minute.
          </p>
        </div>
      ) : null}

      {error && !loading ? (
        <div className="mb-5 rounded-2xl border border-[#d5dde8] bg-[#f7f8fa] p-5">
          <p className="text-sm font-medium text-[#1a2332]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-full bg-[#1a2332] px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {assessment && !loading ? (
        <div className="space-y-4">
          {/* 1. Top candidates — bento comparison row */}
          <section aria-label="Top ANZSCO candidates">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7a8d]">
                Top matches
              </p>
              <p className="text-[11px] text-[#8a97a8]">
                Select a card to inspect its breakdown
              </p>
            </div>
            <div
              className={`grid gap-3 ${
                candidates.length >= 3
                  ? "md:grid-cols-3"
                  : candidates.length === 2
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
              }`}
            >
              {candidates.map((c, rank) => {
                const active = selected?.anzscoCode === c.anzscoCode;
                return (
                  <button
                    key={c.anzscoCode}
                    type="button"
                    onClick={() => setViewingCode(c.anzscoCode)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[#2c5f8a] bg-white shadow-[0_0_0_1px_#2c5f8a]"
                        : "border-[#d5dde8] bg-white/90 hover:border-[#b7c5d6]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] tabular-nums text-[#6b7a8d]">
                          #{rank + 1} · {c.anzscoCode}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-[#1a2332]">
                          {c.title}
                        </p>
                      </div>
                      {active ? (
                        <span className="shrink-0 rounded-full bg-[#e8eef4] px-2 py-0.5 text-[10px] font-medium text-[#2c5f8a]">
                          Viewing
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs text-[#3d4f63]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#6b7a8d]">Tier 1</dt>
                        <dd className="font-mono tabular-nums">
                          {coverageLabel(
                            c.foundationalMatched,
                            c.foundationalExpected,
                            c.foundationalPct,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#6b7a8d]">Tier 2</dt>
                        <dd className="font-mono tabular-nums">
                          {coverageLabel(
                            c.coreMatched,
                            c.coreExpected,
                            c.corePct,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#6b7a8d]">Capstone</dt>
                        <dd>
                          {c.tier3GateMet
                            ? "Capstone found"
                            : "Capstone not found"}
                        </dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </section>

          {selected ? (
            <>
              {/* Meta strip: source + work experience */}
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                <section className="rounded-2xl border border-[#d5dde8] bg-white/90 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7a8d]">
                    Transcript source
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-[#1a2332]">
                    {transcriptSourceLabel(assessment)}
                  </p>
                </section>
                <section className="rounded-2xl border border-dashed border-[#c5d4e3] bg-[#f7f9fb] px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7a8d]">
                    Work experience
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-[#1a2332]">
                    {assessment.workExperienceBoost
                      ? "Work experience: relevant to this occupation"
                      : "Work experience: not clearly related"}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a97a8]">
                    Separate from academic Tier 1 / Tier 2 coverage
                  </p>
                </section>
              </div>

              {/* 2. Full breakdown — three lists */}
              <section
                aria-label={`Breakdown for ${selected.title}`}
                className="rounded-2xl border border-[#d5dde8] bg-white/90 p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7a8d]">
                      Subject breakdown
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[#1a2332]">
                      {selected.anzscoCode} — {selected.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedCode(selected.anzscoCode);
                      onConfirmOccupation?.(selected);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      confirmedCode === selected.anzscoCode
                        ? "bg-[#2c5f8a] text-white"
                        : "bg-[#1a2332] text-white hover:bg-[#243044]"
                    }`}
                  >
                    {confirmedCode === selected.anzscoCode
                      ? "Occupation selected"
                      : "Select this occupation"}
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                  {/* Matched */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-[#e8eef4] bg-[#fbfcfd] p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-[#1a2332]">
                        Matched subjects
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#6b7a8d]">
                        Transcript → rubric mapping
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      <div>
                        <TierGroupHeader
                          title="Tier 1 · Foundational"
                          coverage={tier1Coverage}
                        />
                        {matchedTier1.length ? (
                          <ul className="space-y-2">
                            {matchedTier1.map((m, i) => {
                              const badge = methodBadge(m.method);
                              return (
                                <li
                                  key={`m1-${m.transcriptName}-${m.rubricSubject}-${i}`}
                                  className="rounded-lg bg-white px-2.5 py-2"
                                >
                                  <p className="text-xs font-medium text-[#1a2332]">
                                    {m.transcriptName}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#6b7a8d]">
                                    → {m.rubricSubject}
                                  </p>
                                  <span
                                    className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <EmptyListNote text="No Tier 1 matches" />
                        )}
                      </div>

                      <div>
                        <TierGroupHeader
                          title="Tier 2 · Core"
                          coverage={tier2Coverage}
                        />
                        {matchedTier2.length ? (
                          <ul className="space-y-2">
                            {matchedTier2.map((m, i) => {
                              const badge = methodBadge(m.method);
                              return (
                                <li
                                  key={`m2-${m.transcriptName}-${m.rubricSubject}-${i}`}
                                  className="rounded-lg bg-white px-2.5 py-2"
                                >
                                  <p className="text-xs font-medium text-[#1a2332]">
                                    {m.transcriptName}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#6b7a8d]">
                                    → {m.rubricSubject}
                                  </p>
                                  <span
                                    className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <EmptyListNote text="No Tier 2 matches" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Missing */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-[#e8eef4] bg-[#fbfcfd] p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-[#1a2332]">
                        Missing subjects
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#6b7a8d]">
                        Rubric subjects not covered
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      <div>
                        <TierGroupHeader
                          title="Tier 1 · Foundational"
                          coverage={tier1Coverage}
                        />
                        {missingTier1.length ? (
                          <ul className="space-y-1.5">
                            {missingTier1.map((name) => (
                              <li
                                key={`miss1-${name}`}
                                className="rounded-lg bg-white px-2.5 py-2 text-xs text-[#3d4f63]"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyListNote text="All Tier 1 expected subjects covered" />
                        )}
                      </div>

                      <div>
                        <TierGroupHeader
                          title="Tier 2 · Core"
                          coverage={tier2Coverage}
                        />
                        {missingTier2.length ? (
                          <ul className="space-y-1.5">
                            {missingTier2.map((name) => (
                              <li
                                key={`miss2-${name}`}
                                className="rounded-lg bg-white px-2.5 py-2 text-xs text-[#3d4f63]"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyListNote text="All Tier 2 core subjects covered" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unclassified */}
                  <div className="flex h-[26rem] flex-col rounded-xl border border-[#e8eef4] bg-[#fbfcfd] p-3.5">
                    <div className="mb-3 shrink-0">
                      <h3 className="text-sm font-semibold text-[#1a2332]">
                        Unclassified subjects
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#6b7a8d]">
                        Informational — not counted in coverage
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                      {unclassified.length ? (
                        <ul className="space-y-1.5">
                          {unclassified.map((u, i) => (
                            <li
                              key={`u-${u.name}-${i}`}
                              className="rounded-lg bg-white px-2.5 py-2 text-xs text-[#3d4f63]"
                            >
                              {u.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyListNote text="No unclassified transcript subjects" />
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {confirmedCode ? (
                <p className="text-center text-xs text-[#6b7a8d]">
                  Selected for next phase:{" "}
                  <span className="font-medium text-[#1a2332]">
                    {
                      candidates.find((c) => c.anzscoCode === confirmedCode)
                        ?.title
                    }{" "}
                    ({confirmedCode})
                  </span>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[#d5dde8] bg-white px-5 py-2.5 text-sm font-medium text-[#1a2332]"
        >
          Back
        </button>
        {assessment && !loading ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-[#d5dde8] bg-white px-5 py-2.5 text-sm font-medium text-[#1a2332]"
          >
            Re-run matching
          </button>
        ) : null}
      </div>
    </div>
  );
}
