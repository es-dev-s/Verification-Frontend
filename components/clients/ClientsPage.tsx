"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listClients } from "@/lib/api";
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

function ClientCard({ client }: { client: ClientSummary }) {
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
    <li>
      <Link
        href={`/?case=${encodeURIComponent(client.caseId)}`}
        className="block rounded-2xl border border-line bg-surface/95 px-4 py-3.5 transition hover:border-brand-muted hover:shadow-[0_8px_24px_rgba(146,86,169,0.10)] sm:px-5"
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
    </li>
  );
}

/** Clients list filtered by Approved / Rejected / Unverified. Click a client to open the case. */
export function ClientsPage() {
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [data, setData] = useState<ClientsResponse | null>(null);
  const [loadedFilter, setLoadedFilter] = useState<ClientFilter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
    <div className="min-h-full flex-1 bg-[radial-gradient(900px_420px_at_10%_-10%,#efe4f5_0%,transparent_55%),radial-gradient(720px_400px_at_100%_0%,#f3eaf8_0%,transparent_52%),#faf8fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">Clients</h1>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">
            Grouped by the Step 6 decision: approved, rejected, or unverified (no
            decision yet). Click a client to open their case in the Verification Engine.
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
              <ClientCard key={c.caseId} client={c} />
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
    </div>
  );
}
