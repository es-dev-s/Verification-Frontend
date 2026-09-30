"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmCase,
  createCase,
  deleteDocument,
  getCase,
  saveDraft,
  setSelectedDegreeLevels,
  setStoredCaseId,
  startRead,
  uploadDocument,
} from "@/lib/api";
import {
  DEGREE_LEVEL_LABELS,
  DEGREE_LEVEL_ORDER,
  UNCERTAIN_THRESHOLD,
  emptyExperience,
  emptyQualification,
  sortDegreeLevels,
  sourceLabel,
  type Bachelors,
  type CaseDocument,
  type CasePayload,
  type DegreeLevel,
  type DocumentType,
  type ExperienceRow,
  type FieldSource,
} from "@/lib/types";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

export default function Home() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payload, setPayload] = useState<CasePayload | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<DegreeLevel[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [qualifications, setQualifications] = useState<
    Partial<Record<DegreeLevel, Bachelors>>
  >({});
  const [experience, setExperience] = useState<ExperienceRow[]>([emptyExperience()]);
  const [fieldSources, setFieldSources] = useState<FieldSource[]>([]);
  const [fromCvOnlyByLevel, setFromCvOnlyByLevel] = useState<
    Partial<Record<DegreeLevel, boolean>>
  >({});
  const [eduReadingLevel, setEduReadingLevel] = useState<DegreeLevel | null>(null);
  const [expReading, setExpReading] = useState(false);
  const [eduErrors, setEduErrors] = useState<Partial<Record<DegreeLevel, string>>>({});
  const [expError, setExpError] = useState<string | null>(null);
  const [eduGeminiRaws, setEduGeminiRaws] = useState<
    Partial<Record<DegreeLevel, unknown>>
  >({});
  const [expGeminiRaw, setExpGeminiRaw] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [editedLevels, setEditedLevels] = useState<Partial<Record<DegreeLevel, boolean>>>(
    {},
  );
  const [userEditedExp, setUserEditedExp] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const documents = payload?.documents ?? [];

  const applyCase = useCallback((row: CasePayload) => {
    setPayload(row);
    setSelectedLevels(sortDegreeLevels(row.selectedDegreeLevels ?? []));
    const nextQuals: Partial<Record<DegreeLevel, Bachelors>> = {};
    for (const q of row.qualifications ?? []) {
      nextQuals[q.degreeLevel] = {
        degreeTitle: q.degreeTitle ?? "",
        institution: q.institution ?? "",
        country: q.country ?? "",
        durationYears: q.durationYears,
        durationCalculated: q.durationCalculated,
      };
    }
    // Legacy bachelor-only payload
    if (!Object.keys(nextQuals).length && row.bachelors) {
      nextQuals.bachelor = {
        degreeTitle: row.bachelors.degreeTitle ?? "",
        institution: row.bachelors.institution ?? "",
        country: row.bachelors.country ?? "",
        durationYears: row.bachelors.durationYears,
        durationCalculated: row.bachelors.durationCalculated,
      };
    }
    setQualifications(nextQuals);
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
        setQualifications({});
        setExperience([emptyExperience()]);
        setFieldSources([]);
        setSelectedLevels([]);
        setEditedLevels({});
        setUserEditedExp(false);
        setFromCvOnlyByLevel({});
        setEduGeminiRaws({});
        setEduErrors({});
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
                selectedDegreeLevels: row.selectedDegreeLevels ?? prev.selectedDegreeLevels,
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

  const draftBody = useMemo(() => {
    const levels = sortDegreeLevels(selectedLevels);
    const quals = levels.map((level) => {
      const q = qualifications[level] ?? emptyQualification();
      return {
        degreeLevel: level,
        degreeTitle: q.degreeTitle || null,
        institution: q.institution || null,
        country: q.country || null,
        durationYears: q.durationYears,
        durationCalculated: q.durationCalculated,
      };
    });
    const bachelor = quals.find((q) => q.degreeLevel === "bachelor");
    return {
      qualifications: quals,
      bachelors: bachelor
        ? {
            degreeTitle: bachelor.degreeTitle,
            institution: bachelor.institution,
            country: bachelor.country,
            durationYears: bachelor.durationYears,
            durationCalculated: bachelor.durationCalculated,
          }
        : undefined,
      experienceRows: experience.map((r) => ({
        ...r,
        employer: r.employer || null,
        title: r.title || null,
        start: r.start || null,
        end: r.end || null,
        statedDurationYears: r.statedDurationYears ?? null,
      })),
      fieldFinalEntries: fieldSources
        .filter((f) => f.degreeLevel)
        .map((f) => ({
          field: f.field,
          degreeLevel: f.degreeLevel as DegreeLevel,
          finalValue: f.finalValue,
        })),
    };
  }, [selectedLevels, qualifications, experience, fieldSources]);

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

  async function onUpload(
    fileList: FileList | null,
    type: DocumentType,
    degreeLevel?: DegreeLevel | null,
  ) {
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
    if (type !== "CV" && !degreeLevel) {
      setUploadError("Select a degree type before uploading transcript/certificate");
      return;
    }
    const key = type === "CV" ? "CV" : `${type}:${degreeLevel}`;
    setUploadingKey(key);
    try {
      await uploadDocument(caseId, type, file, type === "CV" ? null : degreeLevel);
      await refreshCase();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingKey(null);
    }
  }

  async function onToggleDegreeLevel(level: DegreeLevel) {
    if (!caseId) return;
    const selected = selectedLevels.includes(level);
    if (selected) {
      const hasDocs = documents.some((d) => d.degreeLevel === level);
      if (hasDocs) {
        const ok = window.confirm(
          `Hide ${DEGREE_LEVEL_LABELS[level]} uploads? Existing files for this level will be kept until you delete them.`,
        );
        if (!ok) return;
      }
    }
    const previous = selectedLevels;
    const next = sortDegreeLevels(
      selected
        ? selectedLevels.filter((l) => l !== level)
        : [...selectedLevels, level],
    );
    setSelectedLevels(next);
    setPayload((prev) =>
      prev ? { ...prev, selectedDegreeLevels: next } : prev,
    );
    try {
      await setSelectedDegreeLevels(caseId, next);
      setUploadError(null);
    } catch (err) {
      // Revert optimistic UI only — avoid full refreshCase which can race the poller
      setSelectedLevels(previous);
      setPayload((prev) =>
        prev ? { ...prev, selectedDegreeLevels: previous } : prev,
      );
      setUploadError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDeleteDoc(docId: string) {
    if (!caseId) return;
    await deleteDocument(caseId, docId);
    await refreshCase();
  }

  const cvDocs = useMemo(
    () => documents.filter((d) => d.type === "CV"),
    [documents],
  );

  const visibleLevels = useMemo(
    () => sortDegreeLevels(selectedLevels),
    [selectedLevels],
  );

  function docsForLevel(level: DegreeLevel) {
    return documents.filter((d) => {
      if (d.type === "CV") return true;
      if (d.type !== "TRANSCRIPT" && d.type !== "CERTIFICATE") return false;
      if (d.degreeLevel === level) return true;
      return level === "bachelor" && d.degreeLevel == null;
    });
  }

  function levelEduReady(level: DegreeLevel) {
    const docs = docsForLevel(level);
    if (!docs.length) return false;
    return (
      docs.every((d) => d.status === "DONE" || d.status === "FAILED") &&
      docs.some((d) => d.status === "DONE")
    );
  }

  function levelEduBlocked(level: DegreeLevel) {
    return docsForLevel(level).some((d) =>
      ["QUEUED", "EXTRACTING"].includes(d.status),
    );
  }

  const cvReady = documents.some((d) => d.type === "CV" && d.status === "DONE");
  const cvBlocked = documents.some(
    (d) => d.type === "CV" && ["QUEUED", "EXTRACTING"].includes(d.status),
  );

  async function onReadEducation(degreeLevel: DegreeLevel) {
    if (!caseId) return;
    if (editedLevels[degreeLevel]) {
      const ok = window.confirm(
        `Read again will replace ${DEGREE_LEVEL_LABELS[degreeLevel]} fields you edited. Continue?`,
      );
      if (!ok) return;
    }
    setEduErrors((prev) => {
      const next = { ...prev };
      delete next[degreeLevel];
      return next;
    });
    setEduReadingLevel(degreeLevel);
    try {
      const started = await startRead(caseId, "education", degreeLevel);
      if (started.status === "FAILED" || !started.result) {
        throw new Error(started.error ?? "Read failed");
      }
      applyEducationResult(degreeLevel, started.result);
      await refreshCase();
      setEditedLevels((prev) => ({ ...prev, [degreeLevel]: false }));
    } catch (err) {
      setEduErrors((prev) => ({
        ...prev,
        [degreeLevel]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setEduReadingLevel(null);
    }
  }

  function applyEducationResult(degreeLevel: DegreeLevel, result: unknown) {
    const r = result as {
      qualification?: Bachelors | null;
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
    setEduGeminiRaws((prev) => ({
      ...prev,
      [degreeLevel]: r.geminiRaw ?? result,
    }));
    const block = r.qualification ?? r.bachelors;
    if (block) {
      setQualifications((prev) => ({
        ...prev,
        [degreeLevel]: {
          degreeTitle: block.degreeTitle ?? "",
          institution: block.institution ?? "",
          country: block.country ?? "",
          durationYears: block.durationYears ?? null,
          durationCalculated: Boolean(block.durationCalculated),
        },
      }));
    }
    setFromCvOnlyByLevel((prev) => ({
      ...prev,
      [degreeLevel]: Boolean(r.fromCvOnly),
    }));
    if (r.fields) {
      setFieldSources((prev) => {
        const others = prev.filter((f) => f.degreeLevel !== degreeLevel);
        const next = Object.entries(r.fields!).map(([field, meta]) => ({
          id: `${degreeLevel}:${field}`,
          field,
          degreeLevel,
          sourceDocumentId: meta.sourceDocumentId,
          extractedValue: meta.value,
          finalValue: meta.value,
          confidence: meta.confidence,
          alternatives: meta.alternatives ?? [],
        }));
        return [...others, ...next];
      });
    }
    setDirty(true);
  }

  async function onReadExperience() {
    if (!caseId) return;
    if (userEditedExp) {
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
      setUserEditedExp(false);
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

  function fieldMeta(field: string, degreeLevel: DegreeLevel) {
    return fieldSources.find(
      (f) => f.field === field && f.degreeLevel === degreeLevel,
    );
  }

  function updateQualification<K extends keyof Bachelors>(
    degreeLevel: DegreeLevel,
    key: K,
    value: Bachelors[K],
  ) {
    setQualifications((prev) => ({
      ...prev,
      [degreeLevel]: {
        ...(prev[degreeLevel] ?? emptyQualification()),
        [key]: value,
      },
    }));
    setDirty(true);
    setEditedLevels((prev) => ({ ...prev, [degreeLevel]: true }));
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
    setUserEditedExp(true);
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
            Select degree type(s), upload one CV, then add transcript and certificate
            files per level. Read fills education and work experience — you can always
            edit manually.
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
          <h2 className="mb-1 text-base font-semibold text-[#1a2332]">
            Select degree type(s)
          </h2>
          <p className="mb-3 text-xs text-[#6b7a8d]">
            Choose every level you want to verify. Upload sections appear below for each.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {DEGREE_LEVEL_ORDER.map((level) => {
              const on = selectedLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => void onToggleDegreeLevel(level)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    on
                      ? "bg-[#2c5f8a] text-white"
                      : "bg-[#e8f0f7] text-[#2c5f8a]"
                  }`}
                >
                  {DEGREE_LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>

          <DocUploadBlock
            title="CV"
            hint="One CV for the whole case — used for work experience and education at every level."
            docs={cvDocs}
            uploading={uploadingKey === "CV"}
            disabled={!caseId}
            onUpload={(files) => void onUpload(files, "CV")}
            onDelete={(id) => void onDeleteDoc(id)}
          />

          {visibleLevels.map((level) => (
            <LevelDocsSection
              key={level}
              degreeLevel={level}
              documents={documents}
              uploadingKey={uploadingKey}
              disabled={!caseId}
              onUpload={(type, files) => void onUpload(files, type, level)}
              onDelete={(id) => void onDeleteDoc(id)}
            />
          ))}

          {!visibleLevels.length ? (
            <p className="mt-3 text-sm text-[#6b7a8d]">
              Select at least one degree type to upload transcripts and certificates.
            </p>
          ) : null}

          {uploadError ? (
            <p className="mt-3 text-sm text-[#b45309]">{uploadError}</p>
          ) : null}
        </section>

        {visibleLevels.length ? (
          visibleLevels.map((level) => {
            const q = qualifications[level] ?? emptyQualification();
            return (
              <EducationBlock
                key={level}
                degreeLevel={level}
                value={q}
                documents={documents}
                fieldMeta={(field) => fieldMeta(field, level)}
                fromCvOnly={Boolean(fromCvOnlyByLevel[level])}
                reading={eduReadingLevel === level}
                ready={levelEduReady(level)}
                blocked={levelEduBlocked(level)}
                error={eduErrors[level] ?? null}
                geminiRaw={eduGeminiRaws[level]}
                onRead={() => void onReadEducation(level)}
                onChange={(key, value) => updateQualification(level, key, value)}
              />
            );
          })
        ) : (
          <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
            <h2 className="text-base font-semibold text-[#1a2332]">Education</h2>
            <p className="mt-2 text-sm text-[#6b7a8d]">
              Select at least one degree type to show education fields.
            </p>
          </section>
        )}

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
                        setUserEditedExp(true);
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
              setUserEditedExp(true);
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

function EducationBlock({
  degreeLevel,
  value,
  documents,
  fieldMeta,
  fromCvOnly,
  reading,
  ready,
  blocked,
  error,
  geminiRaw,
  onRead,
  onChange,
}: {
  degreeLevel: DegreeLevel;
  value: Bachelors;
  documents: CaseDocument[];
  fieldMeta: (field: string) => FieldSource | undefined;
  fromCvOnly: boolean;
  reading: boolean;
  ready: boolean;
  blocked: boolean;
  error: string | null;
  geminiRaw: unknown;
  onRead: () => void;
  onChange: <K extends keyof Bachelors>(key: K, value: Bachelors[K]) => void;
}) {
  const label = DEGREE_LEVEL_LABELS[degreeLevel];
  const meta = (field: string) => fieldMeta(field);
  const docTypeFor = (field: string) =>
    sourceLabel(
      documents.find((d) => d.id === meta(field)?.sourceDocumentId)?.type,
    );

  return (
    <section className="mb-5 rounded-2xl border border-[#d5dde8] bg-white/90 p-5 shadow-[0_1px_0_rgba(26,35,50,0.03)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1a2332]">
            {label} education
          </h2>
          {fromCvOnly ? (
            <p className="text-xs text-[#6b7a8d]">from CV only</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!ready || blocked || reading}
          onClick={onRead}
          className="rounded-full bg-[#2c5f8a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reading ? "Reading…" : "Read"}
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-[#b45309]">{error}</p> : null}
      {geminiRaw != null ? (
        <DebugJson title={`Gemini raw (${label} education)`} data={geminiRaw} />
      ) : null}
      <div className="grid gap-3">
        <Field
          label="Degree title"
          value={value.degreeTitle || ""}
          confidence={meta("degreeTitle")?.confidence}
          source={docTypeFor("degreeTitle")}
          conflict={Boolean(meta("degreeTitle")?.alternatives?.length)}
          alternatives={meta("degreeTitle")?.alternatives}
          onPickAlt={(v) => onChange("degreeTitle", v)}
          onChange={(v) => onChange("degreeTitle", v)}
        />
        <Field
          label="Institution"
          value={value.institution || ""}
          confidence={meta("institution")?.confidence}
          source={docTypeFor("institution")}
          conflict={Boolean(meta("institution")?.alternatives?.length)}
          alternatives={meta("institution")?.alternatives}
          onPickAlt={(v) => onChange("institution", v)}
          onChange={(v) => onChange("institution", v)}
        />
        <Field
          label="Country"
          value={value.country || ""}
          confidence={meta("country")?.confidence}
          source={docTypeFor("country")}
          conflict={Boolean(meta("country")?.alternatives?.length)}
          alternatives={meta("country")?.alternatives}
          onPickAlt={(v) => onChange("country", v)}
          onChange={(v) => onChange("country", v)}
        />
        <Field
          label={
            value.durationCalculated
              ? "Study duration (years, calculated)"
              : "Study duration (years)"
          }
          value={value.durationYears != null ? String(value.durationYears) : ""}
          confidence={meta("durationYears")?.confidence}
          source={docTypeFor("durationYears")}
          conflict={Boolean(meta("durationYears")?.alternatives?.length)}
          alternatives={meta("durationYears")?.alternatives}
          onPickAlt={(v) => onChange("durationYears", v ? Number(v) : null)}
          onChange={(v) =>
            onChange("durationYears", v === "" ? null : Number(v))
          }
        />
      </div>
    </section>
  );
}

function LevelDocsSection({
  degreeLevel,
  documents,
  uploadingKey,
  disabled,
  onUpload,
  onDelete,
}: {
  degreeLevel: DegreeLevel;
  documents: CaseDocument[];
  uploadingKey: string | null;
  disabled: boolean;
  onUpload: (type: "TRANSCRIPT" | "CERTIFICATE", files: FileList | null) => void;
  onDelete: (docId: string) => void;
}) {
  const label = DEGREE_LEVEL_LABELS[degreeLevel];
  const transcripts = documents.filter(
    (d) => d.type === "TRANSCRIPT" && d.degreeLevel === degreeLevel,
  );
  const certificates = documents.filter(
    (d) => d.type === "CERTIFICATE" && d.degreeLevel === degreeLevel,
  );

  return (
    <div className="mt-5 rounded-xl border border-[#e4eaf2] bg-[#fafbfc] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#1a2332]">
        {label} — Transcript &amp; Certificate
      </h3>
      <div className="space-y-4">
        <DocUploadBlock
          title="Transcript"
          hint="Multiple files allowed (e.g. multi-page photos)."
          docs={transcripts}
          uploading={uploadingKey === `TRANSCRIPT:${degreeLevel}`}
          disabled={disabled}
          onUpload={(files) => onUpload("TRANSCRIPT", files)}
          onDelete={onDelete}
        />
        <DocUploadBlock
          title="Certificate"
          hint="Multiple files allowed (e.g. multi-page photos)."
          docs={certificates}
          uploading={uploadingKey === `CERTIFICATE:${degreeLevel}`}
          disabled={disabled}
          onUpload={(files) => onUpload("CERTIFICATE", files)}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function DocUploadBlock({
  title,
  hint,
  docs,
  uploading,
  disabled,
  onUpload,
  onDelete,
}: {
  title: string;
  hint?: string;
  docs: CaseDocument[];
  uploading: boolean;
  disabled: boolean;
  onUpload: (files: FileList | null) => void;
  onDelete: (docId: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[#1a2332]">{title}</p>
        {hint ? <p className="text-[11px] text-[#6b7a8d]">{hint}</p> : null}
      </div>
      <input
        type="file"
        accept={ACCEPT}
        disabled={uploading || disabled}
        onChange={(e) => {
          onUpload(e.target.files);
          e.target.value = "";
        }}
        className="w-full text-sm text-[#4b5c6e] file:mr-3 file:rounded-full file:border-0 file:bg-[#e8f0f7] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#2c5f8a]"
      />
      {uploading ? (
        <p className="mt-1 text-xs text-[#2c5f8a]">Uploading…</p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {docs.map((doc) => (
          <DocRow key={doc.id} doc={doc} onDelete={() => onDelete(doc.id)} />
        ))}
        {!docs.length ? (
          <li className="text-xs text-[#6b7a8d]">No files yet.</li>
        ) : null}
      </ul>
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
  const levelLabel =
    doc.degreeLevel && DEGREE_LEVEL_LABELS[doc.degreeLevel]
      ? DEGREE_LEVEL_LABELS[doc.degreeLevel]
      : null;

  return (
    <li className="rounded-xl border border-[#e4eaf2] bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1a2332]">
            {doc.originalName}
          </p>
          <p className="text-xs text-[#6b7a8d]">
            {doc.type}
            {levelLabel ? ` · ${levelLabel}` : ""}
            {" · "}
            {doc.format}
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
