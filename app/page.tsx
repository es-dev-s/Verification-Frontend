"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmCase,
  createCase,
  deleteDocument,
  getCase,
  saveDraft,
  setStoredCaseId,
  startRead,
  uploadDocument,
} from "@/lib/api";
import {
  UNCERTAIN_THRESHOLD,
  emptyBachelors,
  emptyExperience,
  sourceLabel,
  type Bachelors,
  type CaseDocument,
  type CasePayload,
  type DocumentType,
  type ExperienceRow,
  type FieldSource,
} from "@/lib/types";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

type UploadType = DocumentType;

export default function Home() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payload, setPayload] = useState<CasePayload | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<UploadType>("CV");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bachelors, setBachelors] = useState<Bachelors>(emptyBachelors());
  const [experience, setExperience] = useState<ExperienceRow[]>([emptyExperience()]);
  const [fieldSources, setFieldSources] = useState<FieldSource[]>([]);
  const [fromCvOnly, setFromCvOnly] = useState(false);
  const [eduReading, setEduReading] = useState(false);
  const [expReading, setExpReading] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);
  const [expError, setExpError] = useState<string | null>(null);
  const [eduGeminiRaw, setEduGeminiRaw] = useState<unknown>(null);
  const [expGeminiRaw, setExpGeminiRaw] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [userEdited, setUserEdited] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const documents = payload?.documents ?? [];

  const applyCase = useCallback((row: CasePayload) => {
    setPayload(row);
    if (row.bachelors) {
      setBachelors({
        degreeTitle: row.bachelors.degreeTitle ?? "",
        institution: row.bachelors.institution ?? "",
        country: row.bachelors.country ?? "",
        durationYears: row.bachelors.durationYears,
        durationCalculated: row.bachelors.durationCalculated,
      });
    }
    if (row.experienceRows?.length) {
      setExperience(
        row.experienceRows.map((r) => ({
          id: r.id,
          employer: r.employer ?? "",
          title: r.title ?? "",
          start: r.start ?? "",
          end: r.end ?? "",
          statedDurationYears: r.statedDurationYears ?? null,
          domainSuggested: r.domainSuggested,
          domainFinal: r.domainFinal ?? false,
        })),
      );
    } else {
      setExperience([emptyExperience()]);
    }
    setFieldSources(row.fieldSources ?? []);
    const stale = (row.readJobs ?? []).some((j) => j.stale && j.status === "DONE");
    setStaleHint(stale);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always start a blank case — do not restore prior documents/reads.
        const created = await createCase();
        if (cancelled) return;
        setStoredCaseId(created.id);
        setCaseId(created.id);
        setBachelors(emptyBachelors());
        setExperience([emptyExperience()]);
        setFieldSources([]);
        setUserEdited(false);
        setStaleHint(false);
        const row = await getCase(created.id);
        applyCase(row);
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyCase]);

  const refreshCase = useCallback(async () => {
    if (!caseId) return;
    const row = await getCase(caseId);
    applyCase(row);
    return row;
  }, [applyCase, caseId]);

  useEffect(() => {
    if (!caseId) return;
    let delay = 1500;
    let alive = true;

    const tick = async () => {
      try {
        const row = await getCase(caseId);
        if (!alive) return;
        const busy = row.documents.some((d) =>
          ["QUEUED", "EXTRACTING"].includes(d.status),
        );
        // Avoid clobbering local edits while polling statuses
        setPayload((prev) =>
          prev
            ? {
                ...prev,
                documents: row.documents,
                readJobs: row.readJobs,
                status: row.status,
              }
            : row,
        );
        setStaleHint(
          (row.readJobs ?? []).some((j) => j.stale && j.status === "DONE"),
        );
        delay = busy ? 1500 : Math.min(delay * 1.4, 8000);
      } catch {
        delay = Math.min(delay * 1.5, 10000);
      }
      if (alive) {
        pollRef.current = setTimeout(tick, delay);
      }
    };

    pollRef.current = setTimeout(tick, delay);
    return () => {
      alive = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [caseId]);

  const draftBody = useMemo(
    () => ({
      bachelors: {
        ...bachelors,
        degreeTitle: bachelors.degreeTitle || null,
        institution: bachelors.institution || null,
        country: bachelors.country || null,
      },
      experienceRows: experience.map((r) => ({
        ...r,
        employer: r.employer || null,
        title: r.title || null,
        start: r.start || null,
        end: r.end || null,
        statedDurationYears: r.statedDurationYears ?? null,
      })),
      fieldFinals: Object.fromEntries(
        fieldSources.map((f) => [f.field, f.finalValue]),
      ),
    }),
    [bachelors, experience, fieldSources],
  );

  useEffect(() => {
    if (!caseId || !dirty) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      try {
        await saveDraft(caseId, draftBody);
        setSaveMsg("Draft saved");
        setDirty(false);
      } catch (err) {
        setSaveMsg(err instanceof Error ? err.message : "Draft save failed");
      }
    }, 1200);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [caseId, dirty, draftBody]);

  async function onUpload(fileList: FileList | null) {
    if (!fileList?.length || !caseId) return;
    setUploadError(null);
    const file = fileList[0]!;
    if (file.size > MAX_BYTES) {
      setUploadError("File exceeds the 10 MB size limit");
      return;
    }
    const okExt = /\.(pdf|png|jpe?g|docx)$/i.test(file.name);
    if (!okExt) {
      setUploadError("Accepted formats: PDF, PNG, JPG, DOCX");
      return;
    }
    setUploading(true);
    try {
      await uploadDocument(caseId, uploadType, file);
      await refreshCase();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteDoc(docId: string) {
    if (!caseId) return;
    await deleteDocument(caseId, docId);
    await refreshCase();
  }

  const eduDocsReady = useMemo(() => {
    const docs = documents.filter((d) =>
      ["CV", "TRANSCRIPT", "CERTIFICATE"].includes(d.type),
    );
    if (!docs.length) return false;
    return docs.every((d) => d.status === "DONE" || d.status === "FAILED") &&
      docs.some((d) => d.status === "DONE");
  }, [documents]);

  const eduBlocked = documents.some(
    (d) =>
      ["CV", "TRANSCRIPT", "CERTIFICATE"].includes(d.type) &&
      ["QUEUED", "EXTRACTING"].includes(d.status),
  );

  const cvReady = documents.some((d) => d.type === "CV" && d.status === "DONE");
  const cvBlocked = documents.some(
    (d) => d.type === "CV" && ["QUEUED", "EXTRACTING"].includes(d.status),
  );

  async function onReadEducation() {
    if (!caseId) return;
    if (userEdited) {
      const ok = window.confirm(
        "Read again will replace fields you edited. Continue?",
      );
      if (!ok) return;
    }
    setEduError(null);
    setEduReading(true);
    try {
      const started = await startRead(caseId, "education");
      if (started.status === "FAILED" || !started.result) {
        throw new Error(started.error ?? "Read failed");
      }
      applyEducationResult(started.result);
      await refreshCase();
      setUserEdited(false);
    } catch (err) {
      setEduError(err instanceof Error ? err.message : String(err));
    } finally {
      setEduReading(false);
    }
  }

  function applyEducationResult(result: unknown) {
    const r = result as {
      bachelors?: Bachelors | null;
      fields?: Record<
        string,
        {
          value: string | null;
          confidence: number | null;
          sourceDocumentId: string | null;
          documentType?: DocumentType | null;
          alternatives?: FieldSource["alternatives"];
          conflict?: boolean;
        }
      >;
      fromCvOnly?: boolean;
      geminiRaw?: unknown;
    };
    setEduGeminiRaw(r.geminiRaw ?? result);
    if (r.bachelors) {
      setBachelors({
        degreeTitle: r.bachelors.degreeTitle ?? "",
        institution: r.bachelors.institution ?? "",
        country: r.bachelors.country ?? "",
        durationYears: r.bachelors.durationYears ?? null,
        durationCalculated: Boolean(r.bachelors.durationCalculated),
      });
    }
    setFromCvOnly(Boolean(r.fromCvOnly));
    if (r.fields) {
      setFieldSources(
        Object.entries(r.fields).map(([field, meta]) => ({
          id: field,
          field,
          sourceDocumentId: meta.sourceDocumentId,
          extractedValue: meta.value,
          finalValue: meta.value,
          confidence: meta.confidence,
          alternatives: meta.alternatives ?? [],
        })),
      );
    }
    setDirty(true);
  }

  async function onReadExperience() {
    if (!caseId) return;
    if (userEdited) {
      const ok = window.confirm(
        "Read again will replace experience rows you edited. Continue?",
      );
      if (!ok) return;
    }
    setExpError(null);
    setExpReading(true);
    try {
      const started = await startRead(caseId, "experience");
      if (started.status === "FAILED" || !started.result) {
        throw new Error(started.error ?? "Read failed");
      }
      applyExperienceResult(started.result);
      await refreshCase();
      setUserEdited(false);
    } catch (err) {
      setExpError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpReading(false);
    }
  }

  function applyExperienceResult(result: unknown) {
    const r = result as { rows?: ExperienceRow[]; geminiRaw?: unknown };
    setExpGeminiRaw(r.geminiRaw ?? result);
    if (r.rows?.length) {
      setExperience(
        r.rows.map((row) => ({
          id: row.id,
          employer: row.employer ?? "",
          title: row.title ?? "",
          start: row.start ?? "",
          end: row.end ?? "",
          statedDurationYears: row.statedDurationYears ?? null,
          domainSuggested: row.domainSuggested,
          domainFinal: row.domainFinal ?? row.domainSuggested ?? false,
        })),
      );
    } else {
      setExperience([emptyExperience()]);
    }
    setDirty(true);
  }

  async function onConfirm() {
    if (!caseId) return;
    try {
      const row = await confirmCase(caseId, draftBody);
      applyCase(row);
      setSaveMsg("Confirmed");
      setDirty(false);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Confirm failed");
    }
  }

  function fieldMeta(field: string) {
    return fieldSources.find((f) => f.field === field);
  }

  function updateBachelor<K extends keyof Bachelors>(key: K, value: Bachelors[K]) {
    setBachelors((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setUserEdited(true);
  }

  function updateExperience(
    index: number,
    key: keyof ExperienceRow,
    value: string | boolean | number | null,
  ) {
    setExperience((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
    setDirty(true);
    setUserEdited(true);
  }

  if (bootError) {
    return (
      <div className="min-h-full bg-[#eef2f6] px-4 py-10">
        <main className="mx-auto max-w-2xl rounded-2xl border border-[#d5dde8] bg-white p-6">
          <h1 className="text-lg font-semibold text-[#1a2332]">Cannot reach API</h1>
          <p className="mt-2 text-sm text-[#6b7a8d]">{bootError}</p>
          <p className="mt-2 text-sm text-[#6b7a8d]">
            Start the API on port 3001 (`npm run dev` in api/) and ensure Postgres/Redis are up.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(900px_420px_at_12%_-8%,#d7e4f0_0%,transparent_55%),radial-gradient(700px_380px_at_100%_0%,#e2ebe3_0%,transparent_50%),#eef2f6] px-4 py-10 sm:px-6">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium tracking-wide text-[#5f7388]">
            Verification Engine
          </p>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-[#1a2332]">
            Case details
          </h1>
          <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-[#6b7a8d]">
            Upload CV, transcript, and certificate files. Read fills bachelor&apos;s
            education and work experience — you can always edit manually.
          </p>
          {saveMsg ? (
            <p className="mt-2 text-sm text-[#2c5f8a]">{saveMsg}</p>
          ) : null}
          {staleHint ? (
            <p className="mt-2 text-sm text-[#b45309]">
              Documents changed since the last Read — please Read again.
            </p>
          ) : null}
        </header>

        <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
          <h2 className="mb-3 text-base font-semibold text-[#1a2332]">Documents</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {(["CV", "TRANSCRIPT", "CERTIFICATE"] as UploadType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setUploadType(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  uploadType === t
                    ? "bg-[#2c5f8a] text-white"
                    : "bg-[#e8f0f7] text-[#2c5f8a]"
                }`}
              >
                {t === "CV" ? "CV" : t === "TRANSCRIPT" ? "Transcript" : "Certificate"}
              </button>
            ))}
          </div>
          <input
            type="file"
            accept={ACCEPT}
            disabled={uploading || !caseId}
            onChange={(e) => {
              void onUpload(e.target.files);
              e.target.value = "";
            }}
            className="w-full text-sm text-[#4b5c6e] file:mr-3 file:rounded-full file:border-0 file:bg-[#e8f0f7] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#2c5f8a]"
          />
          {uploadError ? (
            <p className="mt-2 text-sm text-[#b45309]">{uploadError}</p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {documents.map((doc) => (
              <DocRow key={doc.id} doc={doc} onDelete={() => void onDeleteDoc(doc.id)} />
            ))}
            {!documents.length ? (
              <li className="text-sm text-[#6b7a8d]">No documents uploaded yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1a2332]">
                Bachelor&apos;s education
              </h2>
              {fromCvOnly ? (
                <p className="text-xs text-[#6b7a8d]">from CV only</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!eduDocsReady || eduBlocked || eduReading}
              onClick={() => void onReadEducation()}
              className="rounded-full bg-[#2c5f8a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {eduReading ? "Reading…" : "Read"}
            </button>
          </div>
          {eduError ? (
            <p className="mb-3 text-sm text-[#b45309]">{eduError}</p>
          ) : null}
          {eduGeminiRaw != null ? (
            <DebugJson title="Gemini raw (education)" data={eduGeminiRaw} />
          ) : null}
          <div className="grid gap-3">
            <Field
              label="Degree title"
              value={bachelors.degreeTitle || ""}
              confidence={fieldMeta("degreeTitle")?.confidence}
              source={sourceLabel(
                documents.find((d) => d.id === fieldMeta("degreeTitle")?.sourceDocumentId)
                  ?.type,
              )}
              conflict={Boolean(fieldMeta("degreeTitle")?.alternatives?.length)}
              alternatives={fieldMeta("degreeTitle")?.alternatives}
              onPickAlt={(v) => updateBachelor("degreeTitle", v)}
              onChange={(v) => updateBachelor("degreeTitle", v)}
            />
            <Field
              label="Institution"
              value={bachelors.institution || ""}
              confidence={fieldMeta("institution")?.confidence}
              source={sourceLabel(
                documents.find((d) => d.id === fieldMeta("institution")?.sourceDocumentId)
                  ?.type,
              )}
              conflict={Boolean(fieldMeta("institution")?.alternatives?.length)}
              alternatives={fieldMeta("institution")?.alternatives}
              onPickAlt={(v) => updateBachelor("institution", v)}
              onChange={(v) => updateBachelor("institution", v)}
            />
            <Field
              label="Country"
              value={bachelors.country || ""}
              confidence={fieldMeta("country")?.confidence}
              source={sourceLabel(
                documents.find((d) => d.id === fieldMeta("country")?.sourceDocumentId)
                  ?.type,
              )}
              conflict={Boolean(fieldMeta("country")?.alternatives?.length)}
              alternatives={fieldMeta("country")?.alternatives}
              onPickAlt={(v) => updateBachelor("country", v)}
              onChange={(v) => updateBachelor("country", v)}
            />
            <Field
              label={
                bachelors.durationCalculated
                  ? "Study duration (years, calculated)"
                  : "Study duration (years)"
              }
              value={
                bachelors.durationYears != null ? String(bachelors.durationYears) : ""
              }
              confidence={fieldMeta("durationYears")?.confidence}
              source={sourceLabel(
                documents.find((d) => d.id === fieldMeta("durationYears")?.sourceDocumentId)
                  ?.type,
              )}
              conflict={Boolean(fieldMeta("durationYears")?.alternatives?.length)}
              alternatives={fieldMeta("durationYears")?.alternatives}
              onPickAlt={(v) =>
                updateBachelor("durationYears", v ? Number(v) : null)
              }
              onChange={(v) =>
                updateBachelor("durationYears", v === "" ? null : Number(v))
              }
            />
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#1a2332]">Work experience</h2>
            <button
              type="button"
              disabled={!cvReady || cvBlocked || expReading}
              onClick={() => void onReadExperience()}
              className="rounded-full bg-[#2c5f8a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {expReading ? "Reading…" : "Read"}
            </button>
          </div>
          {expError ? (
            <p className="mb-3 text-sm text-[#b45309]">{expError}</p>
          ) : null}
          {expGeminiRaw != null ? (
            <DebugJson title="Gemini raw (experience)" data={expGeminiRaw} />
          ) : null}
          <div className="space-y-4">
            {experience.map((row, index) => (
              <div
                key={row.id ?? index}
                className="rounded-xl border border-[#e4eaf2] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#6b7a8d]">
                    Role {index + 1}
                  </p>
                  {experience.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-[#b45309]"
                      onClick={() => {
                        setExperience((rows) => rows.filter((_, i) => i !== index));
                        setDirty(true);
                        setUserEdited(true);
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Employer"
                    value={row.employer || ""}
                    onChange={(v) => updateExperience(index, "employer", v)}
                  />
                  <Field
                    label="Title"
                    value={row.title || ""}
                    onChange={(v) => updateExperience(index, "title", v)}
                  />
                  <Field
                    label="Start"
                    value={row.start || ""}
                    onChange={(v) => updateExperience(index, "start", v)}
                  />
                  <Field
                    label="End"
                    value={row.end || ""}
                    onChange={(v) => updateExperience(index, "end", v)}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[#2c5f8a]"
            onClick={() => {
              setExperience((rows) => [...rows, emptyExperience()]);
              setDirty(true);
              setUserEdited(true);
            }}
          >
            + Add role
          </button>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="rounded-full bg-[#1a2332] px-5 py-2.5 text-sm font-medium text-white"
          >
            Confirm
          </button>
        </div>
      </main>
    </div>
  );
}

function DocRow({
  doc,
  onDelete,
}: {
  doc: CaseDocument;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const statusColor =
    doc.status === "DONE"
      ? "text-emerald-700 bg-emerald-50"
      : doc.status === "FAILED"
        ? "text-amber-800 bg-amber-50"
        : "text-[#2c5f8a] bg-[#e8f0f7]";
  const text = (doc.text ?? "").trim();
  const canShowText = doc.status === "DONE" && text.length > 0;

  return (
    <li className="rounded-xl border border-[#e4eaf2] px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1a2332]">
            {doc.originalName}
          </p>
          <p className="text-xs text-[#6b7a8d]">
            {doc.type} · {doc.format}
            {doc.extractionMethod ? ` · ${doc.extractionMethod}` : ""}
            {text ? ` · ${text.length} chars` : ""}
          </p>
          {doc.error ? (
            <p className="mt-1 text-xs text-[#b45309]">{doc.error}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
            {doc.status.toLowerCase()}
          </span>
          {canShowText ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs font-medium text-[#2c5f8a]"
            >
              {open ? "Hide text" : "Show text"}
            </button>
          ) : null}
          <button type="button" onClick={onDelete} className="text-xs text-[#6b7a8d]">
            Delete
          </button>
        </div>
      </div>
      {open && canShowText ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#111827] p-3 text-[11px] leading-relaxed text-[#e5eef8] whitespace-pre-wrap break-words">
          {text}
        </pre>
      ) : null}
    </li>
  );
}

function DebugJson({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 rounded-xl border border-dashed border-[#b7c4d4] bg-[#f7f9fc] p-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-[#5f7388]"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <pre className="max-h-72 overflow-auto rounded-lg bg-[#111827] p-3 text-[11px] leading-relaxed text-[#e5eef8] whitespace-pre-wrap break-words">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  confidence,
  source,
  conflict,
  alternatives,
  onPickAlt,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  confidence?: number | null;
  source?: string;
  conflict?: boolean;
  alternatives?: Array<{ value: string; documentType: string }> | null;
  onPickAlt?: (value: string) => void;
}) {
  const uncertain =
    confidence != null && Number(confidence) < UNCERTAIN_THRESHOLD;
  const confLabel =
    confidence != null ? `${Math.round(Number(confidence) * 100)}%` : null;
  const highlight = uncertain || conflict || (!value && confidence != null);

  return (
    <label className="relative block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1a2332]">
        {label}
        {source ? (
          <span className="text-xs font-normal text-[#6b7a8d]">{source}</span>
        ) : null}
        {conflict ? (
          <span className="text-xs font-normal text-[#b45309]">conflict</span>
        ) : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#1a2332] outline-none focus:border-[#2c5f8a] ${
          highlight
            ? "border-[#fdba74] bg-[#fff7ed]"
            : "border-[#d5dde8]"
        }`}
      />
      {uncertain && confLabel ? (
        <span className="pointer-events-none absolute right-3 top-8 text-[11px] font-medium text-[#b45309]">
          {confLabel}
        </span>
      ) : null}
      {alternatives?.length ? (
        <div className="mt-1.5 space-y-1">
          {alternatives.map((alt) => (
            <button
              key={`${alt.documentType}-${alt.value}`}
              type="button"
              className="block text-left text-xs text-[#2c5f8a]"
              onClick={() => onPickAlt?.(alt.value)}
            >
              Use “{alt.value}” ({sourceLabel(alt.documentType as DocumentType)})
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
