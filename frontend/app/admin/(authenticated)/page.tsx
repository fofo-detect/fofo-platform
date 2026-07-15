"use client";

import { useEffect, useState } from "react";
import { DashCard, ErrorBanner, ScanStatusBadge, StatCard } from "@/components/dashboard/ui";
import { AdminOverview, getAdminOverview } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { getErrorMessage } from "@/lib/api";
import { formatDateTime, formatINR, formatUSD } from "@/lib/format";

function TrendArrow({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-xs text-dash-sub">No prior data</span>;
  const up = percent >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-700" : "text-brand-red"}`}>
      {up ? "▲" : "▼"} {Math.abs(percent)}% vs last month
    </span>
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
        <h1 className="text-2xl font-semibold text-dash-ink">Business Overview</h1>
        <p className="mt-1 text-sm text-dash-sub">
          Revenue, subscriber health, and operations across every FOFO account.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading || !data ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="MRR" value={formatINR(data.mrr)} caption="Monthly recurring revenue" />
            <StatCard
              label="Active Subscribers"
              value={data.active_subscribers}
              caption={`${data.monthly_subscriber_count} monthly · ${data.annual_subscriber_count} annual`}
            />
            <StatCard
              label="Scans Today"
              value={data.scans_today}
              caption={`${data.scans_today_completed} succeeded · ${data.scans_today_failed} failed`}
            />
            <StatCard
              label="Critical Alerts (24h)"
              value={data.critical_high_last_24h}
              accent={data.critical_high_last_24h > 0}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">Revenue this month</p>
              <p className="mt-3 text-2xl font-semibold text-dash-ink">{formatINR(data.revenue_this_month)}</p>
              <p className="mt-1 text-xs text-dash-sub">Last month: {formatINR(data.revenue_last_month)}</p>
              <div className="mt-2">
                <TrendArrow percent={data.revenue_change_percent} />
              </div>
            </DashCard>

            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">Cost vs Revenue</p>
              <p className="mt-3 text-2xl font-semibold text-dash-ink">
                {formatINR(data.gross_profit_this_month_inr)}
              </p>
              <p className="mt-1 text-xs text-dash-sub">
                Gross profit — API cost this month: {formatUSD(data.cost_this_month_usd)}
              </p>
            </DashCard>

            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">Churn this month</p>
              <p className={`mt-3 text-2xl font-semibold ${data.churn_this_month > 0 ? "text-brand-red" : "text-dash-ink"}`}>
                {data.churn_this_month}
              </p>
              <p className="mt-1 text-xs text-dash-sub">Subscribers suspended this month</p>
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
