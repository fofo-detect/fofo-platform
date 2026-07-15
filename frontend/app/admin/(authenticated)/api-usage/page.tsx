"use client";

import { useEffect, useState } from "react";
import { DashCard, ErrorBanner, StatCard } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { ApiUsage, getAdminApiUsage } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatUSD } from "@/lib/format";

const SERPAPI_WARNING_THRESHOLD = 100;

function UsageCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Array<{ label: string; value: string | number | null }>;
  note?: string;
}) {
  return (
    <DashCard className="p-6">
      <h2 className="text-sm font-semibold text-dash-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-dash-sub">{row.label}</span>
            <span className="font-medium text-dash-ink">{row.value ?? "—"}</span>
          </div>
        ))}
      </div>
      {note && <p className="mt-4 text-xs text-dash-sub">{note}</p>}
    </DashCard>
  );
}

function SerpApiGauge({ usage }: { usage: ApiUsage["serpapi"] }) {
  const remaining = usage.plan_searches_left;
  const low = remaining !== null && remaining < SERPAPI_WARNING_THRESHOLD;
  return (
    <DashCard className={`p-6 ${low ? "border-brand-red/40 bg-red-50/40" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-ink">SerpAPI credits remaining</h2>
        {low && (
          <span className="rounded-full bg-brand-red px-2.5 py-1 text-[11px] font-semibold uppercase text-white">
            Low
          </span>
        )}
      </div>
      <p className={`mt-3 text-4xl font-semibold ${low ? "text-brand-red" : "text-dash-ink"}`}>
        {remaining ?? "—"}
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-dash-hover">
        <div
          className={`h-full rounded-full ${low ? "bg-brand-red" : "bg-emerald-500"}`}
          style={{ width: `${remaining !== null ? Math.min(100, (remaining / 500) * 100) : 0}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-dash-sub">Searches today</p>
          <p className="font-medium text-dash-ink">{usage.calls_today}</p>
        </div>
        <div>
          <p className="text-xs text-dash-sub">Days until exhausted (burn rate)</p>
          <p className="font-medium text-dash-ink">
            {usage.days_until_exhausted !== null ? `~${usage.days_until_exhausted}` : "—"}
          </p>
        </div>
      </div>
    </DashCard>
  );
}

export default function AdminApiUsagePage() {
  const { token, handleAuthError } = useAdminAuth();
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminApiUsage(token)
      .then(setUsage)
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load API usage."));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Costs & Usage</h1>
        <p className="mt-1 text-sm text-dash-sub">
          Self-tracked call counts (none of these providers expose a "calls this month" API), plus SerpAPI's
          real remaining credits.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading || !usage ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Est. Cost (month)" value={formatUSD(usage.total_estimated_cost_usd_this_month)} />
            <StatCard
              label="Cost per Subscriber"
              value={usage.cost_per_subscriber_this_month_usd !== null ? formatUSD(usage.cost_per_subscriber_this_month_usd) : "—"}
            />
            <StatCard label="SerpAPI Searches (month)" value={usage.serpapi.calls_this_month} />
            <StatCard label="YouTube Quota Used Today" value={`${usage.youtube.calls_today * 100} units`} />
          </div>

          <p className="rounded-lg border border-dash-border bg-dash-hover px-4 py-3 text-xs text-dash-sub">
            {usage.cost_scope_note}
          </p>

          <SerpApiGauge usage={usage.serpapi} />

          <div className="grid gap-4 md:grid-cols-2">
            <UsageCard
              title="YouTube Data API v3"
              rows={[
                { label: "Quota used today (searches)", value: usage.youtube.calls_today },
                { label: "Searches this month", value: usage.youtube.calls_this_month },
              ]}
              note="Each search costs 100 of the 10,000 free daily quota units. Google does not expose remaining quota via API - check Cloud Console for the authoritative number."
            />

            <UsageCard
              title="AWS Rekognition"
              rows={[
                { label: "Calls today", value: usage.rekognition.calls_today },
                { label: "Calls this month", value: usage.rekognition.calls_this_month },
                { label: "Estimated cost this month", value: formatUSD(usage.rekognition.estimated_cost_usd_this_month) },
              ]}
              note="~$1 per 1,000 CompareFaces calls (AWS public pricing, tier 1) - rough estimate, not an invoice."
            />

            <UsageCard
              title="Sightengine (deepfake scoring)"
              rows={[
                { label: "Calls today", value: usage.sightengine.calls_today },
                { label: "Calls this month", value: usage.sightengine.calls_this_month },
                { label: "Estimated cost this month", value: formatUSD(usage.sightengine.estimated_cost_usd_this_month) },
              ]}
              note="Placeholder per-call rate - verify against your actual Sightengine plan."
            />

            <UsageCard
              title="Anthropic / Claude"
              rows={[
                { label: "Calls today", value: usage.anthropic.calls_today },
                { label: "Calls this month", value: usage.anthropic.calls_this_month },
                { label: "Estimated cost this month", value: formatUSD(usage.anthropic.estimated_cost_usd_this_month) },
              ]}
              note={usage.anthropic.cost_note}
            />
          </div>
        </>
      )}
    </div>
  );
}
