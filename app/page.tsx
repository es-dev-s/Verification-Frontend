"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCase,
  deleteDocument,
  getCase,
  getRiskAssessment,
  patchRiskCompetence,
  runAssessment,
  runRiskAssessment,
  saveDraft,
  setEngineeringTitledDegree,
  setOccupation,
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
  type AssessmentResult,
  type AnzscoCandidate,
  type Bachelors,
  type CaseDocument,
  type CasePayload,
  type Competence,
  type DegreeLevel,
  type DocumentType,
  type ExperienceRow,
  type FieldSource,
  type RiskAssessmentResult,
} from "@/lib/types";
import { CaseWizardLayout } from "@/components/wizard/CaseWizardLayout";
import { CareerEpisodesSection } from "@/components/wizard/CareerEpisodesSection";
import {
  BTN_GHOST_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FOCUS_RING,
  FileChip,
  PlusIcon,
  SectionHeader,
  UploadTile,
} from "@/components/wizard/UploadTile";
import { Step2Confirmation } from "@/components/wizard/Step2Confirmation";
import { Step3Assessment } from "@/components/wizard/Step3Assessment";
import { Step4Risk } from "@/components/wizard/Step4Risk";
import { Step5FinalReview } from "@/components/wizard/Step5FinalReview";
import { Step6Approval } from "@/components/wizard/Step6Approval";
import {
  isEngineeringRelatedChecked,
  type WizardStepId,
} from "@/lib/wizard";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

export default function Home() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payload, setPayload] = useState<CasePayload | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStepId>(1);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [competenceBusy, setCompetenceBusy] = useState(false);
  const [selectedAnzsco, setSelectedAnzsco] = useState<{
    anzscoCode: string;
    title: string;
  } | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<DegreeLevel[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [qualifications, setQualifications] = useState<
    Partial<Record<DegreeLevel, Bachelors>>
  >({});
  const [experience, setExperience] = useState<ExperienceRow[]>([emptyExperience()]);
  const [engineeringTitledDegree, setEngineeringTitledDegreeState] = useState<
    boolean | null
  >(null);
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
  const [eduParseSources, setEduParseSources] = useState<
    Partial<Record<DegreeLevel, "groq" | "heuristic">>
  >({});
  const [expGeminiRaw, setExpGeminiRaw] = useState<unknown>(null);
  const [expParseSource, setExpParseSource] = useState<"groq" | "heuristic" | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [editedLevels, setEditedLevels] = useState<Partial<Record<DegreeLevel, boolean>>>(
    {},
  );
  const [userEditedExp, setUserEditedExp] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

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
    setEngineeringTitledDegreeState(row.engineeringTitledDegree ?? null);
    if (row.experienceRows?.length) {
      setExperience(
        row.experienceRows.map((r) => ({
          id: r.id,
          employer: r.employer ?? "",
          title: r.title ?? "",
          start: r.start ?? "",
          end: r.end ?? "",
          domainSuggested: r.domainSuggested,
          domainFinal:
            r.domainFinal ?? r.domainSuggested ?? null,
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
        // ?case=<id> (from the Clients page) reopens that case at Step 1.
        const requestedCaseId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("case")
            : null;
        if (requestedCaseId) {
          try {
            const existing = await getCase(requestedCaseId);
            if (cancelled) return;
            setStoredCaseId(existing.id);
            setCaseId(existing.id);
            setWizardStep(1);
            applyCase(existing);
            setAssessment(existing.assessment ?? null);
            const storedRisk = existing.assessment
              ? await getRiskAssessment(existing.id).catch(() => null)
              : null;
            if (cancelled) return;
            setRisk(storedRisk);
            if (storedRisk?.anzscoCode) {
              setSelectedAnzsco({
                anzscoCode: storedRisk.anzscoCode,
                title: storedRisk.title ?? "",
              });
            }
            return;
          } catch {
            // Unknown or not-owned case — fall back to a new blank case.
            if (cancelled) return;
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
        // Otherwise always start a blank case — do not restore prior documents/reads.
        const created = await createCase();
        if (cancelled) return;
        setStoredCaseId(created.id);
        setCaseId(created.id);
        setQualifications({});
        setExperience([emptyExperience()]);
        setEngineeringTitledDegreeState(null);
        setFieldSources([]);
        setSelectedLevels([]);
        setWizardStep(1);
        setEditedLevels({});
        setUserEditedExp(false);
        setFromCvOnlyByLevel({});
        setEduGeminiRaws({});
        setEduParseSources({});
        setExpGeminiRaw(null);
        setExpParseSource(null);
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

  const refreshCaseMeta = useCallback(async () => {
    if (!caseId) return;
    const row = await getCase(caseId);
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            documents: row.documents,
            readJobs: row.readJobs,
            status: row.status,
            selectedDegreeLevels:
              row.selectedDegreeLevels ?? prev.selectedDegreeLevels,
            engineeringTitledDegree:
              row.engineeringTitledDegree ?? prev.engineeringTitledDegree,
          }
        : row,
    );
    setStaleHint(
      (row.readJobs ?? []).some((j) => j.stale && j.status === "DONE"),
    );
    return row;
  }, [caseId]);

  const refreshCase = useCallback(async () => {
    if (!caseId) return;
    // While local form is dirty (e.g. right after Read), never clobber fields from GET.
    if (dirtyRef.current) {
      return refreshCaseMeta();
    }
    const row = await getCase(caseId);
    applyCase(row);
    return row;
  }, [applyCase, caseId, refreshCaseMeta]);

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
        domainSuggested: r.domainSuggested ?? null,
        domainFinal: r.domainFinal ?? null,
      })),
      engineeringTitledDegree,
      fieldFinalEntries: fieldSources
        .filter((f) => f.degreeLevel)
        .map((f) => ({
          field: f.field,
          degreeLevel: f.degreeLevel as DegreeLevel,
          finalValue: f.finalValue,
        })),
    };
  }, [selectedLevels, qualifications, experience, fieldSources, engineeringTitledDegree]);

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
      await refreshCaseMeta();
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
      fallback?: boolean;
      flags?: string[];
    };
    const usedHeuristic =
      Boolean(r.fallback) ||
      (Array.isArray(r.flags) && r.flags.includes("heuristics_fallback"));
    setEduGeminiRaws((prev) => ({
      ...prev,
      [degreeLevel]: r.geminiRaw ?? result,
    }));
    setEduParseSources((prev) => ({
      ...prev,
      [degreeLevel]: usedHeuristic ? "heuristic" : "groq",
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
      await refreshCaseMeta();
      setUserEditedExp(false);
    } catch (err) {
      setExpError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpReading(false);
    }
  }

  function applyExperienceResult(result: unknown) {
    const r = result as {
      rows?: ExperienceRow[];
      geminiRaw?: unknown;
      fallback?: boolean;
      flags?: string[];
    };
    const usedHeuristic =
      Boolean(r.fallback) ||
      (Array.isArray(r.flags) && r.flags.includes("heuristics_fallback"));
    setExpGeminiRaw(r.geminiRaw ?? result);
    setExpParseSource(usedHeuristic ? "heuristic" : "groq");
    if (r.rows?.length) {
      setExperience(
        r.rows.map((row) => ({
          id: row.id,
          employer: row.employer ?? "",
          title: row.title ?? "",
          start: row.start ?? "",
          end: row.end ?? "",
          domainSuggested: row.domainSuggested,
          domainFinal: row.domainFinal ?? row.domainSuggested ?? null,
        })),
      );
    } else {
      setExperience([emptyExperience()]);
    }
    setDirty(true);
  }

  async function goToStep2() {
    // Existing Step 1 confirmation had no required-field validation — preserve that.
    if (caseId) {
      try {
        await saveDraft(caseId, draftBody);
        setDirty(false);
      } catch {
        // Still allow navigation; autosave may retry from Step 2 edits.
      }
    }
    setWizardStep(2);
    setSaveMsg(null);
  }

  async function goToStep3(force = false) {
    if (!caseId) {
      setSaveMsg("Case not ready");
      return;
    }
    setWizardStep(3);
    setSaveMsg(null);
    setAssessError(null);
    setAssessLoading(true);
    try {
      await saveDraft(caseId, draftBody);
      setDirty(false);
      const result = await runAssessment(caseId, { force });
      setAssessment(result);
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssessLoading(false);
    }
  }

  async function goToStep4(candidate: AnzscoCandidate) {
    if (!caseId) {
      setSaveMsg("Case not ready");
      return;
    }
    const chosen = {
      anzscoCode: candidate.anzscoCode,
      title: candidate.title,
    };
    setSelectedAnzsco(chosen);
    setWizardStep(4);
    setSaveMsg(null);
    setRiskError(null);
    setRiskLoading(true);
    try {
      const label = `${candidate.title} (${candidate.anzscoCode})`;
      await setOccupation(caseId, label);
      setPayload((prev) =>
        prev ? { ...prev, targetOccupation: label } : prev,
      );
      const result = await runRiskAssessment(caseId, chosen);
      setRisk(result);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : String(err));
    } finally {
      setRiskLoading(false);
    }
  }

  async function retryRisk() {
    if (!caseId || !selectedAnzsco) return;
    setRiskError(null);
    setRiskLoading(true);
    try {
      const result = await runRiskAssessment(caseId, selectedAnzsco);
      setRisk(result);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : String(err));
    } finally {
      setRiskLoading(false);
    }
  }

  async function onCompetenceChange(competence: Competence) {
    if (!caseId) return;
    setCompetenceBusy(true);
    try {
      const result = await patchRiskCompetence(caseId, competence);
      setRisk(result);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompetenceBusy(false);
    }
  }

  /** Steps 5–6: plain navigation (no API calls); scroll to top for long pages. */
  function goToReviewStep(step: 4 | 5 | 6) {
    setWizardStep(step);
    setSaveMsg(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function onEngineeringTitledChange(value: boolean) {
    setEngineeringTitledDegreeState(value);
    setDirty(true);
    if (!caseId) return;
    try {
      await setEngineeringTitledDegree(caseId, value);
      setPayload((prev) =>
        prev ? { ...prev, engineeringTitledDegree: value } : prev,
      );
      setSaveMsg("Draft saved");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
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
      <div className="min-h-full bg-background px-4 py-10">
        <main className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold text-ink">Cannot reach API</h1>
          <p className="mt-2 text-sm text-ink-muted">{bootError}</p>
          <p className="mt-2 text-sm text-ink-muted">
            Start the API on port 3001 (`npm run dev` in api/) and ensure Postgres/Redis are up.
          </p>
        </main>
      </div>
    );
  }

  return (
    <CaseWizardLayout currentStep={wizardStep}>
      {wizardStep === 6 ? (
        <Step6Approval caseId={caseId} onBack={() => goToReviewStep(5)} />
      ) : wizardStep === 5 ? (
        <Step5FinalReview
          risk={risk}
          assessment={assessment}
          selectedAnzsco={selectedAnzsco}
          selectedLevels={selectedLevels}
          qualifications={qualifications}
          experience={experience}
          engineeringTitledDegree={engineeringTitledDegree}
          onBack={() => goToReviewStep(4)}
          onContinue={() => goToReviewStep(6)}
        />
      ) : wizardStep === 4 ? (
        <Step4Risk
          risk={risk}
          assessment={assessment}
          loading={riskLoading}
          error={riskError}
          competenceBusy={competenceBusy}
          selectedLevels={selectedLevels}
          qualifications={qualifications}
          onBack={() => {
            setWizardStep(3);
            setSaveMsg(null);
          }}
          onRetry={() => void retryRisk()}
          onCompetenceChange={(c) => void onCompetenceChange(c)}
          onContinue={() => goToReviewStep(5)}
        />
      ) : wizardStep === 3 ? (
        <Step3Assessment
          assessment={assessment}
          loading={assessLoading}
          error={assessError}
          onBack={() => {
            setWizardStep(2);
            setSaveMsg(null);
          }}
          onRetry={() => void goToStep3(true)}
          onConfirmOccupation={(candidate: AnzscoCandidate) => {
            void goToStep4(candidate);
          }}
        />
      ) : wizardStep === 2 ? (
        <Step2Confirmation
          selectedLevels={selectedLevels}
          qualifications={qualifications}
          experience={experience}
          engineeringTitledDegree={engineeringTitledDegree}
          saveMsg={saveMsg}
          onEngineeringTitledChange={(v) => void onEngineeringTitledChange(v)}
          onBack={() => {
            setWizardStep(1);
            setSaveMsg(null);
          }}
          onNext={() => void goToStep3(false)}
          nextBusy={assessLoading}
        />
      ) : (
    <div>
        <header className="mb-7">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            Upload &amp; details
          </h1>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
         
          </p>
          {saveMsg ? (
            <p className="mt-3 text-sm text-brand">{saveMsg}</p>
          ) : null}
          {staleHint ? (
            <p className="mt-3 inline-flex rounded-lg bg-[#fff7ed] px-3 py-1.5 text-sm text-[#b45309] ring-1 ring-[#fdba74]/60">
              Documents changed since the last Read — please Read again.
            </p>
          ) : null}
        </header>

        <section className={CARD}>
          <SectionHeader
            title="Documents"
            description="Choose every degree level you want to verify, then upload the files for each."
          />

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Degree type(s)
            </legend>
            <div className="flex flex-wrap gap-2">
              {DEGREE_LEVEL_ORDER.map((level) => {
                const on = selectedLevels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={on}
                    onClick={() => void onToggleDegreeLevel(level)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${FOCUS_RING} ${
                      on
                        ? "bg-brand text-white shadow-[0_2px_8px_rgba(146,86,169,0.25)]"
                        : "bg-surface text-ink-muted ring-1 ring-line hover:text-brand hover:ring-brand-muted"
                    }`}
                  >
                    {on ? (
                      <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                        <path d="M8.1 13.6L4.5 10l1.1-1.1 2.5 2.5 6.3-6.3 1.1 1.1-7.4 7.4z" />
                      </svg>
                    ) : null}
                    {DEGREE_LEVEL_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3">
            <DocUploadBlock
              title="CV"
              hint="One CV for the whole case — used for work experience and education at every level."
              docs={cvDocs}
              uploading={uploadingKey === "CV"}
              disabled={!caseId}
              onUpload={(files) => void onUpload(files, "CV")}
              onDelete={(id) => void onDeleteDoc(id)}
            />
          </div>

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
            <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-3 text-center text-xs text-ink-muted">
              Select at least one degree type to upload transcripts and certificates.
            </p>
          ) : null}

          {uploadError ? (
            <p role="alert" className="mt-4 rounded-lg bg-[#fff7ed] px-3 py-2 text-sm text-[#b45309] ring-1 ring-[#fdba74]/60">
              {uploadError}
            </p>
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
                parseSource={eduParseSources[level] ?? null}
                onRead={() => void onReadEducation(level)}
                onChange={(key, value) => updateQualification(level, key, value)}
              />
            );
          })
        ) : (
          <section className={CARD}>
            <SectionHeader
              title="Education"
              description="Select at least one degree type to show education fields."
            />
          </section>
        )}

        <section className={CARD}>
          <SectionHeader
            title="Work experience"
            description={
              expParseSource
                ? `Parsed via ${parseSourceLabel(expParseSource)}`
                : "Read the CV to fill roles, or add them manually."
            }
            action={
              <button
                type="button"
                disabled={!cvReady || cvBlocked || expReading}
                onClick={() => void onReadExperience()}
                className={BTN_PRIMARY}
              >
                {expReading ? "Reading…" : "Read"}
              </button>
            }
          />
          {expError ? (
            <p role="alert" className="mb-3 text-sm text-[#b45309]">{expError}</p>
          ) : null}
          {expGeminiRaw != null ? (
            <DebugJson
              title={`${parseSourceLabel(expParseSource ?? "groq")} raw (experience)`}
              data={expGeminiRaw}
            />
          ) : null}
          <div className="space-y-3">
            {experience.map((row, index) => (
              <div
                key={row.id ?? index}
                className="rounded-xl border border-line bg-surface-subtle p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    Role {index + 1}
                  </p>
                  {experience.length > 1 ? (
                    <button
                      type="button"
                      className={BTN_GHOST_DANGER}
                      aria-label={`Remove role ${index + 1}`}
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
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={isEngineeringRelatedChecked(row)}
                    onChange={(e) =>
                      updateExperience(index, "domainFinal", e.target.checked)
                    }
                  />
                  <span className="text-sm text-ink">
                    Engineering-related role
                    {row.domainSuggested != null ? (
                      <span className="ml-1.5 text-xs text-ink-muted">
                        (AI suggested: {row.domainSuggested ? "yes" : "no"})
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`mt-3 ${BTN_SECONDARY}`}
            onClick={() => {
              setExperience((rows) => [...rows, emptyExperience()]);
              setDirty(true);
              setUserEditedExp(true);
            }}
          >
            <PlusIcon />
            Add role
          </button>
        </section>

        <CareerEpisodesSection caseId={caseId} experience={experience} />

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={goToStep2}
            className={`rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(146,86,169,0.25)] hover:bg-brand-dark ${FOCUS_RING}`}
          >
            Next
          </button>
        </div>
    </div>
      )}
    </CaseWizardLayout>
  );
}

function parseSourceLabel(source: "groq" | "heuristic"): string {
  return source === "heuristic" ? "Heuristic fallback" : "Groq";
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
  parseSource,
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
  parseSource: "groq" | "heuristic" | null;
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
    <section className={CARD}>
      <SectionHeader
        title={`${label} education`}
        description={
          fromCvOnly || parseSource ? (
            <>
              {fromCvOnly ? "from CV only" : null}
              {fromCvOnly && parseSource ? " · " : null}
              {parseSource ? `Parsed via ${parseSourceLabel(parseSource)}` : null}
            </>
          ) : (
            "Read the uploaded documents to fill these fields, or type them in."
          )
        }
        action={
          <button
            type="button"
            disabled={!ready || blocked || reading}
            onClick={onRead}
            className={BTN_PRIMARY}
          >
            {reading ? "Reading…" : "Read"}
          </button>
        }
      />
      {error ? <p role="alert" className="mb-3 text-sm text-[#b45309]">{error}</p> : null}
      {geminiRaw != null ? (
        <DebugJson
          title={`${parseSourceLabel(parseSource ?? "groq")} raw (${label} education)`}
          data={geminiRaw}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
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
          className="sm:col-span-2"
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
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        {label}
        <span className="text-xs font-normal text-ink-muted">
          Transcript &amp; certificate
        </span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
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

/** One upload slot: title, hint, file chips, then a dashed upload tile. */
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
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          {hint ? (
            <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{hint}</p>
          ) : null}
        </div>
        {docs.length ? (
          <span className="shrink-0 rounded-full bg-surface-tint px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-line">
            {docs.length} file{docs.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {docs.length ? (
        <ul className="mb-2.5 space-y-2" aria-label={`${title} files`}>
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} onDelete={() => onDelete(doc.id)} />
          ))}
        </ul>
      ) : null}
      <div className="mt-auto">
        <UploadTile
          label={title}
          accept={ACCEPT}
          compact={docs.length > 0}
          busy={uploading}
          disabled={disabled}
          onFiles={onUpload}
        />
      </div>
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
  const status =
    doc.status === "DONE"
      ? "done"
      : doc.status === "FAILED"
        ? "failed"
        : "processing";
  const text = (doc.text ?? "").trim();
  const canShowText = doc.status === "DONE" && text.length > 0;
  const levelLabel =
    doc.degreeLevel && DEGREE_LEVEL_LABELS[doc.degreeLevel]
      ? DEGREE_LEVEL_LABELS[doc.degreeLevel]
      : null;

  return (
    <li>
      <FileChip
        name={doc.originalName}
        format={doc.format}
        status={status}
        error={doc.error}
        meta={
          <>
            {doc.type}
            {levelLabel ? ` · ${levelLabel}` : ""}
            {doc.extractionMethod ? ` · ${doc.extractionMethod}` : ""}
            {text ? ` · ${text.length} chars` : ""}
          </>
        }
        actions={
          <>
            {canShowText ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={`rounded-full px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft ${FOCUS_RING}`}
              >
                {open ? "Hide text" : "Text"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${doc.originalName}`}
              title="Delete"
              className={`flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-[#f8ecec] hover:text-[#8a3a3a] ${FOCUS_RING}`}
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                <path d="M5.3 4.2L10 8.9l4.7-4.7 1.1 1.1-4.7 4.7 4.7 4.7-1.1 1.1-4.7-4.7-4.7 4.7-1.1-1.1 4.7-4.7-4.7-4.7z" />
              </svg>
            </button>
          </>
        }
      >
        {open && canShowText ? (
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#111827] p-3 text-[11px] leading-relaxed text-[#e5eef8] whitespace-pre-wrap break-words">
            {text}
          </pre>
        ) : null}
      </FileChip>
    </li>
  );
}

function DebugJson({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 rounded-xl border border-dashed border-line-strong bg-surface-tint p-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-ink-muted"
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
  className = "",
}: {
  className?: string;
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
    <label className={`relative block ${className}`}>
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
        {label}
        {source ? (
          <span className="text-xs font-normal text-ink-muted">{source}</span>
        ) : null}
        {conflict ? (
          <span className="text-xs font-normal text-[#b45309]">conflict</span>
        ) : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-ring/40 ${
          highlight
            ? "border-[#fdba74] bg-[#fff7ed]"
            : "border-line"
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
              className="block text-left text-xs text-brand"
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
