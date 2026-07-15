"use client";

import { useEffect, useMemo, useState } from "react";
import { SubscriberDetailModal } from "@/components/admin/SubscriberDetailModal";
import { DashButton, DashCard, ErrorBanner } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { AdminSubscriber, adminTriggerScan, listAdminSubscribers, updateSubscriberAccountStatus } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDate, formatINR } from "@/lib/format";

type FilterValue = "all" | "active" | "suspended" | "monthly" | "annual" | "never_scanned";

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Monthly", value: "monthly" },
  { label: "Annual", value: "annual" },
  { label: "Never Scanned", value: "never_scanned" },
];

function Avatar({ name, email }: { name: string | null; email: string }) {
  const label = (name || email || "?").trim();
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-xs font-semibold text-brand-red">
      {initials || "?"}
    </span>
  );
}

function rowClassName(sub: AdminSubscriber): string {
  if (sub.account_status === "suspended") return "bg-red-50/70 hover:bg-red-50";
  if (!sub.last_scan_at) return "bg-amber-50/70 hover:bg-amber-50";
  return "hover:bg-dash-hover/60";
}

export default function AdminSubscribersPage() {
  const { token, handleAuthError } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listAdminSubscribers(token)
      .then((res) => setSubscribers(res.subscribers))
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load subscribers."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "active":
        return subscribers.filter((s) => s.account_status === "active");
      case "suspended":
        return subscribers.filter((s) => s.account_status === "suspended");
      case "monthly":
        return subscribers.filter((s) => (s.plan || "monthly") !== "annual");
      case "annual":
        return subscribers.filter((s) => s.plan === "annual");
      case "never_scanned":
        return subscribers.filter((s) => !s.last_scan_at);
      default:
        return subscribers;
    }
  }, [subscribers, filter]);

  async function handleToggleStatus(sub: AdminSubscriber) {
    setActionError(null);
    setBusyId(sub.id);
    const next = sub.account_status === "active" ? "suspended" : "active";
    try {
      await updateSubscriberAccountStatus(token, sub.id, next);
      setSubscribers((prev) => prev.map((s) => (s.id === sub.id ? { ...s, account_status: next } : s)));
    } catch (err) {
      if (!handleAuthError(err)) setActionError(getErrorMessage(err, "Could not update account status."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleTriggerScan(sub: AdminSubscriber) {
    setActionError(null);
    setActionMessage(null);
    setBusyId(sub.id);
    try {
      await adminTriggerScan(token, sub.id);
      setActionMessage(`Scan started for ${sub.name || sub.email}.`);
    } catch (err) {
      if (!handleAuthError(err)) setActionError(getErrorMessage(err, "Could not start scan."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Subscribers</h1>
        <p className="mt-1 text-sm text-dash-sub">{subscribers.length} total accounts.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {actionError && <ErrorBanner message={actionError} />}
      {actionMessage && <p className="text-sm text-emerald-700">{actionMessage}</p>}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === value
                ? "border-brand-red bg-brand-red text-white"
                : "border-dash-border bg-white text-dash-sub hover:text-dash-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <DashCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-dash-border text-xs uppercase tracking-wider text-dash-sub">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">MRR value</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Next payment due</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3 font-medium">Detections</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => (
                <tr key={sub.id} className={`border-b border-dash-border last:border-0 ${rowClassName(sub)}`}>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setSelectedId(sub.id)}
                      className="flex items-center gap-2.5 text-left font-medium text-dash-ink hover:text-brand-red hover:underline"
                    >
                      <Avatar name={sub.name} email={sub.email} />
                      {sub.name || "—"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-dash-sub">{sub.email}</td>
                  <td className="px-5 py-3 text-dash-sub">{sub.phone || "—"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                        sub.plan === "annual"
                          ? "border-purple-200 bg-purple-50 text-purple-700"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {sub.plan || "monthly"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        sub.account_status === "suspended"
                          ? "border-red-200 bg-red-50 text-brand-red"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {sub.account_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-dash-sub">{formatINR(sub.mrr_value)}</td>
                  <td className="px-5 py-3 text-dash-sub">{formatDate(sub.created_at)}</td>
                  <td className="px-5 py-3 text-dash-sub">
                    {sub.next_payment_due ? formatDate(sub.next_payment_due) : "—"}
                  </td>
                  <td className="px-5 py-3 text-dash-sub">
                    {sub.last_scan_at ? formatDate(sub.last_scan_at) : "Never"}
                  </td>
                  <td className="px-5 py-3 text-dash-sub">{sub.total_detections}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <DashButton
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        loading={busyId === sub.id}
                        onClick={() => handleTriggerScan(sub)}
                      >
                        Scan
                      </DashButton>
                      <DashButton
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        loading={busyId === sub.id}
                        onClick={() => handleToggleStatus(sub)}
                      >
                        {sub.account_status === "active" ? "Suspend" : "Activate"}
                      </DashButton>
                      <DashButton
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => setSelectedId(sub.id)}
                      >
                        View
                      </DashButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashCard>
      )}

      {selectedId && <SubscriberDetailModal subscriberId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
