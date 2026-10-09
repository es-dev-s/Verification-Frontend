import type {
  CareerEpisode,
  CareerEpisodeEvidence,
  CasePayload,
  CaseReview,
  CaseReviewStatus,
  DocumentType,
  DegreeLevel,
  ProjectSource,
} from "./types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

const CLIENT_KEY = "ve_client_id";
const CASE_KEY = "ve_case_id";

export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export function getStoredCaseId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CASE_KEY);
}

export function setStoredCaseId(id: string): void {
  localStorage.setItem(CASE_KEY, id);
}

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Client-Id", getClientId());
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function createCase(): Promise<{ id: string }> {
  return api("/cases", { method: "POST", body: "{}" });
}

export async function getCase(caseId: string): Promise<CasePayload> {
  return api(`/cases/${caseId}`);
}

export async function setOccupation(
  caseId: string,
  targetOccupation: string,
): Promise<void> {
  await api(`/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ targetOccupation }),
  });
}

export async function uploadDocument(
  caseId: string,
  type: DocumentType,
  file: File,
  degreeLevel?: DegreeLevel | null,
): Promise<{ documentId: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  if (type !== "CV" && degreeLevel) {
    form.append("degreeLevel", degreeLevel);
  }
  const qs = new URLSearchParams({ type });
  if (type !== "CV" && degreeLevel) {
    qs.set("degreeLevel", degreeLevel);
  }
  return api(`/cases/${caseId}/documents?${qs.toString()}`, {
    method: "POST",
    body: form,
  });
}

export type CareerEpisodeLink = {
  projectSource?: ProjectSource | null;
  experienceRowId?: string | null;
  experienceLabel?: string | null;
} & Partial<CareerEpisodeEvidence>;

/** Upload a career episode / project file (stored only — no OCR or parsing). */
export async function uploadCareerEpisode(
  caseId: string,
  file: File,
  link: CareerEpisodeLink,
): Promise<{ episode: CareerEpisode; episodes: CareerEpisode[] }> {
  const form = new FormData();
  const qs = new URLSearchParams();
  if (link.projectSource) qs.set("projectSource", link.projectSource);
  if (link.experienceRowId) qs.set("experienceRowId", link.experienceRowId);
  if (link.experienceLabel) qs.set("experienceLabel", link.experienceLabel);
  // Evidence ticks go as multipart fields placed before the file so the server sees them.
  for (const key of [
    "hasCalculations",
    "hasDrawingsCad",
    "hasDataTables",
    "hasSiteProductImages",
    "hasStandardsReferenced",
    "hasQuantifiableOutcomes",
  ] as const) {
    if (link[key] !== undefined) form.append(key, link[key] ? "true" : "false");
  }
  form.append("file", file);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api(`/cases/${caseId}/career-episodes${suffix}`, {
    method: "POST",
    body: form,
  });
}

export async function listCareerEpisodes(
  caseId: string,
): Promise<{ episodes: CareerEpisode[] }> {
  return api(`/cases/${caseId}/career-episodes`);
}

export async function updateCareerEpisode(
  caseId: string,
  episodeId: string,
  link: CareerEpisodeLink,
): Promise<{ episode: CareerEpisode; episodes: CareerEpisode[] }> {
  return api(`/cases/${caseId}/career-episodes/${episodeId}`, {
    method: "PATCH",
    body: JSON.stringify(link),
  });
}

export async function deleteCareerEpisode(
  caseId: string,
  episodeId: string,
): Promise<{ ok: true; episodes: CareerEpisode[] }> {
  return api(`/cases/${caseId}/career-episodes/${episodeId}`, {
    method: "DELETE",
  });
}

export async function setSelectedDegreeLevels(
  caseId: string,
  selectedDegreeLevels: DegreeLevel[],
): Promise<void> {
  await api(`/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ selectedDegreeLevels }),
  });
}

export async function setEngineeringTitledDegree(
  caseId: string,
  engineeringTitledDegree: boolean | null,
): Promise<void> {
  await api(`/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ engineeringTitledDegree }),
  });
}

export async function deleteDocument(
  caseId: string,
  docId: string,
): Promise<void> {
  await api(`/cases/${caseId}/documents/${docId}`, { method: "DELETE" });
}

export async function startRead(
  caseId: string,
  section: "education" | "experience",
  degreeLevel?: DegreeLevel | null,
): Promise<{
  jobId: string;
  status: string;
  cached?: boolean;
  degreeLevel?: string;
  result?: unknown;
  error?: string;
}> {
  if (section === "education" && degreeLevel) {
    return api(
      `/cases/${caseId}/read/education/${encodeURIComponent(degreeLevel)}`,
      { method: "POST" },
    );
  }
  return api(`/cases/${caseId}/read/${section}`, { method: "POST" });
}

export async function saveDraft(
  caseId: string,
  body: unknown,
): Promise<void> {
  await api(`/cases/${caseId}/draft`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function confirmCase(
  caseId: string,
  body: unknown,
): Promise<CasePayload> {
  return api(`/cases/${caseId}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function runAssessment(
  caseId: string,
  opts?: { force?: boolean },
): Promise<import("./types").AssessmentResult> {
  return api(`/cases/${caseId}/assess`, {
    method: "POST",
    body: JSON.stringify({ force: opts?.force ?? false }),
  });
}

export async function getAssessment(
  caseId: string,
): Promise<import("./types").AssessmentResult> {
  return api(`/cases/${caseId}/assess`);
}

export async function runRiskAssessment(
  caseId: string,
  body: { anzscoCode: string; title?: string },
): Promise<import("./types").RiskAssessmentResult> {
  return api(`/cases/${caseId}/risk`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getRiskAssessment(
  caseId: string,
): Promise<import("./types").RiskAssessmentResult> {
  return api(`/cases/${caseId}/risk`);
}

export async function patchRiskCompetence(
  caseId: string,
  competence: import("./types").Competence,
): Promise<import("./types").RiskAssessmentResult> {
  return api(`/cases/${caseId}/risk`, {
    method: "PATCH",
    body: JSON.stringify({ competence }),
  });
}

/** Step 6 — saved approve / reject decision (null when still pending). */
export async function getCaseReview(
  caseId: string,
): Promise<{ review: CaseReview | null }> {
  return api(`/cases/${caseId}/review`);
}

/** Save or overwrite the Step 6 decision for this case. */
export async function saveCaseReview(
  caseId: string,
  body: { status: CaseReviewStatus; comment: string | null },
): Promise<{ review: CaseReview }> {
  return api(`/cases/${caseId}/review`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Clients list for this browser's client id, filtered by Step 6 approval. */
export async function listClients(
  status: import("./types").ClientFilter = "all",
): Promise<import("./types").ClientsResponse> {
  return api(`/clients?status=${encodeURIComponent(status)}`);
}
