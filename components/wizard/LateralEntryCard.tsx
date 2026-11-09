"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  answerLateralEntry,
  deleteDocument,
  getTranscriptData,
  readPriorStudySubjects,
  uploadPriorStudyTranscript,
} from "@/lib/api";
import type { LateralEntryView, TranscriptDataSummary } from "@/lib/types";
import {
  BTN_GHOST_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FOCUS_RING,
  FileChip,
  Spinner,
  UploadTile,
  type ChipStatus,
} from "./UploadTile";

type Answer = "yes" | "no";

const POLL_MS = 3000;

function chipStatus(status: string): ChipStatus {
  if (status === "DONE") return "done";
  if (status === "FAILED") return "failed";
  return "processing";
}

function YesNo({
  value,
  disabled,
  onChange,
  label,
}: {
  value: Answer | null;
  disabled?: boolean;
  onChange: (v: Answer) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-subtle p-0.5">
      {(["yes", "no"] as const).map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`min-w-[64px] rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${
              on ? "bg-brand text-white shadow-[0_2px_8px_rgba(146,86,169,0.25)]" : "text-ink hover:bg-brand-soft/60"
            }`}
          >
            {v === "yes" ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

/** True when Verify details must hold Continue until the lateral-entry check is answered. */
export function lateralEntryNeedsAnswer(view: LateralEntryView | null | undefined): boolean {
  return Boolean(view && view.route !== 1 && view.route !== 4 && view.step !== "done");
}

/** One-line status for the Verify details row. */
function statusLine(view: LateralEntryView, reading: boolean, error: string | null): string {
  const docs = view.priorDocuments;
  if (view.step === "ask") return "Not answered yet";
  if (view.step === "reconfirm") return "The transcript suggests earlier credit. Please confirm again.";
  if (view.step === "upload") {
    if (error) return "Earlier-study subjects could not be read";
    if (!docs.length) return "Yes. Upload the earlier-study transcript.";
    if (reading || docs.some((d) => d.status === "QUEUED" || d.status === "EXTRACTING")) {
      return "Yes. Reading the earlier-study transcript…";
    }
    return "Yes. Earlier-study subjects still needed.";
  }
  if (view.route === 3) {
    const n = view.priorSubjects?.length ?? 0;
    return `Yes. ${n} earlier-study ${n === 1 ? "subject" : "subjects"} read.`;
  }
  return view.reason;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible modal: backdrop, Esc to close, focus kept inside, focus restored on close. */
function Modal({
  titleId,
  title,
  onClose,
  children,
  footer,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        node.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !node.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !node.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(36,31,42,0.45)] p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`rounded-full p-1.5 text-ink-muted transition hover:bg-surface-tint hover:text-ink ${FOCUS_RING}`}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>
      </div>
    </div>
  );
}

/**
 * Verify details: lateral-entry check for a bachelor under four years. A slim
 * status row in the layout; the question, re-confirmation and earlier-study
 * upload live in a dialog (opened by the parent or from the row).
 */
export function LateralEntrySection({
  caseId,
  view,
  onChange,
  open,
  onOpenChange,
}: {
  caseId: string;
  view: LateralEntryView;
  onChange: (data: TranscriptDataSummary) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState<"answer" | "upload" | "read" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readFor = useRef<string | null>(null);

  const docs = view.priorDocuments;
  const pending = docs.some((d) => d.status === "QUEUED" || d.status === "EXTRACTING");
  const readyKey = docs.filter((d) => d.status === "DONE").map((d) => d.id).sort().join(",");
  const needsRead = view.step === "upload" && !pending && readyKey !== "";

  // While a file is processing, refresh until it is ready (dialog open or not).
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      getTranscriptData(caseId).then(onChange).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, caseId, onChange]);

  // Once the files are ready, make sure the earlier study's subjects are read
  // (the server reads them too; this call returns at once when already done).
  useEffect(() => {
    if (!needsRead || readFor.current === readyKey) return;
    readFor.current = readyKey;
    setBusy("read");
    setError(null);
    readPriorStudySubjects(caseId)
      .then(onChange)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(null));
  }, [needsRead, readyKey, caseId, onChange]);

  async function run(kind: string, fn: () => Promise<TranscriptDataSummary | void>) {
    setBusy(kind);
    setError(null);
    try {
      const data = await fn();
      onChange(data ?? (await getTranscriptData(caseId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const answer = (question: "answer" | "confirm", v: Answer) =>
    run("answer", () => answerLateralEntry(caseId, question, v));

  const upload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    readFor.current = null;
    void run("upload", async () => {
      await uploadPriorStudyTranscript(caseId, file);
    });
  };

  const remove = (id: string) => {
    readFor.current = null;
    void run(id, () => deleteDocument(caseId, id));
  };

  const retryRead = () => {
    readFor.current = readyKey;
    void run("read", () => readPriorStudySubjects(caseId));
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const first = view.answer?.value ?? null;
  const again = view.confirm?.value ?? null;
  const showReconfirm = first === "no" && view.contradiction.fired;
  const lateral = first === "yes" || again === "yes";
  const locked = busy !== null;
  const resolved = view.step === "done";
  const reading = busy === "read" || (view.step === "upload" && pending);

  if (view.route === 4) {
    return (
      <section className="mb-5 rounded-2xl border border-[#fdba74] bg-[#fffaf3] px-5 py-4">
        <h3 className="text-base font-semibold text-ink">Lateral entry</h3>
        <p className="mt-1 text-sm text-ink-muted">{view.reason}</p>
      </section>
    );
  }

  return (
    <>
      <section
        aria-label="Lateral entry"
        className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 ${
          resolved && !view.flagged ? "border-line bg-card" : "border-[#fdba74] bg-[#fffaf3]"
        }`}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">Lateral entry</h3>
          <p className="mt-0.5 text-sm leading-snug text-ink-muted">{statusLine(view, reading, error)}</p>
        </div>
        <button
          type="button"
          className={BTN_SECONDARY}
          aria-haspopup="dialog"
          onClick={() => onOpenChange(true)}
        >
          {resolved ? "Review" : view.step === "ask" ? "Answer" : "Open"}
        </button>
      </section>

      {open ? (
        <Modal
          titleId="lateral-entry-title"
          title="Lateral entry"
          onClose={close}
          footer={
            resolved ? (
              <button type="button" className={BTN_PRIMARY} onClick={close}>
                Done
              </button>
            ) : (
              <button type="button" className={BTN_SECONDARY} onClick={close}>
                Close
              </button>
            )
          }
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-ink-muted">
                The bachelor is under four years. Did the applicant enter it through lateral entry,
                credit transfer or advanced standing?
              </p>
              <YesNo label="Lateral entry" value={first} disabled={locked} onChange={(v) => void answer("answer", v)} />
            </div>

            {showReconfirm ? (
              <div className="space-y-3 rounded-xl border border-[#fdba74] bg-[#fffaf3] px-4 py-3">
                <p className="text-sm text-ink">
                  Transcript suggests earlier credit: {view.contradiction.reasons.join(" and ")}. Confirm again?
                </p>
                <YesNo label="Confirm lateral entry" value={again} disabled={locked} onChange={(v) => void answer("confirm", v)} />
              </div>
            ) : null}

            {lateral ? (
              <div className="space-y-2">
                {docs.map((d) => (
                  <FileChip
                    key={d.id}
                    name={d.name}
                    format={d.format}
                    status={chipStatus(d.status)}
                    error={d.status === "FAILED" ? d.error || "Could not read this file." : null}
                    actions={
                      <button
                        type="button"
                        className={BTN_GHOST_DANGER}
                        disabled={locked}
                        onClick={() => remove(d.id)}
                      >
                        {busy === d.id ? "Removing…" : "Remove"}
                      </button>
                    }
                  />
                ))}
                <UploadTile
                  label="Earlier-study transcript"
                  compact={docs.length > 0}
                  busy={busy === "upload"}
                  disabled={locked}
                  onFiles={upload}
                />
              </div>
            ) : null}

            <div aria-live="polite">
              {busy === "read" ? (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Spinner />
                  Reading earlier-study subjects…
                </p>
              ) : error ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-[#b45309]">{error}</p>
                  {needsRead ? (
                    <button type="button" className={BTN_SECONDARY} onClick={retryRead}>
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : resolved ? (
                <p className="rounded-xl bg-surface-subtle px-4 py-3 text-sm font-medium text-ink">{view.reason}</p>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** Lateral-entry route shown after Verify details (routes 2–4 only). */
export function lateralRouteLine(view: LateralEntryView | null | undefined): string | null {
  if (!view || view.route == null || view.route === 1) return null;
  return view.reason;
}

/** Slim one-line route note for the Assessment step. */
export function LateralEntryLine({ view }: { view: LateralEntryView | null | undefined }) {
  const line = lateralRouteLine(view);
  if (!line) return null;
  const warn = view!.flagged || view!.route === 4;
  return (
    <section
      aria-label="Lateral entry"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 ${
        warn ? "border-[#fdba74] bg-[#fffaf3]" : "border-line bg-card"
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Lateral entry</span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-ink">{line}</span>
    </section>
  );
}
