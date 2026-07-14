"use client";

import { useEffect, useState } from "react";
import { DashCard, EmptyState, ErrorBanner, ScanStatusBadge } from "@/components/dashboard/ui";
import { ScanStatus, getErrorMessage } from "@/lib/api";
import { AdminScan, listAdminScans } from "@/lib/admin-api";
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
  const [statusFilter, setStatusFilter] = useState<ScanStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAdminScans(token, { status: statusFilter === "ALL" ? undefined : statusFilter })
      .then((res) => setScans(res.scans))
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load scans."));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Scan Monitor</h1>
        <p className="mt-1 text-sm text-dash-sub">Every scan run across every subscriber.</p>
      </div>

      {error && <ErrorBanner message={error} />}

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
                <span>{formatDuration(scan.started_at, scan.completed_at)}</span>
              </div>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
