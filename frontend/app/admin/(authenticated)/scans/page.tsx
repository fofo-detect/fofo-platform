"use client";

import { useEffect, useMemo, useState } from "react";
import { DashCard, EmptyState, ErrorBanner, ScanStatusBadge, StatCard } from "@/components/dashboard/ui";
import { ScanStatus, getErrorMessage } from "@/lib/api";
import { AdminScan, AdminSubscriber, listAdminScans, listAdminSubscribers } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDateTime, formatDuration } from "@/lib/format";

const STATUS_FILTERS: Array<{ label: string; value: ScanStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export default function AdminScanMonitorPage() {
  const { token, handleAuthError } = useAdminAuth();
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
  const [statusFilter, setStatusFilter] = useState<ScanStatus | "ALL">("ALL");
  const [subscriberFilter, setSubscriberFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdminSubscribers(token)
      .then((res) => setSubscribers(res.subscribers))
      .catch(() => {
        // Non-fatal: the subscriber filter dropdown just stays empty.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAdminScans(token, {
      status: statusFilter === "ALL" ? undefined : statusFilter,
      subscriber_id: subscriberFilter || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
    })
      .then((res) => setScans(res.scans))
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load scans."));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, subscriberFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const finished = scans.filter((s) => s.status === "completed" || s.status === "failed");
    const completed = scans.filter((s) => s.status === "completed");
    const successRate = finished.length > 0 ? Math.round((completed.length / finished.length) * 100) : null;

    const durations = completed
      .filter((s) => s.completed_at)
      .map((s) => (new Date(s.completed_at as string).getTime() - new Date(s.started_at).getTime()) / 1000);
    const avgSeconds = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    const avgCandidates =
      completed.length > 0 ? completed.reduce((a, s) => a + s.candidates_found, 0) / completed.length : null;
    const avgMatches =
      completed.length > 0 ? completed.reduce((a, s) => a + s.matches_found, 0) / completed.length : null;

    const totalCandidates = completed.reduce((a, s) => a + s.candidates_found, 0);
    const totalOpencvFiltered = completed.reduce((a, s) => a + (s.opencv_filtered ?? 0), 0);
    const opencvFilterRate = totalCandidates > 0 ? Math.round((totalOpencvFiltered / totalCandidates) * 100) : null;

    return { successRate, avgSeconds, avgCandidates, avgMatches, opencvFilterRate };
  }, [scans]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Scan Operations</h1>
        <p className="mt-1 text-sm text-dash-sub">Every scan run across every subscriber.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Success Rate"
          value={stats.successRate !== null ? `${stats.successRate}%` : "—"}
          accent={stats.successRate !== null && stats.successRate < 80}
        />
        <StatCard
          label="Avg Scan Time"
          value={stats.avgSeconds !== null ? `${Math.round(stats.avgSeconds)}s` : "—"}
        />
        <StatCard
          label="Avg Candidates Checked"
          value={stats.avgCandidates !== null ? Math.round(stats.avgCandidates) : "—"}
        />
        <StatCard
          label="Avg Matches Found"
          value={stats.avgMatches !== null ? stats.avgMatches.toFixed(1) : "—"}
        />
        <StatCard
          label="OpenCV Filtered"
          value={stats.opencvFilterRate !== null ? `${stats.opencvFilterRate}%` : "—"}
        />
      </div>

      <DashCard className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === value
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-dash-border bg-white text-dash-sub hover:text-dash-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </DashCard>

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : scans.length === 0 ? (
        <EmptyState title="No scans match this filter" />
      ) : (
        <DashCard className="divide-y divide-dash-border p-0">
          {scans.map((scan) => (
            <div
              key={scan.scan_id}
              className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                scan.status === "failed" ? "bg-red-50/60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <ScanStatusBadge status={scan.status} />
                <div>
                  <p className="text-sm font-medium text-dash-ink">
                    {scan.subscriber_name || scan.subscriber_email || "Unknown subscriber"}
                  </p>
                  <p className="text-xs text-dash-sub">{formatDateTime(scan.started_at)}</p>
                  {scan.status === "failed" && scan.error_message && (
                    <p className="mt-1 max-w-md text-xs font-medium text-brand-red">{scan.error_message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-dash-sub">
                <span>
                  <span className="font-medium text-dash-ink">{scan.candidates_found}</span> checked
                </span>
                <span>
                  <span className="font-medium text-dash-ink">{scan.matches_found}</span> matches
                </span>
                <span>
                  <span className="font-medium text-dash-ink">{scan.opencv_filtered ?? 0}</span> OpenCV-filtered
                </span>
                <span>{formatDuration(scan.started_at, scan.completed_at)}</span>
              </div>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
