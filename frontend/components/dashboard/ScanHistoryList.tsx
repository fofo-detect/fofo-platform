"use client";

import { DashCard, EmptyState, ScanStatusBadge } from "@/components/dashboard/ui";
import { ScanResponse } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";

export function ScanHistoryList({ scans, loading = false }: { scans: ScanResponse[]; loading?: boolean }) {
  if (loading) {
    return (
      <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">
        Loading scan history…
      </DashCard>
    );
  }

  if (scans.length === 0) {
    return <EmptyState title="No scans yet" description="Run your first scan from the Overview page." />;
  }

  return (
    <DashCard className="divide-y divide-dash-border p-0">
      {scans.map((scan) => (
        <ScanRow key={scan.scan_id} scan={scan} />
      ))}
    </DashCard>
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
