"use client";

import { useEffect, useState } from "react";
import { DashCard, ErrorBanner } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { ApiUsage, getAdminApiUsage } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";

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
        <h1 className="text-2xl font-semibold text-dash-ink">API Usage & Costs</h1>
        <p className="mt-1 text-sm text-dash-sub">
          Self-tracked call counts (none of these providers expose a "calls this month" API), plus SerpAPI's
          real remaining credits.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading || !usage ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <UsageCard
            title="SerpAPI (Google Lens search)"
            rows={[
              { label: "Searches used today", value: usage.serpapi.calls_today },
              { label: "Searches used this month (tracked)", value: usage.serpapi.calls_this_month },
              { label: "This month usage (SerpAPI account)", value: usage.serpapi.this_month_usage ?? "—" },
              { label: "Plan searches left", value: usage.serpapi.plan_searches_left },
              { label: "Total searches left", value: usage.serpapi.total_searches_left ?? "—" },
            ]}
            note="Plan/total searches left is fetched live from SerpAPI's account endpoint."
          />

          <UsageCard
            title="YouTube Data API v3"
            rows={[
              { label: "Quota used today (searches)", value: usage.youtube.calls_today },
              { label: "Searches this month", value: usage.youtube.calls_this_month },
            ]}
            note="Each search costs 100 of the 10,000 free daily quota units (~100 searches/day). Google does not expose remaining quota via API - check Cloud Console for the authoritative number."
          />

          <UsageCard
            title="AWS Rekognition"
            rows={[
              { label: "Calls today", value: usage.rekognition.calls_today },
              { label: "Calls this month", value: usage.rekognition.calls_this_month },
            ]}
          />

          <UsageCard
            title="Sightengine (deepfake scoring)"
            rows={[
              { label: "Calls today", value: usage.sightengine.calls_today },
              { label: "Calls this month", value: usage.sightengine.calls_this_month },
            ]}
          />

          <UsageCard
            title="Anthropic / Claude"
            rows={[
              { label: "Calls today", value: usage.anthropic.calls_today },
              { label: "Calls this month", value: usage.anthropic.calls_this_month },
              {
                label: "Estimated cost this month",
                value: `~$${usage.anthropic.estimated_cost_usd_this_month.toFixed(2)}`,
              },
            ]}
            note={usage.anthropic.cost_note}
          />
        </div>
      )}
    </div>
  );
}
