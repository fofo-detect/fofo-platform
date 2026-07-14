"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashButton, DashCard, ErrorBanner } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { AdminSubscriber, adminTriggerScan, listAdminSubscribers, updateSubscriberAccountStatus } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDateTime } from "@/lib/format";

export default function AdminSubscribersPage() {
  const { token, handleAuthError } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <DashCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-dash-border text-xs uppercase tracking-wider text-dash-sub">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3 font-medium">Detections</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.id} className="border-b border-dash-border last:border-0 hover:bg-dash-hover/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/subscribers/${sub.id}`}
                      className="font-medium text-dash-ink hover:text-brand-red hover:underline"
                    >
                      {sub.name || "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-dash-sub">{sub.email}</td>
                  <td className="px-5 py-3 text-dash-sub">{sub.phone || "—"}</td>
                  <td className="px-5 py-3 text-dash-sub">{sub.plan || "—"}</td>
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
                  <td className="px-5 py-3 text-dash-sub">{formatDateTime(sub.created_at)}</td>
                  <td className="px-5 py-3 text-dash-sub">
                    {sub.last_scan_at ? formatDateTime(sub.last_scan_at) : "Never"}
                  </td>
                  <td className="px-5 py-3 text-dash-sub">{sub.total_detections}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashCard>
      )}
    </div>
  );
}
