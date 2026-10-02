"use client";

import type { AssessmentResult } from "@/lib/types";

function pct(n: number): string {
  return `${n}%`;
}

function determinationLabel(d: string): string {
  switch (d) {
    case "verified_no_risk":
      return "Verified — No Risk";
    case "conditional":
      return "Conditional — Manual Review";
    case "not_verified":
      return "Not Verified";
    case "no_match":
      return "No Match";
    default:
      return d;
  }
}

export function Step3Assessment({
  assessment,
  loading,
  error,
  onBack,
  onRetry,
}: {
  assessment: AssessmentResult | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-[#1a2332]">
          Assessment
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-[#6b7a8d]">
          ANZSCO recommendation from transcript subjects matched against the
          Chemical Engineer (233111) rubric.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-[#d5dde8] bg-white/90 p-8 text-center">
          <p className="text-sm font-medium text-[#1a2332]">
            Running assessment…
          </p>
          <p className="mt-2 text-xs text-[#6b7a8d]">
            Extracting subjects and matching against the rubric. This may take a
            minute.
          </p>
        </div>
      ) : null}

      {error && !loading ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">{error}</p>
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
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6b7a8d]">
              Recommendation
            </p>
            {assessment.recommended ? (
              <>
                <p className="mt-2 text-2xl font-semibold text-[#1a2332]">
                  {assessment.anzscoCode} — {assessment.title ?? "Chemical Engineer"}
                </p>
                <p className="mt-1 text-sm text-[#2c5f8a]">
                  Confidence:{" "}
                  <span className="font-semibold capitalize">
                    {assessment.confidence}
                  </span>
                  {" · "}
                  {determinationLabel(assessment.determination)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-semibold text-[#1a2332]">
                  No match
                </p>
                <p className="mt-1 text-sm text-[#6b7a8d]">
                  Transcript does not meet the Chemical Engineer (233111)
                  thresholds for an automatic recommendation.
                </p>
              </>
            )}
            {assessment.explanation ? (
              <p className="mt-4 text-sm leading-relaxed text-[#3d4f63]">
                {assessment.explanation}
              </p>
            ) : null}
            {assessment.workExperienceBoost ? (
              <p className="mt-2 text-xs text-emerald-700">
                Related chemical-engineering work experience applied as a
                positive confidence boost.
              </p>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6b7a8d]">
                Foundational (Tier 1)
              </p>
              <p className="mt-2 text-xl font-semibold text-[#1a2332]">
                {assessment.foundationalMatched}/{assessment.foundationalExpected}
                <span className="ml-2 text-base font-normal text-[#6b7a8d]">
                  ({pct(assessment.foundationalPct)})
                </span>
              </p>
              <p className="mt-1 text-xs text-[#6b7a8d]">
                Outcome: {assessment.tier1Outcome ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6b7a8d]">
                Core (Tier 2)
              </p>
              <p className="mt-2 text-xl font-semibold text-[#1a2332]">
                {assessment.coreMatched}/{assessment.coreExpected}
                <span className="ml-2 text-base font-normal text-[#6b7a8d]">
                  ({pct(assessment.corePct)})
                </span>
              </p>
              <p className="mt-1 text-xs text-[#6b7a8d]">
                Outcome: {assessment.tier2Outcome ?? "—"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6b7a8d]">
              Project / training gate (Tier 3)
            </p>
            <p className="mt-2 text-sm text-[#1a2332]">
              Major project / thesis / capstone:{" "}
              <span className="font-semibold">
                {assessment.tier3GateMet ? "Present" : "Not found"}
              </span>
            </p>
            {assessment.qualificationsUsed?.length ? (
              <p className="mt-1 text-xs text-[#6b7a8d]">
                Qualifications used: {assessment.qualificationsUsed.join(", ")}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
            <h2 className="text-sm font-semibold text-[#1a2332]">
              Extracted subjects
              {assessment.extractedSubjects?.length
                ? ` (${assessment.extractedSubjects.length})`
                : ""}
            </h2>
            <p className="mt-1 text-xs text-[#6b7a8d]">
              Raw rows taken from the transcript before rubric matching.
            </p>
            {assessment.extractedSubjects?.length ? (
              <>
                <div className="mt-3 max-h-72 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white text-[#6b7a8d]">
                      <tr>
                        <th className="py-1.5 pr-2 font-medium">Name</th>
                        <th className="py-1.5 pr-2 font-medium">Code</th>
                        <th className="py-1.5 pr-2 font-medium">Credits</th>
                        <th className="py-1.5 pr-2 font-medium">Grade</th>
                        <th className="py-1.5 pr-2 font-medium">Year / sem</th>
                        <th className="py-1.5 pr-2 font-medium">Qual</th>
                        <th className="py-1.5 font-medium">Repeat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.extractedSubjects.map((s, i) => (
                        <tr
                          key={`${s.name}-${s.code ?? ""}-${i}`}
                          className="border-t border-[#e8eef4]"
                        >
                          <td className="py-1.5 pr-2 text-[#1a2332]">{s.name}</td>
                          <td className="py-1.5 pr-2 text-[#6b7a8d]">
                            {s.code ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-[#6b7a8d]">
                            {s.credits ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-[#6b7a8d]">
                            {s.grade ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-[#6b7a8d]">
                            {s.yearOrSemester ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-[#6b7a8d]">
                            {s.qualification}
                          </td>
                          <td className="py-1.5 text-[#6b7a8d]">
                            {s.isRepeat ? "yes" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-[#2c5f8a]">
                    Show extracted JSON
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[#111827] p-3 text-[11px] leading-relaxed text-[#e5eef8] whitespace-pre-wrap break-words">
                    {JSON.stringify(assessment.extractedSubjects, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="mt-3 text-xs text-[#6b7a8d]">
                No extracted subjects on this result. Re-run assessment to
                refresh.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
            <h2 className="text-sm font-semibold text-[#1a2332]">
              Subject matches
            </h2>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-[#6b7a8d]">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">Transcript</th>
                    <th className="py-1.5 pr-2 font-medium">Rubric</th>
                    <th className="py-1.5 pr-2 font-medium">Tier</th>
                    <th className="py-1.5 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.matches
                    .filter((m) => m.rubricSubject)
                    .map((m, i) => (
                      <tr
                        key={`${m.transcriptName}-${m.rubricSubject}-${i}`}
                        className="border-t border-[#e8eef4]"
                      >
                        <td className="py-1.5 pr-2 text-[#1a2332]">
                          {m.transcriptName}
                        </td>
                        <td className="py-1.5 pr-2 text-[#3d4f63]">
                          {m.rubricSubject}
                        </td>
                        <td className="py-1.5 pr-2 text-[#6b7a8d]">{m.tier}</td>
                        <td className="py-1.5 text-[#6b7a8d]">{m.method}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!assessment.matches.some((m) => m.rubricSubject) ? (
                <p className="text-xs text-[#6b7a8d]">No subject matches.</p>
              ) : null}
            </div>
          </section>

          {assessment.unmatched.length ? (
            <section className="rounded-2xl border border-[#d5dde8] bg-white/90 p-5">
              <h2 className="text-sm font-semibold text-[#1a2332]">
                Unmatched subjects
              </h2>
              <ul className="mt-2 list-inside list-disc text-xs text-[#6b7a8d]">
                {assessment.unmatched.map((u, i) => (
                  <li key={`${u.name}-${i}`}>
                    {u.name}
                    {u.qualification !== "unknown"
                      ? ` (${u.qualification})`
                      : ""}
                  </li>
                ))}
              </ul>
            </section>
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
            Re-run assessment
          </button>
        ) : null}
      </div>
    </div>
  );
}
