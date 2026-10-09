"use client";

import { useId, useState, type ReactNode } from "react";

/** Shared upload UI for Step 1: dashed drop tile + compact file chip. Visual only. */

export const UPLOAD_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const UPLOAD_HINT = "PDF, PNG, JPG or DOCX · max 10 MB";

export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1";
export const BTN_PRIMARY = `rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(146,86,169,0.22)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${FOCUS_RING}`;
export const BTN_SECONDARY = `inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-brand-muted hover:bg-brand-soft/50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;
export const BTN_GHOST_DANGER = `rounded-full px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-[#f8ecec] hover:text-[#8a3a3a] disabled:opacity-50 ${FOCUS_RING}`;
export const CARD =
  "mb-5 rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)] sm:p-6";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PlusIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={`${className} fill-current`}>
      <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

export function FileIcon({ format }: { format?: string | null }) {
  const label = (format ?? "").toUpperCase().slice(0, 4) || "FILE";
  return (
    <span
      aria-hidden
      className="flex h-9 w-8 shrink-0 items-end justify-center rounded-md border border-line bg-surface-tint pb-1 text-[8.5px] font-bold tracking-wide text-brand-deeper"
    >
      {label}
    </span>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-muted border-t-brand"
    />
  );
}

/**
 * Compact dashed drop zone. Click (or Enter/Space via the hidden input) to browse,
 * or drop a file. Calls onFiles exactly like the old native input did.
 */
export function UploadTile({
  label,
  hint = UPLOAD_HINT,
  accept = UPLOAD_ACCEPT,
  disabled,
  busy,
  busyLabel = "Uploading…",
  compact,
  onFiles,
}: {
  label: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** Smaller "add another" variant once files exist. */
  compact?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const off = Boolean(disabled || busy);

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        if (off) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (off) return;
        onFiles(e.dataTransfer.files);
      }}
      className={`group flex items-center gap-3 rounded-xl border border-dashed px-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring ${
        compact ? "py-2" : "min-h-[64px] py-3"
      } ${
        off
          ? "cursor-not-allowed border-line bg-surface-subtle opacity-60"
          : over
            ? "cursor-copy border-brand bg-brand-soft"
            : "cursor-pointer border-line-strong bg-surface-subtle hover:border-brand-muted hover:bg-brand-soft/40"
      }`}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={off}
        aria-label={`Upload ${label}`}
        className="sr-only"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-surface text-brand ring-1 ring-line ${
          compact ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        {busy ? <Spinner /> : <UploadIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {busy ? busyLabel : compact ? `Add another ${label.toLowerCase()}` : label}
        </span>
        {!compact ? (
          <span className="block truncate text-[11px] text-ink-muted">
            {busy ? "Please wait" : (
              <>
                <span className="text-brand">Browse</span> or drop a file · {hint}
              </>
            )}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export type ChipStatus = "uploading" | "processing" | "done" | "failed" | "saved";

const CHIP_STATUS: Record<ChipStatus, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-brand-soft text-brand" },
  processing: { label: "Processing", className: "bg-brand-soft text-brand" },
  done: { label: "Ready", className: "bg-success-soft text-success ring-1 ring-success-line" },
  saved: { label: "Saved", className: "bg-success-soft text-success ring-1 ring-success-line" },
  failed: { label: "Failed", className: "bg-[#f8ecec] text-[#8a3a3a] ring-1 ring-[#e2c4c4]" },
};

/** Neat one-line file row: icon, truncated name, meta, status pill and actions. */
export function FileChip({
  name,
  format,
  meta,
  status,
  error,
  actions,
  children,
}: {
  name: string;
  format?: string | null;
  meta?: ReactNode;
  status: ChipStatus;
  error?: string | null;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const s = CHIP_STATUS[status];
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <FileIcon format={format} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink" title={name}>
            {name}
          </p>
          {meta ? <p className="truncate text-[11px] text-ink-muted">{meta}</p> : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}
        >
          {status === "uploading" || status === "processing" ? <Spinner /> : null}
          {s.label}
        </span>
        {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-[#b45309]">{error}</p> : null}
      {children}
    </div>
  );
}
