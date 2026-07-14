"use client";

import { useEffect, useMemo, useState } from "react";
import { DashCard, EmptyState, ErrorBanner, PlatformLabel, RiskBadge } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { RiskLevel } from "@/lib/api";
import { AdminDetection, AdminSubscriber, listAdminDetections, listAdminSubscribers } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDate, formatScore, sourceHost } from "@/lib/format";

const RISK_FILTERS: Array<{ label: string; value: RiskLevel | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Critical", value: "CRITICAL" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Highest Risk", value: "risk" },
  { label: "Highest Deepfake Score", value: "deepfake" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];
const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const PAGE_SIZE = 25;

export default function AdminDetectionsPage() {
  const { token, handleAuthError } = useAdminAuth();
  const [detections, setDetections] = useState<AdminDetection[]>([]);
  const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [platformFilter, setPlatformFilter] = useState("");
  const [subscriberFilter, setSubscriberFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    listAdminSubscribers(token)
      .then((res) => setSubscribers(res.subscribers))
      .catch(() => {
        // Non-fatal: the subscriber filter dropdown just stays empty.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function load() {
    setLoading(true);
    setError(null);
    listAdminDetections(token, {
      risk_level: riskFilter === "ALL" ? undefined : riskFilter,
      platform: platformFilter || undefined,
      subscriber_id: subscriberFilter || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
    })
      .then((res) => setDetections(res.detections))
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load detections."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, riskFilter, platformFilter, subscriberFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    return [...detections].sort((a, b) => {
      if (sort === "risk") {
        return (RISK_ORDER[b.risk_level ?? ""] ?? 0) - (RISK_ORDER[a.risk_level ?? ""] ?? 0);
      }
      if (sort === "deepfake") {
        return (b.deepfake_score ?? 0) - (a.deepfake_score ?? 0);
      }
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [detections, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">All Detections</h1>
        <p className="mt-1 text-sm text-dash-sub">Every detection found across every subscriber.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <DashCard className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          {RISK_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRiskFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                riskFilter === value
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-dash-border bg-white text-dash-sub hover:text-dash-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            placeholder="Filter by platform…"
            className="rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
          />

          <select
            value={subscriberFilter}
            onChange={(e) => setSubscriberFilter(e.target.value)}
            className="rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
          >
            <option value="">All subscribers</option>
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.email}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
          />
          <span className="text-sm text-dash-sub">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            className="ml-auto rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </DashCard>

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : sorted.length === 0 ? (
        <EmptyState title="No detections match these filters" />
      ) : (
        <>
          <DashCard className="divide-y divide-dash-border p-0">
            {pageRows.map((d) => (
              <div key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                {d.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image_url} alt="Detected match" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-dash-hover" />
                )}

                <div className="min-w-0 flex-1">
                  {d.source_url ? (
                    <a
                      href={d.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium text-dash-ink underline decoration-dash-border decoration-1 underline-offset-2 hover:text-brand-red"
                    >
                      {sourceHost(d.source_url)}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-dash-sub">No source URL</span>
                  )}
                  <p className="mt-0.5 text-xs text-dash-sub">
                    <PlatformLabel platform={d.platform} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-dash-sub">
                    {d.subscriber_name || d.subscriber_email || "Unknown subscriber"}
                  </p>
                </div>

                <div className="flex items-center gap-6 sm:gap-8">
                  <div className="text-right">
                    <p className="text-xs text-dash-sub">Deepfake score</p>
                    <p className="text-sm font-medium text-dash-ink">{formatScore(d.deepfake_score)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dash-sub">Found</p>
                    <p className="text-sm font-medium text-dash-ink">{formatDate(d.created_at)}</p>
                  </div>
                  <RiskBadge level={d.risk_level} />
                </div>
              </div>
            ))}
          </DashCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-dash-sub">
              <span>
                Page {page} of {totalPages} · {sorted.length} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-dash-border bg-white px-3 py-1.5 font-medium text-dash-ink disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-dash-border bg-white px-3 py-1.5 font-medium text-dash-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
