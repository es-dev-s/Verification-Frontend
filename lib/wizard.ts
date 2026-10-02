import type { DegreeLevel, ExperienceRow, Qualification } from "./types";
import { DEGREE_LEVEL_LABELS, sortDegreeLevels } from "./types";

export type WizardStepId = 1 | 2 | 3;

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
    title: "2. Confirmation",
    description: "Review details and engineering-titled degree",
  },
  {
    id: 3,
    title: "3. Assessment",
    description: "ANZSCO recommendation",
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
};

/** Build read-only qualification blocks for Step 2 in PhD → Diploma order. */
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

export function isEngineeringRelatedChecked(row: ExperienceRow): boolean {
  if (row.domainFinal != null) return row.domainFinal;
  if (row.domainSuggested != null) return row.domainSuggested;
  return false;
}
