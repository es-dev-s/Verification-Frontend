"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredCaseId,
  deleteClientCase,
  getStoredCaseId,
  listClients,
} from "@/lib/api";
import type { ClientFilter, ClientSummary, ClientsResponse } from "@/lib/types";
import { formatPct, riskBadge } from "@/lib/riskDisplay";

const TABS: Array<{ value: ClientFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "unverified", label: "Unverified" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function StatusBadge({ client }: { client: ClientSummary }) {
  if (client.reviewStatus === "APPROVED") {
    return (
      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success-line">
        Approved
      </span>
    );
  }
  if (client.reviewStatus === "REJECTED") {
    return (
      <span className="rounded-full bg-[#f8ecec] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a3a3a] ring-1 ring-[#e2c4c4]">
        Rejected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface-tint px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted ring-1 ring-line">
      Unverified
    </span>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M8 2.75A.75.75 0 018.75 2h2.5a.75.75 0 01.75.75V4h3.25a.75.75 0 010 1.5h-.6l-.7 10.1A2 2 0 0111.96 17.5H8.04a2 2 0 01-1.99-1.9L5.35 5.5h-.6a.75.75 0 010-1.5H8V2.75zM6.86 5.5l.69 10a.5.5 0 00.5.5h3.9a.5.5 0 00.5-.5l.69-10H6.86zM8.5 7.5a.6.6 0 01.6.6v5.3a.6.6 0 01-1.2 0V8.1a.6.6 0 01.6-.6zm3 0a.6.6 0 01.6.6v5.3a.6.6 0 01-1.2 0V8.1a.6.6 0 01.6-.6z" />
    </svg>
  );
}

function ClientCard({
  client,
  onDelete,
}: {
  client: ClientSummary;
  onDelete: (client: ClientSummary, trigger: HTMLButtonElement) => void;
}) {
  const risk =
    client.riskLevel === "no_risk" ||
    client.riskLevel === "low" ||
    client.riskLevel === "medium" ||
    client.riskLevel === "high"
      ? riskBadge(client.riskLevel)
      : null;
  const degree = client.degreeTitle
    ? `${client.degreeTitle}${client.degreeLabel ? ` (${client.degreeLabel})` : ""}`
    : client.degreeLabel ?? "—";
  return (
    <li className="relative">
      <Link
        href={`/?case=${encodeURIComponent(client.caseId)}`}
        className="block rounded-2xl border border-line bg-surface/95 py-3.5 pl-4 pr-12 transition hover:border-brand-muted hover:shadow-[0_8px_24px_rgba(146,86,169,0.10)] sm:pl-5 sm:pr-14"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{client.name}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              Case {client.caseId.slice(-8)} · created {formatDate(client.createdAt)} ·{" "}
              {client.documentCount} document{client.documentCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {risk ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${risk.className}`}
              >
                {risk.label}
                {client.overallPct != null ? ` · ${formatPct(client.overallPct)}` : ""}
              </span>
            ) : null}
            <StatusBadge client={client} />
          </div>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[11px] text-ink-muted">ANZSCO</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {client.anzscoCode ? (
                <span className="mr-1.5 font-semibold tabular-nums text-brand-deeper">
                  {client.anzscoCode}
                </span>
              ) : null}
              {client.occupation ?? (client.anzscoCode ? "" : "—")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-ink-muted">Degree</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink">
              {degree}
              {client.institution ? (
                <span className="font-normal text-ink-muted"> · {client.institution}</span>
              ) : null}
            </dd>
          </div>
        </dl>
        {client.reviewStatus ? (
          <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-muted">
            {client.reviewStatus === "APPROVED" ? "Approved" : "Rejected"}{" "}
            {formatDate(client.reviewedAt)}
            {client.reviewComment ? ` — “${client.reviewComment}”` : ""}
          </p>
        ) : null}
      </Link>
      <button
        type="button"
        aria-label={`Delete client ${client.name}`}
        title="Delete client"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(client, e.currentTarget);
        }}
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint outline-none transition hover:bg-[#f8ecec] hover:text-[#8a3a3a] focus-visible:ring-2 focus-visible:ring-brand-ring sm:right-3.5"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function ConfirmDeleteDialog({
  client,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  client: ClientSummary;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!deleting) onCancel();
        return;
      }
      if (e.key === "Tab") {
        // Focus trap-lite: keep Tab cycling between the two buttons.
        const first = cancelRef.current;
        const last = deleteRef.current;
        if (!first || !last) return;
        const active = document.activeElement;
        if (active !== first && active !== last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#241f2a]/40 px-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
        aria-describedby="delete-client-desc"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_60px_rgba(36,31,42,0.25)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8ecec] text-[#8a3a3a]">
            <TrashIcon />
          </span>
          <div className="min-w-0">
            <h2 id="delete-client-title" className="text-base font-semibold text-ink">
              Delete client?
            </h2>
            <p className="mt-1 truncate text-sm font-medium text-ink">
              {client.name}
              {client.anzscoCode ? (
                <span className="font-normal text-ink-muted">
                  {" "}
                  · {client.anzscoCode}
                  {client.occupation ? ` ${client.occupation}` : ""}
                </span>
              ) : null}
            </p>
            <p id="delete-client-desc" className="mt-2 text-sm leading-relaxed text-ink-muted">
              This permanently deletes all of this client&apos;s documents, career
              episodes, extracted details, assessment and risk results, and the
              approval decision. This can&apos;t be undone.
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-[#f8ecec] px-3 py-2 text-sm text-[#8a3a3a]">
            Could not delete: {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink outline-none transition hover:bg-surface-tint focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={deleteRef}
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full bg-[#b42318] px-4 py-2 text-sm font-medium text-white outline-none transition hover:bg-[#912018] focus-visible:ring-2 focus-visible:ring-[#e2c4c4] focus-visible:ring-offset-1 disabled:opacity-70"
          >
            {deleting ? (
              <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : null}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Clients list filtered by Approved / Rejected / Unverified. Click a client to open the case. */
export function ClientsPage() {
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [data, setData] = useState<ClientsResponse | null>(null);
  const [loadedFilter, setLoadedFilter] = useState<ClientFilter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ClientSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);

  function openDelete(client: ClientSummary, trigger: HTMLButtonElement) {
    deleteTrigger.current = trigger;
    setDeleteError(null);
    setPendingDelete(client);
  }

  function closeDelete() {
    setPendingDelete(null);
    setDeleteError(null);
    deleteTrigger.current?.focus();
    deleteTrigger.current = null;
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteClientCase(target.caseId);
      if (getStoredCaseId() === target.caseId) clearStoredCaseId();
      setData((prev) => {
        if (!prev) return prev;
        const counts = { ...prev.counts };
        counts.all = Math.max(0, counts.all - 1);
        counts[target.verification] = Math.max(0, counts[target.verification] - 1);
        return {
          ...prev,
          counts,
          clients: prev.clients.filter((c) => c.caseId !== target.caseId),
        };
      });
      setPendingDelete(null);
      deleteTrigger.current = null;
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    listClients(filter)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setLoadedFilter(filter);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoadedFilter(filter);
      });
    return () => {
      alive = false;
    };
  }, [filter]);

  const loading = loadedFilter !== filter;
  const clients = useMemo(() => {
    const rows = data?.clients ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) =>
      [c.name, c.anzscoCode, c.occupation, c.degreeTitle, c.degreeLabel, c.institution]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, query]);

  return (
    <div className="min-h-full flex-1 bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">Clients</h1>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
          </p>
        </header>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Filter clients"
            className="inline-flex w-fit flex-wrap rounded-full border border-line bg-surface p-1"
          >
            {TABS.map((tab) => {
              const active = filter === tab.value;
              const count = data?.counts?.[tab.value];
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                  {typeof count === "number" ? (
                    <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-ink-faint"}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ANZSCO or degree"
            className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-brand sm:w-72"
          />
        </div>

        {data && !data.reviewsAvailable ? (
          <p className="mb-3 text-xs text-[#b45309]">
            Approval data is not set up yet (database migration pending) — every
            client is shown as unverified.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-sm text-[#b45309]">
            Could not load clients: {error}
          </p>
        ) : loading && !data ? (
          <p className="text-sm text-ink-muted">Loading clients…</p>
        ) : clients.length ? (
          <ul className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
            {clients.map((c) => (
              <ClientCard key={c.caseId} client={c} onDelete={openDelete} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface-tint px-4 py-10 text-center text-sm text-ink-muted">
            {query.trim()
              ? "No clients match your search."
              : filter === "approved"
                ? "No approved clients yet."
                : filter === "rejected"
                  ? "No rejected clients."
                  : filter === "unverified"
                    ? "No unverified clients."
                    : "No clients yet — upload documents in the Verification Engine to start one."}
          </p>
        )}
      </div>
      {pendingDelete ? (
        <ConfirmDeleteDialog
          client={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={closeDelete}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
