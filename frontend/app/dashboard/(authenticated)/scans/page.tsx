"use client";

import { ScanHistoryList } from "@/components/dashboard/ScanHistoryList";
import { ErrorBanner } from "@/components/dashboard/ui";
import { useDashboard } from "@/lib/dashboard-context";

export default function ScanHistoryPage() {
  const { scans, loading, error } = useDashboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Scan History</h1>
        <p className="mt-1 text-sm text-dash-sub">Every scan run against your enrolled face.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <ScanHistoryList scans={scans} loading={loading} />
    </div>
  );
}
