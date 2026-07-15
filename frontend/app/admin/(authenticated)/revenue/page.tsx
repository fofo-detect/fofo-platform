"use client";

import { useEffect, useState } from "react";
import { DashCard, ErrorBanner } from "@/components/dashboard/ui";
import { AdminRevenue, getAdminRevenue } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { getErrorMessage } from "@/lib/api";
import { formatDate, formatINR, formatUSD } from "@/lib/format";

const PROVIDER_LABELS: Record<string, string> = {
  rekognition: "AWS Rekognition",
  sightengine: "Sightengine",
  anthropic: "Anthropic / Claude",
};

export default function AdminRevenuePage() {
  const { token, handleAuthError } = useAdminAuth();
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminRevenue(token)
      .then(setData)
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load revenue data."));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Revenue & Profitability</h1>
        <p className="mt-1 text-sm text-dash-sub">
          Based on assigned subscription plans, not verified Stripe billing (not live yet).
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading || !data ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">MRR</p>
              <p className="mt-3 text-4xl font-semibold text-dash-ink">{formatINR(data.mrr)}</p>
            </DashCard>
            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">ARR</p>
              <p className="mt-3 text-4xl font-semibold text-dash-ink">{formatINR(data.arr)}</p>
            </DashCard>
          </div>

          <DashCard className="p-6">
            <h2 className="text-sm font-semibold text-dash-ink">Revenue breakdown</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-dash-hover p-4">
                <p className="text-xs text-dash-sub">Monthly plan total</p>
                <p className="mt-1 text-xl font-semibold text-dash-ink">
                  {formatINR(data.monthly_plan_revenue)}
                </p>
              </div>
              <div className="rounded-lg bg-dash-hover p-4">
                <p className="text-xs text-dash-sub">Annual plan total (MRR-equivalent)</p>
                <p className="mt-1 text-xl font-semibold text-dash-ink">{formatINR(data.annual_plan_revenue)}</p>
              </div>
            </div>
          </DashCard>

          <DashCard className="p-6">
            <h2 className="text-sm font-semibold text-dash-ink">Estimated API cost this month</h2>
            <div className="mt-4 flex flex-col divide-y divide-dash-border">
              {Object.entries(data.cost_breakdown_usd).map(([provider, cost]) => (
                <div key={provider} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-dash-sub">{PROVIDER_LABELS[provider] || provider}</span>
                  <span className="font-medium text-dash-ink">{formatUSD(cost)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5 text-sm font-semibold">
                <span className="text-dash-ink">Total</span>
                <span className="text-dash-ink">
                  {formatUSD(data.total_cost_this_month_usd)} ({formatINR(data.total_cost_this_month_inr)})
                </span>
              </div>
            </div>
          </DashCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">Gross margin</p>
              <p
                className={`mt-3 text-2xl font-semibold ${
                  data.gross_margin_inr >= 0 ? "text-dash-ink" : "text-brand-red"
                }`}
              >
                {formatINR(data.gross_margin_inr)}
              </p>
              <p className="mt-1 text-xs text-dash-sub">MRR − estimated API cost this month</p>
            </DashCard>
            <DashCard className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">Break-even</p>
              <p className="mt-3 text-2xl font-semibold text-dash-ink">
                {data.break_even_subscribers ?? 0} subscribers
              </p>
              <p className="mt-1 text-xs text-dash-sub">Needed to cover this month's tracked API cost</p>
            </DashCard>
          </div>

          <p className="rounded-lg border border-dash-border bg-dash-hover px-4 py-3 text-xs text-dash-sub">
            {data.fx_note}
          </p>

          <div>
            <h2 className="mb-4 text-base font-semibold text-dash-ink">Subscribers & payments</h2>
            <DashCard className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-dash-border text-xs uppercase tracking-wider text-dash-sub">
                  <tr>
                    <th className="px-5 py-3 font-medium">Subscriber</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Monthly value</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 font-medium">Next payment due (estimated)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscribers.map((sub) => (
                    <tr key={sub.id} className="border-b border-dash-border last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-dash-ink">{sub.name || "—"}</p>
                        <p className="text-xs text-dash-sub">{sub.email}</p>
                      </td>
                      <td className="px-5 py-3 text-dash-sub capitalize">{sub.plan || "monthly"}</td>
                      <td className="px-5 py-3 text-dash-sub">{formatINR(sub.mrr_value)}</td>
                      <td className="px-5 py-3 text-dash-sub">{formatDate(sub.created_at)}</td>
                      <td className="px-5 py-3 text-dash-sub">
                        {sub.next_payment_due ? formatDate(sub.next_payment_due) : "—"}
                        {sub.next_payment_due && (
                          <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            Estimated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashCard>
          </div>
        </>
      )}
    </div>
  );
}
