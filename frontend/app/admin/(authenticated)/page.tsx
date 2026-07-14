"use client";

import { useEffect, useState } from "react";
import { DashCard, ErrorBanner, ScanStatusBadge, StatCard } from "@/components/dashboard/ui";
import { AdminOverview, getAdminOverview } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-dash-hover px-3 py-3">
      <span className="text-lg font-semibold text-dash-ink">{value}</span>
      <span className="text-xs text-dash-sub">{label}</span>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { token, handleAuthError } = useAdminAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminOverview(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load overview."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Admin Overview</h1>
        <p className="mt-1 text-sm text-dash-sub">System-wide status across every FOFO subscriber.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading || !data ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active Subscribers" value={data.active_subscribers} />
            <StatCard
              label="Critical/High (24h)"
              value={data.critical_high_last_24h}
              accent={data.critical_high_last_24h > 0}
            />
            <StatCard
              label="API"
              value={data.system_status.api_healthy ? "Healthy" : "Down"}
              accent={!data.system_status.api_healthy}
            />
            <StatCard
              label="Database"
              value={data.system_status.supabase_healthy ? "Healthy" : "Down"}
              accent={!data.system_status.supabase_healthy}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DashCard className="p-6">
              <h2 className="text-sm font-semibold text-dash-ink">Scans run</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat label="Today" value={data.scans_today} />
                <MiniStat label="This week" value={data.scans_this_week} />
                <MiniStat label="This month" value={data.scans_this_month} />
              </div>
            </DashCard>
            <DashCard className="p-6">
              <h2 className="text-sm font-semibold text-dash-ink">Detections found</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat label="Today" value={data.detections_today} />
                <MiniStat label="This week" value={data.detections_this_week} />
                <MiniStat label="This month" value={data.detections_this_month} />
              </div>
            </DashCard>
          </div>

          <div>
            <h2 className="mb-4 text-base font-semibold text-dash-ink">Recent activity</h2>
            {data.recent_activity.length === 0 ? (
              <DashCard className="flex items-center justify-center py-12 text-sm text-dash-sub">
                No scans yet.
              </DashCard>
            ) : (
              <DashCard className="divide-y divide-dash-border p-0">
                {data.recent_activity.map((item) => (
                  <div
                    key={item.scan_id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <ScanStatusBadge status={item.status} />
                      <div>
                        <p className="text-sm font-medium text-dash-ink">
                          {item.subscriber_name || item.subscriber_email || "Unknown subscriber"}
                        </p>
                        <p className="text-xs text-dash-sub">{formatDateTime(item.started_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm text-dash-sub">
                      <span>
                        <span className="font-medium text-dash-ink">{item.candidates_found}</span> checked
                      </span>
                      <span>
                        <span className="font-medium text-dash-ink">{item.matches_found}</span> matches
                      </span>
                    </div>
                  </div>
                ))}
              </DashCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
