"use client";

import { DashCard, EmptyState, ErrorBanner, ScanStatusBadge } from "@/components/dashboard/ui";
import { ScanResponse } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard-context";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "—";
  const seconds = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export default function ScanHistoryPage() {
  const { scans, loading, error } = useDashboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Scan History</h1>
        <p className="mt-1 text-sm text-dash-sub">Every scan run against your enrolled face.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">
          Loading scan history…
        </DashCard>
      ) : scans.length === 0 ? (
        <EmptyState title="No scans yet" description="Run your first scan from the Overview page." />
      ) : (
        <DashCard className="divide-y divide-dash-border p-0">
          {scans.map((scan) => (
            <ScanRow key={scan.scan_id} scan={scan} />
          ))}
        </DashCard>
      )}
    </div>
  );
}

function ScanRow({ scan }: { scan: ScanResponse }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-3">
        <ScanStatusBadge status={scan.status} />
        <span className="text-sm font-medium text-dash-ink">{formatDateTime(scan.started_at)}</span>
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
  );
}
