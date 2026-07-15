"use client";

import { useEffect, useState } from "react";
import { DetectionsTable } from "@/components/dashboard/DetectionsTable";
import { ScanHistoryList } from "@/components/dashboard/ScanHistoryList";
import { ErrorBanner } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { AdminSubscriberDetail, getAdminSubscriber } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDate, formatINR } from "@/lib/format";

// Mirrors backend services/business_metrics.add_months exactly (clamp day to
// the target month's last day) so this reconstructed schedule lines up with
// the single next_payment_due date the API actually returns.
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const newYear = year + Math.floor(month / 12);
  const newMonth = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const day = Math.min(date.getDate(), daysInMonth);
  return new Date(newYear, newMonth, day, date.getHours(), date.getMinutes(), date.getSeconds());
}

function buildPaymentSchedule(
  createdAt: string | null,
  plan: string | null,
  nextDue: string | null
): Array<{ date: Date; status: "paid" | "upcoming" }> {
  if (!createdAt) return [];
  const months = plan === "annual" ? 12 : 1;
  const nextDueDate = nextDue ? new Date(nextDue) : null;
  const schedule: Array<{ date: Date; status: "paid" | "upcoming" }> = [{ date: new Date(createdAt), status: "paid" }];

  let cursor = new Date(createdAt);
  for (let i = 0; i < 60; i++) {
    cursor = addMonthsClamped(cursor, months);
    if (nextDueDate && cursor.getTime() >= nextDueDate.getTime()) {
      schedule.push({ date: cursor, status: "upcoming" });
      break;
    }
    schedule.push({ date: cursor, status: "paid" });
  }
  return schedule;
}

export function SubscriberDetailModal({ subscriberId, onClose }: { subscriberId: string; onClose: () => void }) {
  const { token, handleAuthError } = useAdminAuth();
  const [data, setData] = useState<AdminSubscriberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminSubscriber(token, subscriberId)
      .then(setData)
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load subscriber."));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriberId]);

  const schedule = data
    ? buildPaymentSchedule(data.subscriber.created_at, data.subscriber.plan, data.subscriber.next_payment_due)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <h2 className="text-lg font-semibold text-dash-ink">Subscriber profile</h2>
          <button onClick={onClose} className="text-dash-sub hover:text-dash-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {error && <ErrorBanner message={error} />}

          {loading || !data ? (
            <p className="py-10 text-center text-sm text-dash-sub">Loading…</p>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-semibold text-dash-ink">
                  {data.subscriber.name || "Unnamed subscriber"}
                </h3>
                <p className="text-sm text-dash-sub">{data.subscriber.email}</p>
                <p className="text-sm text-dash-sub">{data.subscriber.phone || "No phone on file"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-dash-sub">Plan</p>
                  <p className="text-sm font-medium capitalize text-dash-ink">{data.subscriber.plan || "monthly"}</p>
                </div>
                <div>
                  <p className="text-xs text-dash-sub">MRR value</p>
                  <p className="text-sm font-medium text-dash-ink">{formatINR(data.subscriber.mrr_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-dash-sub">Status</p>
                  <p className="text-sm font-medium capitalize text-dash-ink">{data.subscriber.account_status}</p>
                </div>
                <div>
                  <p className="text-xs text-dash-sub">Joined</p>
                  <p className="text-sm font-medium text-dash-ink">{formatDate(data.subscriber.created_at)}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-dash-ink">
                  Estimated payment history
                  <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                    Estimated
                  </span>
                </h4>
                <p className="mb-2 text-xs text-dash-sub">
                  Computed from join date + plan interval - Stripe isn't live yet, so these are not verified
                  payments.
                </p>
                {schedule.length === 0 ? (
                  <p className="text-sm text-dash-sub">No join date on file.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-dash-border rounded-lg border border-dash-border">
                    {schedule.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-dash-ink">{formatDate(item.date.toISOString())}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.status === "upcoming"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.status === "upcoming" ? "Upcoming" : "Paid (estimated)"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-dash-ink">Scans</h4>
                <ScanHistoryList scans={data.scans} />
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-dash-ink">Detections</h4>
                <DetectionsTable detections={data.detections} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
