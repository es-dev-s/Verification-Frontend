export type DocumentType = "CV" | "TRANSCRIPT" | "CERTIFICATE";
export type DocumentStatus = "QUEUED" | "EXTRACTING" | "DONE" | "FAILED";
export type DocumentFormat = "PDF" | "PNG" | "JPG" | "DOCX";
export type DegreeLevel =
  | "diploma"
  | "advanced_diploma"
  | "bachelor"
  | "master"
  | "phd";

/** Display order for education blocks and upload sections (highest first). */
export const DEGREE_LEVEL_ORDER: DegreeLevel[] = [
  "phd",
  "master",
  "bachelor",
  "advanced_diploma",
  "diploma",
];

export const DEGREE_LEVEL_LABELS: Record<DegreeLevel, string> = {
  phd: "PhD",
  master: "Master's",
  bachelor: "Bachelor's",
  advanced_diploma: "Advanced Diploma",
  diploma: "Diploma",
};

export function sortDegreeLevels(levels: DegreeLevel[]): DegreeLevel[] {
  return [...levels].sort(
    (a, b) => DEGREE_LEVEL_ORDER.indexOf(a) - DEGREE_LEVEL_ORDER.indexOf(b),
  );
}

export type CaseDocument = {
  id: string;
  caseId: string;
  type: DocumentType;
  degreeLevel: DegreeLevel | null;
  originalName: string;
  format: DocumentFormat;
  sha256: string;
  status: DocumentStatus;
  error: string | null;
  text?: string | null;
  extractionMethod: string | null;
  ocrConfidence: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Bachelors = {
  degreeTitle: string | null;
  institution: string | null;
  country: string | null;
  durationYears: number | null;
  durationCalculated: boolean;
};

export type ExperienceRow = {
  id?: string;
  employer: string | null;
  title: string | null;
  start: string | null;
  end: string | null;
  statedDurationYears: number | null;
  domainSuggested: boolean | null;
  domainFinal: boolean | null;
};

export type Alternative = {
  value: string;
  sourceDocumentId: string;
  documentType: DocumentType;
  label?: string;
};

export type FieldSource = {
  id: string;
  field: string;
  degreeLevel?: DegreeLevel | null;
  sourceDocumentId: string | null;
  extractedValue: string | null;
  finalValue: string | null;
  confidence: number | null;
  alternatives: Alternative[] | null;
};

export type ReadJob = {
  id: string;
  caseId: string;
  section: "EDUCATION" | "EXPERIENCE";
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  error: string | null;
  stale: boolean;
  resultJson?: unknown;
};

export type CasePayload = {
  id: string;
  clientId: string;
  targetOccupation: string | null;
  status: "DRAFT" | "CONFIRMED";
  selectedDegreeLevels: DegreeLevel[];
  engineeringTitledDegree: boolean | null;
  documents: CaseDocument[];
  /** @deprecated Prefer qualifications — kept during multi-degree migration. */
  bachelors: Bachelors | null;
  qualifications: Qualification[];
  experienceRows: ExperienceRow[];
  fieldSources: FieldSource[];
  readJobs: ReadJob[];
  draftJson?: unknown;
};

export type Qualification = {
  id: string;
  degreeLevel: DegreeLevel;
  degreeTitle: string | null;
  institution: string | null;
  country: string | null;
  durationYears: number | null;
  durationCalculated: boolean;
};

export const UNCERTAIN_THRESHOLD = 0.7;

export function emptyBachelors(): Bachelors {
  return {
    degreeTitle: "",
    institution: "",
    country: "",
    durationYears: null,
    durationCalculated: false,
  };
}

/** Form-state helper for a qualification block (same fields as Bachelors). */
export function emptyQualification(): Bachelors {
  return emptyBachelors();
}

export function emptyExperience(): ExperienceRow {
  return {
    employer: "",
    title: "",
    start: "",
    end: "",
    statedDurationYears: null,
    domainSuggested: null,
    domainFinal: null,
  };
}

export const OCCUPATIONS = [
  "Software Engineer",
  "Data Analyst",
  "Registered Nurse",
  "Civil Engineer",
  "Accountant",
  "Teacher",
  "Electrician",
  "Chef",
  "Project Manager",
  "Marketing Specialist",
  "Other",
] as const;

export function sourceLabel(
  type: DocumentType | string | null | undefined,
): string {
  switch (type) {
    case "CERTIFICATE":
      return "from certificate";
    case "TRANSCRIPT":
      return "from transcript";
    case "CV":
      return "from CV";
    default:
      return "";
  }
}
