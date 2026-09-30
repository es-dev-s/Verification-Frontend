import type { CasePayload, DocumentType, DegreeLevel } from "./types";

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

export async function setSelectedDegreeLevels(
  caseId: string,
  selectedDegreeLevels: DegreeLevel[],
): Promise<void> {
  await api(`/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ selectedDegreeLevels }),
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
