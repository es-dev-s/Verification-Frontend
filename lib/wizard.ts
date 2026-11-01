import type {
  DegreeLevel,
  ExperienceRow,
  Qualification,
  TranscriptDataSummary,
} from "./types";
import { DEGREE_LEVEL_LABELS, sortDegreeLevels } from "./types";

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WizardStepDef = {
  id: WizardStepId;
  title: string;
  description: string;
};

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 1,
    title: "1. Upload & Details",
    description: "Documents, education, and work experience",
  },
  {
    id: 2,
    title: "2. Transcript data",
    description: "Duration, credits, and final-year project",
  },
  {
    id: 3,
    title: "3. Verify details",
    description: "Review details and check the study duration",
  },
  {
    id: 4,
    title: "4. Assessment",
    description: "ANZSCO subject matching",
  },
  {
    id: 5,
    title: "5. Risk",
    description: "Alignment score and risk level",
  },
  {
    id: 6,
    title: "6. Final review",
    description: "Verify occupation, risk, and competency",
  },
  {
    id: 7,
    title: "7. Approval",
    description: "Approve or reject with a comment",
  },
];

export type WizardStepState = "completed" | "active" | "upcoming";

export function wizardStepState(
  stepId: WizardStepId,
  current: WizardStepId,
): WizardStepState {
  if (stepId === current) return "active";
  if (stepId < current) return "completed";
  return "upcoming";
}

export type ConfirmationQualification = {
  degreeLevel: DegreeLevel;
  label: string;
  degreeTitle: string;
  institution: string;
  country: string;
  durationYears: string;
  /** Where the duration came from ("from transcript", …); set when resolved. */
  durationSource?: string | null;
};

/** Build read-only qualification blocks for Verify details in PhD → Diploma order. */
export function buildConfirmationQualifications(
  selectedLevels: DegreeLevel[],
  qualifications: Partial<
    Record<
      DegreeLevel,
      {
        degreeTitle: string | null;
        institution: string | null;
        country: string | null;
        durationYears: number | null;
      }
    >
  >,
  fromApi?: Qualification[],
  /**
   * When given (even null), the duration is the one confirmed in Verify
   * details (see resolveStudyDuration), with its source, else "Not available".
   */
  confirmed?: { transcriptData: TranscriptDataSummary | null },
): ConfirmationQualification[] {
  const byLevel: typeof qualifications = { ...qualifications };
  for (const q of fromApi ?? []) {
    if (!byLevel[q.degreeLevel]) {
      byLevel[q.degreeLevel] = {
        degreeTitle: q.degreeTitle,
        institution: q.institution,
        country: q.country,
        durationYears: q.durationYears,
      };
    }
  }
  return sortDegreeLevels(selectedLevels).map((level) => {
    const q = byLevel[level];
    const resolved = confirmed
      ? resolveStudyDuration(level, confirmed.transcriptData, q?.durationYears)
      : null;
    if (resolved) {
      return {
        degreeLevel: level,
        label: DEGREE_LEVEL_LABELS[level],
        degreeTitle: (q?.degreeTitle || "").trim() || "—",
        institution: (q?.institution || "").trim() || "—",
        country: (q?.country || "").trim() || "—",
        durationYears:
          resolved.years != null ? formatStudyYears(resolved.years) : "Not available",
        durationSource: resolved.source
          ? STUDY_DURATION_SOURCE_LABELS[resolved.source]
          : null,
      };
    }
    return {
      degreeLevel: level,
      label: DEGREE_LEVEL_LABELS[level],
      degreeTitle: (q?.degreeTitle || "").trim() || "—",
      institution: (q?.institution || "").trim() || "—",
      country: (q?.country || "").trim() || "—",
      durationYears:
        q?.durationYears != null && Number.isFinite(q.durationYears)
          ? String(q.durationYears)
          : "—",
    };
  });
}

export type StudyDurationSource = "edited" | "transcript" | "credits" | "stated";

export type StudyDuration = {
  /** Years, or null when no source has a value. */
  years: number | null;
  source: StudyDurationSource | null;
};

export const STUDY_DURATION_SOURCE_LABELS: Record<StudyDurationSource, string> = {
  edited: "edited by assessor",
  transcript: "from transcript",
  credits: "converted from credits",
  stated: "stated",
};

function finiteYears(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Study duration as confirmed in Verify details (the duration check):
 * assessor-entered count (Verify details or Transcript data) → counted from
 * the transcript (incl. credits → years) → stated (Step 1 / corrected in
 * Verify details). `statedFallback` is the Step 1 form value, used when the
 * transcript summary is not loaded or has no stated value.
 */
export function resolveStudyDuration(
  level: DegreeLevel,
  transcriptData: TranscriptDataSummary | null | undefined,
  statedFallback: number | null | undefined,
): StudyDuration {
  const q = transcriptData?.qualifications.find((x) => x.degreeLevel === level);
  if (q) {
    const manual = finiteYears(q.overrides.countedYears);
    if (manual != null) return { years: manual, source: "edited" };
    const counted = finiteYears(q.transcript.countedYears);
    if (counted != null) {
      return { years: counted, source: q.creditConversion ? "credits" : "transcript" };
    }
    const stated = finiteYears(q.statedYears);
    if (stated != null) return { years: stated, source: "stated" };
  }
  const fallback = finiteYears(statedFallback);
  if (fallback != null) return { years: fallback, source: "stated" };
  return { years: null, source: null };
}

/** "4", "3.5" — matches the "Duration (years)" fields. */
export function formatStudyYears(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function isEngineeringRelatedChecked(row: ExperienceRow): boolean {
  if (row.domainFinal != null) return row.domainFinal;
  if (row.domainSuggested != null) return row.domainSuggested;
  return false;
}
