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

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;
const SAVED_LINK = "__saved";

const SELECT_CLASS =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-50";

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
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="mb-1.5 block text-sm font-medium text-ink">
        Evidence included
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {CAREER_EPISODE_EVIDENCE_OPTIONS.map((o) => (
          <label
            key={o.field}
            className="flex cursor-pointer items-center gap-2 has-[:disabled]:cursor-default has-[:disabled]:opacity-50"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={Boolean(value[o.field])}
              onChange={(e) => onChange(o.field, e.target.checked)}
            />
            <span className="text-sm text-ink">{o.label}</span>
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
    <section className="mb-5 rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_1px_0_rgba(36,31,42,0.04)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink">
          Career episodes / projects
        </h2>
        <p className="text-xs text-ink-muted">
          Upload one file per career episode or project. Saved with the case.
        </p>
      </div>

      {error ? <p className="mb-3 text-sm text-[#b45309]">{error}</p> : null}

      <div className="space-y-4">
        {episodes.map((ep, i) => {
          const busy = busyKey === ep.id;
          return (
            <div key={ep.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Career episode {i + 1}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-[#b45309] disabled:opacity-50"
                  onClick={() => void removeSaved(ep)}
                >
                  Remove
                </button>
              </div>
              <div className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">
                  {ep.originalName}
                </p>
                <p className="text-xs text-ink-muted">
                  {ep.format} · {formatSize(ep.sizeBytes)}
                  {busy ? " · Saving…" : " · Saved"}
                </p>
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
              className="rounded-xl border border-dashed border-line-strong p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Career episode {episodes.length + i + 1}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-[#b45309] disabled:opacity-50"
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
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  Career episode / project file
                </span>
                <input
                  type="file"
                  accept={ACCEPT}
                  disabled={busy || !caseId}
                  onChange={(e) => {
                    void uploadPending(entry, e.target.files);
                    e.target.value = "";
                  }}
                  className="w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand"
                />
              </label>
              <p className="mt-1 text-xs text-ink-muted">
                {busy ? "Uploading…" : "Choose a file to save this entry."}
              </p>
            </div>
          );
        })}

        {!total ? (
          <p className="text-sm text-ink-muted">No career episodes yet.</p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!caseId}
        className="mt-3 text-sm font-medium text-brand disabled:opacity-50"
        onClick={addEntry}
      >
        + Add career episode
      </button>
    </section>
  );
}
