"use client";

import { useEffect, useState } from "react";
import { getCaseReview, saveCaseReview } from "@/lib/api";
import {
  CASE_REVIEW_COMMENT_MAX,
  type CaseReview,
  type CaseReviewStatus,
} from "@/lib/types";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const CARD = "rounded-2xl border border-line bg-surface/95 px-4 py-4 sm:px-5";

const STATUS_STYLE: Record<
  CaseReviewStatus,
  { label: string; badge: string; selected: string; idle: string }
> = {
  APPROVED: {
    label: "Approved",
    badge: "bg-success-soft text-success ring-1 ring-success-line",
    selected:
      "border-success bg-success-soft text-success ring-2 ring-success-line",
    idle: "border-line bg-surface text-ink hover:border-success hover:text-success",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]",
    selected:
      "border-[#8a3a3a] bg-[#f8ecec] text-[#8a3a3a] ring-2 ring-[#e2c4c4]",
    idle: "border-line bg-surface text-ink hover:border-[#8a3a3a] hover:text-[#8a3a3a]",
  },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Step 6 — manual approval. The reviewer picks Approve or Reject, optionally
 * adds a comment, and saves; the decision is stored per case (client).
 */
export function Step6Approval({
  caseId,
  onBack,
}: {
  caseId: string | null;
  onBack: () => void;
}) {
  const [saved, setSaved] = useState<CaseReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<CaseReviewStatus | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    getCaseReview(caseId)
      .then((res) => {
        if (!alive) return;
        setSaved(res.review);
        setChoice(res.review?.status ?? null);
        setComment(res.review?.comment ?? "");
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  const trimmed = comment.trim();
  const unchanged =
    saved != null &&
    choice === saved.status &&
    trimmed === (saved.comment ?? "").trim();
  const canSave = Boolean(caseId && choice && !saving && !unchanged);

  async function save() {
    if (!caseId || !choice) return;
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      const res = await saveCaseReview(caseId, {
        status: choice,
        comment: trimmed || null,
      });
      setSaved(res.review);
      setComment(res.review.comment ?? "");
      setLoadError(null);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const savedStyle = saved ? STATUS_STYLE[saved.status] : null;

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Approval
        </h1>
        <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          Approve or reject this client&apos;s case and add an optional comment.
          You can change the decision later.
        </p>
      </header>

      {!caseId ? (
        <p className="text-sm text-ink-muted">No case is open.</p>
      ) : (
        <div className="space-y-4">
          {/* Current saved status */}
          <section className={CARD}>
            <p className={`${LABEL} mb-3`}>Current status</p>
            {loading ? (
              <p className="text-sm text-ink-muted">Loading…</p>
            ) : loadError ? (
              <p className="text-sm text-[#b45309]">
                Could not load the saved decision: {loadError}
              </p>
            ) : saved && savedStyle ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${savedStyle.badge}`}
                  >
                    {savedStyle.label}
                  </span>
                  <span className="text-xs text-ink-muted">
                    Decided {formatWhen(saved.reviewedAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-ink">
                  {saved.comment?.trim() || (
                    <span className="text-ink-faint">No comment</span>
                  )}
                </p>
              </div>
            ) : (
              <span className="inline-flex rounded-full bg-surface-tint px-3 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line">
                Pending — no decision saved yet
              </span>
            )}
          </section>

          {/* Decision form */}
          <section className={CARD}>
            <p className={`${LABEL} mb-3`}>Decision</p>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              {(["APPROVED", "REJECTED"] as const).map((status) => {
                const style = STATUS_STYLE[status];
                const selected = choice === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    disabled={saving || loading}
                    onClick={() => {
                      setChoice(status);
                      setJustSaved(false);
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                      selected ? style.selected : style.idle
                    }`}
                  >
                    {selected ? "✓ " : ""}
                    {status === "APPROVED" ? "Approve" : "Reject"}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Comment <span className="font-normal text-ink-muted">(optional)</span>
              </span>
              <textarea
                value={comment}
                maxLength={CASE_REVIEW_COMMENT_MAX}
                disabled={saving || loading}
                rows={4}
                onChange={(e) => {
                  setComment(e.target.value);
                  setJustSaved(false);
                }}
                placeholder="Add a note about this decision"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-50"
              />
              <span className="mt-1 block text-right text-[11px] tabular-nums text-ink-faint">
                {comment.length}/{CASE_REVIEW_COMMENT_MAX}
              </span>
            </label>

            {saveError ? (
              <p className="mt-2 text-sm text-[#b45309]">{saveError}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canSave}
                onClick={() => void save()}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] hover:bg-brand-dark disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? "Saving…" : saved ? "Update decision" : "Save decision"}
              </button>
              <span className="text-xs text-ink-muted">
                {!choice
                  ? "Choose Approve or Reject first."
                  : justSaved
                    ? "Decision saved."
                    : unchanged
                      ? "No changes to save."
                      : ""}
              </span>
            </div>
          </section>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink"
        >
          Back
        </button>
        {saved?.status === "APPROVED" ? (
          <button
            type="button"
            onClick={() => {
              // Drop any ?case= and reload: the engine boots a fresh case at Step 1.
              window.history.replaceState(null, "", "/");
              window.location.reload();
            }}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] hover:bg-brand-dark"
          >
            Start new client
          </button>
        ) : null}
      </div>
    </div>
  );
}
