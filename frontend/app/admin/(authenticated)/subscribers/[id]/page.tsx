"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DetectionsTable } from "@/components/dashboard/DetectionsTable";
import { ScanHistoryList } from "@/components/dashboard/ScanHistoryList";
import { DashButton, DashCard, ErrorBanner } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { AdminSubscriberDetail, adminTriggerScan, getAdminSubscriber, updateSubscriberAccountStatus } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-context";
import { formatDateTime } from "@/lib/format";

export default function AdminSubscriberDetailPage({ params }: { params: { id: string } }) {
  const { token, handleAuthError } = useAdminAuth();
  const [data, setData] = useState<AdminSubscriberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    getAdminSubscriber(token, params.id)
      .then(setData)
      .catch((err) => {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Could not load subscriber."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.id]);

  async function handleToggleStatus() {
    if (!data) return;
    setActionError(null);
    setBusy(true);
    const next = data.subscriber.account_status === "active" ? "suspended" : "active";
    try {
      await updateSubscriberAccountStatus(token, params.id, next);
      load();
    } catch (err) {
      if (!handleAuthError(err)) setActionError(getErrorMessage(err, "Could not update account status."));
    } finally {
      setBusy(false);
    }
  }

  async function handleTriggerScan() {
    setActionError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await adminTriggerScan(token, params.id);
      setActionMessage("Scan started.");
    } catch (err) {
      if (!handleAuthError(err)) setActionError(getErrorMessage(err, "Could not start scan."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/subscribers" className="text-sm font-medium text-dash-sub hover:text-dash-ink">
        ← Back to subscribers
      </Link>

      {error && <ErrorBanner message={error} />}

      {loading || !data ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">Loading…</DashCard>
      ) : (
        <>
          <DashCard className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-dash-ink">
                  {data.subscriber.name || "Unnamed subscriber"}
                </h1>
                <p className="mt-1 text-sm text-dash-sub">{data.subscriber.email}</p>
                <p className="text-sm text-dash-sub">{data.subscriber.phone || "No phone on file"}</p>
              </div>
              <div className="flex gap-2">
                <DashButton variant="secondary" loading={busy} onClick={handleTriggerScan}>
                  Trigger scan
                </DashButton>
                <DashButton
                  variant={data.subscriber.account_status === "active" ? "secondary" : "primary"}
                  loading={busy}
                  onClick={handleToggleStatus}
                >
                  {data.subscriber.account_status === "active" ? "Suspend account" : "Activate account"}
                </DashButton>
              </div>
            </div>

            {actionMessage && <p className="mt-4 text-sm text-emerald-700">{actionMessage}</p>}
            {actionError && (
              <div className="mt-4">
                <ErrorBanner message={actionError} />
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-dash-sub">Plan</p>
                <p className="text-sm font-medium text-dash-ink">{data.subscriber.plan || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-dash-sub">Status</p>
                <p className="text-sm font-medium capitalize text-dash-ink">{data.subscriber.account_status}</p>
              </div>
              <div>
                <p className="text-xs text-dash-sub">Joined</p>
                <p className="text-sm font-medium text-dash-ink">{formatDateTime(data.subscriber.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-dash-sub">Total detections</p>
                <p className="text-sm font-medium text-dash-ink">{data.subscriber.total_detections}</p>
              </div>
            </div>
          </DashCard>

          <div>
            <h2 className="mb-4 text-base font-semibold text-dash-ink">Scan history</h2>
            <ScanHistoryList scans={data.scans} />
          </div>

          <div>
            <h2 className="mb-4 text-base font-semibold text-dash-ink">Detections</h2>
            <DetectionsTable detections={data.detections} />
          </div>
        </>
      )}
    </div>
  );
}
