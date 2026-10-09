"use client";

import { useEffect, useState } from "react";
import {
  deleteCareerEpisode,
  listCareerEpisodes,
  updateCareerEpisode,
  uploadCareerEpisode,
  type CareerEpisodeLink,
} from "@/lib/api";
import {
  CAREER_EPISODE_EVIDENCE_OPTIONS,
  PROJECT_SOURCE_OPTIONS,
  type CareerEpisode,
  type CareerEpisodeEvidence,
  type CareerEpisodeEvidenceField,
  type ExperienceRow,
  type ProjectSource,
} from "@/lib/types";
import {
  BTN_GHOST_DANGER,
  BTN_SECONDARY,
  CARD,
  FileChip,
  PlusIcon,
  SectionHeader,
  UploadTile,
} from "@/components/wizard/UploadTile";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;
const SAVED_LINK = "__saved";

const SELECT_CLASS =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 disabled:opacity-50";

const EMPTY_EVIDENCE: CareerEpisodeEvidence = {
  hasCalculations: false,
  hasDrawingsCad: false,
  hasDataTables: false,
  hasSiteProductImages: false,
  hasStandardsReferenced: false,
  hasQuantifiableOutcomes: false,
};

type PendingEntry = {
  key: string;
  projectSource: ProjectSource | "";
  linkIndex: string;
  evidence: CareerEpisodeEvidence;
};

type ExperienceOption = { index: number; row: ExperienceRow; label: string };

/** "Title — Employer (start – end)" for the linked-experience dropdown. */
export function experienceLabel(row: ExperienceRow): string {
  const title = (row.title ?? "").trim() || "Untitled role";
  const employer = (row.employer ?? "").trim();
  const dates = [row.start, row.end]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" – ");
  return `${title}${employer ? ` — ${employer}` : ""}${dates ? ` (${dates})` : ""}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function linkFromIndex(
  options: ExperienceOption[],
  value: string,
): Pick<CareerEpisodeLink, "experienceRowId" | "experienceLabel"> {
  const opt = options.find((o) => String(o.index) === value);
  if (!opt) return { experienceRowId: null, experienceLabel: null };
  return { experienceRowId: opt.row.id ?? null, experienceLabel: opt.label };
}

/** Match a saved link to the current experience rows (by id, then by label). */
function linkedValue(options: ExperienceOption[], ep: CareerEpisode): string {
  const byId = ep.experienceRowId
    ? options.find((o) => o.row.id === ep.experienceRowId)
    : undefined;
  if (byId) return String(byId.index);
  const byLabel = ep.experienceLabel
    ? options.find((o) => o.label === ep.experienceLabel)
    : undefined;
  if (byLabel) return String(byLabel.index);
  return ep.experienceLabel ? SAVED_LINK : "";
}

function ExperienceSelect({
  options,
  value,
  savedLabel,
  disabled,
  onChange,
}: {
  options: ExperienceOption[];
  value: string;
  savedLabel?: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        Linked CV experience
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">
          {options.length ? "Not linked" : "No work experience extracted yet"}
        </option>
        {value === SAVED_LINK && savedLabel ? (
          <option value={SAVED_LINK}>{savedLabel} (no longer in list)</option>
        ) : null}
        {options.map((o) => (
          <option key={o.index} value={String(o.index)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceSelect({
  value,
  disabled,
  onChange,
}: {
  value: ProjectSource | "";
  disabled?: boolean;
  onChange: (value: ProjectSource | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        Project source
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ProjectSource | "")}
        className={SELECT_CLASS}
      >
        <option value="">Select project source</option>
        {PROJECT_SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Horizontal row of manual evidence ticks (wraps on narrow screens). */
function EvidenceChecks({
  value,
  disabled,
  onChange,
}: {
  value: CareerEpisodeEvidence;
  disabled?: boolean;
  onChange: (field: CareerEpisodeEvidenceField, checked: boolean) => void;
}) {
  return (
    <fieldset className="mt-4" disabled={disabled}>
      <legend className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Evidence included
      </legend>
      <div className="flex flex-wrap gap-2">
        {CAREER_EPISODE_EVIDENCE_OPTIONS.map((o) => (
          <label
            key={o.field}
            className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted ring-1 ring-line transition hover:ring-brand-muted has-[:checked]:bg-brand-soft has-[:checked]:text-brand-deeper has-[:checked]:ring-brand-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring has-[:disabled]:cursor-default has-[:disabled]:opacity-50"
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={Boolean(value[o.field])}
              onChange={(e) => onChange(o.field, e.target.checked)}
            />
            <span
              aria-hidden
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line-strong bg-surface text-white peer-checked:border-brand peer-checked:bg-brand"
            >
              <svg viewBox="0 0 20 20" className="h-2.5 w-2.5 fill-current">
                <path d="M8.1 13.6L4.5 10l1.1-1.1 2.5 2.5 6.3-6.3 1.1 1.1-7.4 7.4z" />
              </svg>
            </span>
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function evidenceOf(ep: CareerEpisode): CareerEpisodeEvidence {
  return {
    hasCalculations: Boolean(ep.hasCalculations),
    hasDrawingsCad: Boolean(ep.hasDrawingsCad),
    hasDataTables: Boolean(ep.hasDataTables),
    hasSiteProductImages: Boolean(ep.hasSiteProductImages),
    hasStandardsReferenced: Boolean(ep.hasStandardsReferenced),
    hasQuantifiableOutcomes: Boolean(ep.hasQuantifiableOutcomes),
  };
}

/**
 * Step 1 — career episodes / projects. Upload and save only; nothing here feeds
 * parsing, assessment or risk. Loads its own list so the case payload is unchanged.
 */
export function CareerEpisodesSection({
  caseId,
  experience,
}: {
  caseId: string | null;
  experience: ExperienceRow[];
}) {
  const [episodes, setEpisodes] = useState<CareerEpisode[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    listCareerEpisodes(caseId)
      .then((res) => {
        if (alive) setEpisodes(res.episodes);
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(
            `Could not load career episodes: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  const options: ExperienceOption[] = experience
    .map((row, index) => ({ index, row, label: experienceLabel(row) }))
    .filter(
      (o) => (o.row.title ?? "").trim() || (o.row.employer ?? "").trim(),
    );

  function addEntry() {
    setPending((rows) => [
      ...rows,
      {
        key: `new-${Date.now()}-${rows.length}`,
        projectSource: "",
        linkIndex: "",
        evidence: { ...EMPTY_EVIDENCE },
      },
    ]);
  }

  async function uploadPending(entry: PendingEntry, files: FileList | null) {
    const file = files?.[0];
    if (!file || !caseId) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File exceeds the 10 MB size limit");
      return;
    }
    if (!/\.(pdf|png|jpe?g|docx)$/i.test(file.name)) {
      setError("Accepted formats: PDF, PNG, JPG, DOCX");
      return;
    }
    setBusyKey(entry.key);
    try {
      const res = await uploadCareerEpisode(caseId, file, {
        projectSource: entry.projectSource || null,
        ...linkFromIndex(options, entry.linkIndex),
        ...entry.evidence,
      });
      setPending((rows) => rows.filter((r) => r.key !== entry.key));
      setEpisodes(res.episodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function saveLink(ep: CareerEpisode, link: CareerEpisodeLink) {
    if (!caseId) return;
    setError(null);
    setBusyKey(ep.id);
    try {
      const res = await updateCareerEpisode(caseId, ep.id, link);
      setEpisodes(res.episodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  /** Tick/untick on a saved entry: show it immediately, save, revert on error. */
  async function saveEvidence(
    ep: CareerEpisode,
    field: CareerEpisodeEvidenceField,
    checked: boolean,
  ) {
    if (!caseId) return;
    setError(null);
    setBusyKey(ep.id);
    setEpisodes((rows) =>
      rows.map((r) => (r.id === ep.id ? { ...r, [field]: checked } : r)),
    );
    try {
      const res = await updateCareerEpisode(caseId, ep.id, { [field]: checked });
      setEpisodes(res.episodes);
    } catch (err) {
      setEpisodes((rows) =>
        rows.map((r) => (r.id === ep.id ? { ...r, [field]: !checked } : r)),
      );
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function removeSaved(ep: CareerEpisode) {
    if (!caseId) return;
    if (!window.confirm(`Remove career episode "${ep.originalName}"?`)) return;
    setError(null);
    setBusyKey(ep.id);
    try {
      const res = await deleteCareerEpisode(caseId, ep.id);
      setEpisodes(res.episodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  const total = episodes.length + pending.length;

  return (
    <section className={CARD}>
      <SectionHeader
        title="Career episodes / projects"
        description="Upload one file per career episode or project. Saved with the case."
        action={
          <button
            type="button"
            disabled={!caseId}
            className={BTN_SECONDARY}
            onClick={addEntry}
          >
            <PlusIcon />
            Add career episode
          </button>
        }
      />

      {error ? (
        <p role="alert" className="mb-3 text-sm text-[#b45309]">{error}</p>
      ) : null}

      <div className="space-y-3">
        {episodes.map((ep, i) => {
          const busy = busyKey === ep.id;
          return (
            <div key={ep.id} className="rounded-xl border border-line bg-surface-subtle p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Career episode {i + 1}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className={BTN_GHOST_DANGER}
                  aria-label={`Remove career episode ${i + 1}`}
                  onClick={() => void removeSaved(ep)}
                >
                  Remove
                </button>
              </div>
              <div className="mb-3">
                <FileChip
                  name={ep.originalName}
                  format={ep.format}
                  meta={`${ep.format} · ${formatSize(ep.sizeBytes)}`}
                  status={busy ? "uploading" : "saved"}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SourceSelect
                  value={ep.projectSource ?? ""}
                  disabled={busy}
                  onChange={(v) => void saveLink(ep, { projectSource: v || null })}
                />
                <ExperienceSelect
                  options={options}
                  value={linkedValue(options, ep)}
                  savedLabel={ep.experienceLabel}
                  disabled={busy}
                  onChange={(v) => {
                    if (v === SAVED_LINK) return;
                    void saveLink(ep, linkFromIndex(options, v));
                  }}
                />
              </div>
              <EvidenceChecks
                value={evidenceOf(ep)}
                disabled={busy}
                onChange={(field, checked) =>
                  void saveEvidence(ep, field, checked)
                }
              />
            </div>
          );
        })}

        {pending.map((entry, i) => {
          const busy = busyKey === entry.key;
          return (
            <div
              key={entry.key}
              className="rounded-xl border border-dashed border-line-strong bg-surface-subtle p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Career episode {episodes.length + i + 1}
                  <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
                    not saved yet
                  </span>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className={BTN_GHOST_DANGER}
                  aria-label={`Remove career episode ${episodes.length + i + 1}`}
                  onClick={() =>
                    setPending((rows) => rows.filter((r) => r.key !== entry.key))
                  }
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SourceSelect
                  value={entry.projectSource}
                  disabled={busy}
                  onChange={(v) =>
                    setPending((rows) =>
                      rows.map((r) =>
                        r.key === entry.key ? { ...r, projectSource: v } : r,
                      ),
                    )
                  }
                />
                <ExperienceSelect
                  options={options}
                  value={entry.linkIndex}
                  disabled={busy}
                  onChange={(v) =>
                    setPending((rows) =>
                      rows.map((r) =>
                        r.key === entry.key ? { ...r, linkIndex: v } : r,
                      ),
                    )
                  }
                />
              </div>
              <EvidenceChecks
                value={entry.evidence}
                disabled={busy}
                onChange={(field, checked) =>
                  setPending((rows) =>
                    rows.map((r) =>
                      r.key === entry.key
                        ? { ...r, evidence: { ...r.evidence, [field]: checked } }
                        : r,
                    ),
                  )
                }
              />
              <div className="mt-4">
                <UploadTile
                  label="Career episode file"
                  accept={ACCEPT}
                  busy={busy}
                  disabled={!caseId}
                  onFiles={(files) => void uploadPending(entry, files)}
                />
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  The entry is saved as soon as a file is uploaded.
                </p>
              </div>
            </div>
          );
        })}

        {!total ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
            No career episodes yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
