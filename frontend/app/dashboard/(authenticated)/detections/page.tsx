"use client";

import { useEffect } from "react";
import { DetectionsTable } from "@/components/dashboard/DetectionsTable";
import { ErrorBanner } from "@/components/dashboard/ui";
import { useDashboard } from "@/lib/dashboard-context";

export default function DetectionsPage() {
  const { detections, loading, error, markDetectionsViewed } = useDashboard();

  useEffect(() => {
    markDetectionsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Detections</h1>
        <p className="mt-1 text-sm text-dash-sub">Every match found across your scans.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <DetectionsTable detections={detections} loading={loading} />
    </div>
  );
}
