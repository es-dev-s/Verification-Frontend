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
  assessment?: AssessmentResult | null;
};

/** Step 6 manual decision; no saved review means pending. */
export type CaseReviewStatus = "APPROVED" | "REJECTED";

export type CaseReview = {
  status: CaseReviewStatus;
  comment: string | null;
  /** ISO time the current decision was saved. */
  reviewedAt: string;
  updatedAt: string;
};

export const CASE_REVIEW_COMMENT_MAX = 2000;

export type ProjectSource = "WORK_BASED" | "ACADEMIC_PERSONAL" | "FIRM_PREPARED";

export const PROJECT_SOURCE_OPTIONS: Array<{ value: ProjectSource; label: string }> = [
  { value: "WORK_BASED", label: "Work-based project" },
  { value: "ACADEMIC_PERSONAL", label: "Academic/personal project" },
  { value: "FIRM_PREPARED", label: "Firm-prepared project" },
];

export type CareerEpisode = {
  id: string;
  caseId: string;
  projectSource: ProjectSource | null;
  /** ExperienceRow id at link time (rows can be re-created; see experienceLabel). */
  experienceRowId: string | null;
  /** Snapshot of the linked role, e.g. "Site Engineer — ABC Pvt Ltd (2020 – Present)". */
  experienceLabel: string | null;
  originalName: string;
  format: DocumentFormat;
  sizeBytes: number;
  sha256: string;
  sortOrder: number;
  hasCalculations: boolean;
  hasDrawingsCad: boolean;
  hasDataTables: boolean;
  hasSiteProductImages: boolean;
  hasStandardsReferenced: boolean;
  hasQuantifiableOutcomes: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CareerEpisodeEvidenceField =
  | "hasCalculations"
  | "hasDrawingsCad"
  | "hasDataTables"
  | "hasSiteProductImages"
  | "hasStandardsReferenced"
  | "hasQuantifiableOutcomes";

export type CareerEpisodeEvidence = Record<CareerEpisodeEvidenceField, boolean>;

/** Evidence checkboxes shown on every career episode card (manual ticks). */
export const CAREER_EPISODE_EVIDENCE_OPTIONS: Array<{
  field: CareerEpisodeEvidenceField;
  label: string;
}> = [
  { field: "hasCalculations", label: "Calculations" },
  { field: "hasDrawingsCad", label: "Drawings / CAD" },
  { field: "hasDataTables", label: "Data tables" },
  { field: "hasSiteProductImages", label: "Site / product images" },
  { field: "hasStandardsReferenced", label: "Standards referenced" },
  { field: "hasQuantifiableOutcomes", label: "Quantifiable outcomes" },
];

/** Level a transcript subject row was scored under (Diploma levels are their own group). */
export type SubjectQualification =
  | "bachelor"
  | "master"
  | "diploma"
  | "advanced_diploma"
  | "associate_degree"
  | "unknown";

export type SubjectMatchRow = {
  transcriptName: string;
  transcriptCode: string | null;
  qualification: SubjectQualification;
  rubricSubject: string | null;
  tier: "tier1" | "tier2" | "tier3" | null;
  category: string | null;
  method: "exact" | "fuzzy" | "llm" | "none";
  confidence: number;
  reason?: string;
};

export type MissingSubjectsByTier = {
  tier1: string[];
  tier2: string[];
};

export type TranscriptSourceInfo = {
  kind: "bachelor" | "master" | "master_fallback" | "mixed" | "diploma" | "unknown";
  label: string;
};

export type RubricSubjectCatalogEntry = {
  name: string;
  tier: "tier1" | "tier2" | "tier3";
  category: string;
  variants: string[];
};

export type MatchedJob = {
  title: string;
  employer: string | null;
};

export type WorkExperienceCandidateAnalysis = {
  related: boolean;
  matchedJobs: MatchedJob[];
  analysis: string;
  confidenceScoreBefore: number;
  confidenceScoreAfter: number;
};

/** Gate 1 (qualification eligibility, checked before any scoring). */
export type Gate1Result = "open" | "manual_review" | "not_eligible";

/** Occupation tracks (categories in src/lib/anzsco_skill_levels.json). */
export type Gate1TrackId = "professional_engineer" | "engineering_technologist" | "engineering_associate";

export type Gate1Track = {
  track: Gate1TrackId;
  label: string;
  open: boolean;
  /** 1 = assess first; null when closed. */
  priority: number | null;
  /** Plain reason (why open / why closed). */
  reason: string;
  /** ANZSCO codes in this track. */
  anzscoCodes: string[];
  /** Occupations in this track that cannot be scored automatically (assess manually). */
  notes: string[];
};

/** Award level read from the DB level, the title and any training-package code. */
export type Gate1AwardLevel =
  | "certificate"
  | "diploma"
  | "advanced_diploma"
  | "associate_degree"
  | "bachelor"
  | "honours"
  | "graduate_diploma"
  | "master"
  | "doctorate"
  | "unknown";

export type Gate1Qualification = {
  title: string | null;
  level: SubjectQualification | "unknown";
  award: Gate1AwardLevel;
  aqfLevel: number | null;
  engineering: "yes" | "no" | "unclear";
  engineeringReason: string;
  /** Qualification.durationYears as entered (null when not stated). */
  statedYears: number | null;
  /** Counted from printed years / semesters (null when not reliably countable). */
  countedYears: number | null;
  /** Duration Gate 1 used (counted, else stated). */
  durationYears: number | null;
  durationSource: "counted" | "stated" | "none";
  /** How the count was made (or why it could not be). */
  durationMethod: string;
  /** Unusual-case flags (combined degree, part-time, credit transfer …). */
  flags: string[];
  /** True for the qualification that decided the gate. */
  used: boolean;
  /** Short outcome for this qualification. */
  outcome: string;
};

export type Gate1Decision = {
  result: Gate1Result;
  /** Spec rule that matched (1 not eligible, 2 manual review, 3 PE + Technologist, 4 Technologist, 5 Associate). */
  rule: 1 | 2 | 3 | 4 | 5;
  ruleLabel: string;
  /** Plain reason shown to the assessor. */
  reason: string;
  /** Title (or level) of the qualification that decided the gate; null when none. */
  qualificationUsed: string | null;
  tracks: Gate1Track[];
  qualifications: Gate1Qualification[];
  /** True when the duration used was the stated one (transcript had no years / semesters). */
  durationFallback: boolean;
  fallbackNote: string | null;
  /** Engineering decision for the qualification that decided the gate (null when none). */
  engineering: EngineeringDecision | null;
  notes: string[];
};

/** Legacy Step 1 routing (results saved before Gate 1). */
export type RoutingInfo = {
  routes: Array<"professional" | "draftsperson_academic" | "vocational" | "unknown">;
  label: string;
  basedOn: string;
  /** One-line note: "Scored as: <route> — based on <title>". */
  note: string;
  notes: string[];
  qualifications: Array<{
    title: string | null;
    level: string;
    route: string;
    reason: string;
  }>;
};

export type CoreBand = "no_risk" | "low_risk" | "medium_risk" | "high_risk";

export type VocationalUnitMatch = {
  unitId: string;
  code: string;
  title: string;
  transcriptCode: string | null;
  transcriptName: string;
  matchType: "exact" | "release" | "equivalent" | "typo" | "title";
  note: string;
  confidence: number;
  source?: string;
};

/** Unit-code (vocational) assessment detail for one occupation. */
export type VocationalAssessmentDetail = {
  occupationId: string;
  qualificationCodes: string[];
  coreMatched: number;
  coreTotal: number;
  coreBand: CoreBand;
  thresholds: { noRisk: number; lowRisk: number; mediumRisk: number };
  matchedCore: VocationalUnitMatch[];
  missingCore: Array<{ unitId: string; code: string; title: string }>;
  electivesFound: Array<{ code: string; name: string }>;
  electiveStatus: "not_assessed" | "met" | "not_met";
  electiveMinimum: number | null;
  electiveNote: string;
  qualificationMet: boolean;
  qualificationNote: string;
  flags: string[];
};

export type DurationEvidence = {
  level: SubjectQualification;
  title: string | null;
  statedYears: number | null;
  countedYears: number | null;
  minimumYears: number | null;
  creditTotal: number | null;
  method: string;
  unit: "semester" | "trimester" | "quarter" | "year" | "calendar" | null;
  confidence: "high" | "medium" | "low";
  status: "ok" | "below_minimum" | "mismatch" | "not_counted";
  capped: boolean;
  note: string;
};

export type EngineeringDecision = {
  decision: "yes" | "no" | "unclear";
  reason: string;
  titleSignal: "engineering" | "related" | "other" | "none";
  subjectShare: number | null;
  subjectsConsidered: number;
  capped: boolean;
  note: string | null;
};

export type FinalProjectEvidence = {
  title: string | null;
  term: string | null;
  inFinalYear: boolean | null;
  note: string | null;
};

export type QualificationEvidence = {
  duration: DurationEvidence[];
  engineering: EngineeringDecision;
  finalProject: FinalProjectEvidence | null;
};

export type AnzscoCandidate = {
  anzscoCode: string;
  title: string;
  foundationalMatched: number;
  foundationalExpected: number;
  foundationalPct: number;
  coreMatched: number;
  coreExpected: number;
  corePct: number;
  tier3GateMet: boolean;
  confidence?: "high" | "medium" | "low" | null;
  /** 0–100 numeric confidence for ranking and display. */
  confidenceScore?: number;
  determination?: "verified_no_risk" | "conditional" | "not_verified" | "no_match";
  recommended?: boolean;
  workExperienceBoost?: boolean;
  workExperienceAnalysis?: WorkExperienceCandidateAnalysis | null;
  matches: SubjectMatchRow[];
  missingSubjects: MissingSubjectsByTier;
  unmatched: Array<{
    name: string;
    code: string | null;
    qualification: SubjectQualification;
  }>;
  subjectCatalog?: RubricSubjectCatalogEntry[];
  /** Step 1 qualification-check notes (e.g. diploma-only, field to confirm). */
  qualificationNotes?: string[];
  /** True when the qualification check capped this occupation at conditional. */
  qualificationCapped?: boolean;
  /** "vocational_units" for unit-code occupations (e.g. 312311). */
  assessmentFlow?: "academic" | "vocational_units";
  tier1Outcome?: string | null;
  tier2Outcome?: string | null;
  /** Determination from the Step 3 bands (before surfacing as no_match). */
  bandDetermination?: "verified_no_risk" | "conditional" | "not_verified" | "no_match";
  gateDowngraded?: boolean;
  routeCapped?: boolean;
  vocational?: VocationalAssessmentDetail | null;
  /** Gate 1 track this occupation was scored under. */
  track?: Gate1TrackId;
};

export type RiskLevel = "no_risk" | "low" | "medium" | "high";

export type RiskComponentKey = "fundamental" | "core" | "historical";

/** One component of the overall academic alignment score (mirrors api risk/schemas.ts). */
export type RiskComponentScore = {
  key: RiskComponentKey;
  label: string;
  /** 0–100; null when there is no data. */
  pct: number | null;
  /** Configured weight (0–1). */
  weight: number;
  /** Weight applied after re-normalisation (0 when not used). */
  appliedWeight: number;
  used: boolean;
  reason?: string;
};

/** Weighted overall score and the governance settings used for it. */
export type RiskScoringBreakdown = {
  configVersion: string;
  components: RiskComponentScore[];
  overallPct: number;
  riskLevel: RiskLevel;
  bands: { noRisk: number; low: number; medium: number };
  historicalMinCases: number;
  renormalised: boolean;
  notes: string[];
};
export type Competence = "competent" | "not_competent";

export type PrecedentRiskLevel = "no_risk" | "slight_risk" | "high_risk";

export type PrecedentCaseRow = {
  id: string;
  occupation: string;
  degree: string | null;
  university: string | null;
  country: string | null;
  matchRisk: PrecedentRiskLevel;
  outcome: string | null;
  verifiedDate: string | null;
};

export type PrecedentCheck = {
  matchingCases: number;
  positiveOutcomeRate: number;
  overallRisk: PrecedentRiskLevel | null;
  riskCounts: {
    no_risk: number;
    slight_risk: number;
    high_risk: number;
  };
  cases: PrecedentCaseRow[];
};

export type RiskAssessmentResult = {
  anzscoCode: string;
  title: string;
  fundamentalPct: number;
  corePct: number;
  historicalPct: number;
  historical: {
    totalCases: number;
    positive: number;
    negative: number;
    banned: number;
    positivePct: number;
  };
  precedent: PrecedentCheck;
  overallPctBeforeWork: number;
  workExperienceBoost: boolean;
  workExperienceDelta: number;
  overallPct: number;
  riskLevel: RiskLevel;
  /** Components, weights and thresholds behind the overall score (absent on older saved results). */
  scoring?: RiskScoringBreakdown;
  /** Older saved results only (band-based rating, no longer produced). */
  baseRiskLevel?: RiskLevel;
  /** Older saved results only (band-based rating, no longer produced). */
  riskBasis?: string;
  stepThreeDetermination?: "verified_no_risk" | "conditional" | "not_verified" | "no_match";
  historicalModifierApplied?: boolean;
  riskNotes?: string[];
  assessmentFlow?: "academic" | "vocational_units";
  /** Competence check disagrees with the band (band stands; assessor to review). */
  competenceConflict?: boolean;
  reducingRisk: string[];
  increasingRisk: string[];
  missingMajorDomains: string;
  competence: Competence;
  competenceSource: "ai" | "manual";
  insight: string;
};

export type AssessmentResult = {
  anzscoCode: string | null;
  title: string | null;
  recommended: boolean;
  confidence: "high" | "medium" | "low" | null;
  /** 0–100 numeric confidence for the top recommended occupation. */
  confidenceScore?: number;
  determination: "verified_no_risk" | "conditional" | "not_verified" | "no_match";
  foundationalMatched: number;
  foundationalExpected: number;
  foundationalPct: number;
  coreMatched: number;
  coreExpected: number;
  corePct: number;
  tier1Outcome: string | null;
  tier2Outcome: string | null;
  tier3GateMet: boolean;
  workExperienceBoost: boolean;
  qualificationsUsed: Array<SubjectQualification>;
  matches: SubjectMatchRow[];
  unmatched: Array<{
    name: string;
    code: string | null;
    qualification: SubjectQualification;
  }>;
  missingSubjects?: MissingSubjectsByTier;
  transcriptSource?: TranscriptSourceInfo;
  mastersFallbackUsed?: boolean;
  candidates?: AnzscoCandidate[];
  extractedSubjects?: ExtractedSubjectRow[];
  qualificationNotes?: string[];
  /** Legacy Step 1 routing (results saved before Gate 1; no longer written). */
  routing?: RoutingInfo;
  /** Gate 1 qualification eligibility (decided before any scoring). */
  gate1?: Gate1Decision;
  /** Engineering decision and final-year project (duration is shown by Gate 1). */
  qualificationEvidence?: QualificationEvidence;
  /** Gate project / thesis title of the top occupation. */
  finalProjectTitle?: string | null;
  assessmentFlow?: "academic" | "vocational_units";
  bandDetermination?: "verified_no_risk" | "conditional" | "not_verified" | "no_match";
  explanation: string;
  risk?: RiskAssessmentResult;
};

export type ExtractedSubjectRow = {
  name: string;
  code?: string | null;
  credits?: string | null;
  grade?: string | null;
  yearOrSemester?: string | null;
  qualification: SubjectQualification;
  sourceSnippet?: string | null;
  isRepeat?: boolean;
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

/** Clients list (GET /clients) — one row per case, grouped by the Step 6 decision. */
export type ClientVerification = "approved" | "rejected" | "unverified";
export type ClientFilter = "all" | ClientVerification;

export type ClientSummary = {
  caseId: string;
  name: string;
  nameSource: "cv_text" | "cv_file" | "document_file" | "case_id";
  anzscoCode: string | null;
  occupation: string | null;
  degreeLevel: string | null;
  degreeLabel: string | null;
  degreeTitle: string | null;
  institution: string | null;
  riskLevel: string | null;
  overallPct: number | null;
  documentCount: number;
  verification: ClientVerification;
  reviewStatus: CaseReviewStatus | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientsResponse = {
  status: ClientFilter;
  counts: Record<ClientFilter, number>;
  reviewsAvailable: boolean;
  clients: ClientSummary[];
};

/** Gate 1 award level (Upload & details "Award level"). */
export type AwardLevel =
  | "certificate"
  | "diploma"
  | "advanced_diploma"
  | "associate_degree"
  | "bachelor"
  | "honours"
  | "graduate_diploma"
  | "master"
  | "doctorate"
  | "unknown";

export const AWARD_LEVEL_OPTIONS: Array<{ value: Exclude<AwardLevel, "unknown">; label: string }> = [
  { value: "certificate", label: "Certificate I–IV (AQF 1–4)" },
  { value: "diploma", label: "Diploma (AQF 5)" },
  { value: "advanced_diploma", label: "Advanced Diploma (AQF 6)" },
  { value: "associate_degree", label: "Associate Degree (AQF 6)" },
  { value: "bachelor", label: "Bachelor (AQF 7)" },
  { value: "honours", label: "Bachelor Honours (AQF 8)" },
  { value: "graduate_diploma", label: "Graduate Diploma / Certificate (AQF 8)" },
  { value: "master", label: "Master (AQF 9)" },
  { value: "doctorate", label: "Doctorate (AQF 10)" },
];

export type DurationCheckStatus = "match" | "mismatch" | "fallback" | "no_stated" | "missing";

export type TranscriptFinalProject = {
  title: string;
  term: string | null;
  inFinalYear: boolean | null;
};

export type TranscriptOverrides = {
  countedYears: number | null;
  creditTotal: number | null;
  finalProject: string | null;
  /** 0–1. */
  engineeringShare: number | null;
};

/** Transcript data for one qualification (Transcript data / Verify details). */
export type QualificationTranscriptSummary = {
  degreeLevel: DegreeLevel;
  title: string | null;
  fieldOfStudy: string | null;
  award: AwardLevel;
  awardLabel: string;
  aqfLevel: number | null;
  awardManual: boolean;
  detectedAward: AwardLevel;
  subjectCount: number;
  statedYears: number | null;
  transcript: {
    countedYears: number | null;
    terms: number | null;
    unit: "semester" | "trimester" | "quarter" | "year" | "calendar" | null;
    confidence: "high" | "medium" | "low";
    reliable: boolean;
    method: string;
    rowsWithTerm: number;
    creditTotal: number | null;
    finalProject: TranscriptFinalProject | null;
    engineeringShare: number | null;
  };
  overrides: TranscriptOverrides;
  effective: {
    countedYears: number | null;
    creditTotal: number | null;
    finalProject: TranscriptFinalProject | null;
    engineeringShare: number | null;
  };
  basis: "counted" | "manual" | "stated" | "none";
  basisLabel: string;
  fallback: boolean;
  showEngineeringShare: boolean;
  durationCheck: {
    status: DurationCheckStatus;
    toleranceYears: number;
    differenceYears: number | null;
    ok: boolean;
    message: string;
  };
};

export type TranscriptDataSummary = {
  transcriptCount: number;
  subjectCount: number;
  subjectsCurrent: boolean;
  source: string | null;
  toleranceYears: number;
  durationOk: boolean;
  message: string | null;
  qualifications: QualificationTranscriptSummary[];
};

/** Field names on FieldSource for the award details (Upload & details). */
export const AWARD_LEVEL_FIELD = "awardLevel";
export const FIELD_OF_STUDY_FIELD = "fieldOfStudy";

export function awardOptionLabel(level: AwardLevel | null | undefined): string {
  if (!level || level === "unknown") return "Not identified";
  return AWARD_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;
}
