export type DocumentType = "CV" | "TRANSCRIPT" | "CERTIFICATE";
export type DocumentStatus = "QUEUED" | "EXTRACTING" | "DONE" | "FAILED";
export type DocumentFormat = "PDF" | "PNG" | "JPG" | "DOCX";

export type CaseDocument = {
  id: string;
  caseId: string;
  type: DocumentType;
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
  documents: CaseDocument[];
  bachelors: Bachelors | null;
  experienceRows: ExperienceRow[];
  fieldSources: FieldSource[];
  readJobs: ReadJob[];
  draftJson?: unknown;
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

export function emptyExperience(): ExperienceRow {
  return {
    employer: "",
    title: "",
    start: "",
    end: "",
    statedDurationYears: null,
    domainSuggested: null,
    domainFinal: false,
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
