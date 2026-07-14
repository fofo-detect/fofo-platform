"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconChevronRight } from "@/components/dashboard/Icons";
import {
  DashButton,
  DashCard,
  EmptyState,
  ErrorBanner,
  PlatformLabel,
  RiskBadge,
  StatCard,
} from "@/components/dashboard/ui";
import { ScanResponse, getErrorMessage, getScanStatus, runScan } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard-context";

const POLL_INTERVAL_MS = 3000;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function OverviewPage() {
  const { session, subscriber, detections, scans, loading, error, refetchDetections, refetchScans } =
    useDashboard();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function handleRunScan() {
    if (scanning) return;
    setScanError(null);
    setScanning(true);
    try {
      const scan = await runScan(session.subscriberId);
      setScanProgress(scan);
      pollTimer.current = setInterval(async () => {
        try {
          const status = await getScanStatus(scan.scan_id);
          setScanProgress(status);
          if (status.status === "completed") {
            stopPolling();
            setScanning(false);
            await Promise.all([refetchDetections(), refetchScans()]);
          } else if (status.status === "failed") {
            stopPolling();
            setScanning(false);
            setScanError("Scan failed. Please try again.");
          }
        } catch (err) {
          stopPolling();
          setScanning(false);
          setScanError(getErrorMessage(err, "Lost track of the scan. Please try again."));
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setScanError(getErrorMessage(err, "Could not start scan. Please try again."));
      setScanning(false);
    }
  }

  const highRisk = detections.filter((d) => d.risk_level === "HIGH" || d.risk_level === "CRITICAL").length;
  const lastScan = scans[0] ?? null;
  const recentDetections = detections.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">
          Welcome back{subscriber?.name ? `, ${subscriber.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-dash-sub">Here is the state of your face protection.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {scanError && <ErrorBanner message={scanError} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Detections" value={loading ? "—" : detections.length} />
        <StatCard label="High Risk Alerts" value={loading ? "—" : highRisk} accent={highRisk > 0} />
        <StatCard
          label="Last Scan"
          value={loading ? "—" : lastScan ? timeAgo(lastScan.completed_at ?? lastScan.started_at) : "Never"}
          caption={lastScan ? formatDateTime(lastScan.completed_at ?? lastScan.started_at) : undefined}
        />
        <StatCard label="Next Scheduled Scan" value="Manual" caption="Run scans anytime — no auto-schedule yet" />
      </div>

      <DashCard className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-dash-ink">Run a scan</h2>
            <p className="mt-1 text-sm text-dash-sub">Search the internet for unauthorized use of your face.</p>
          </div>
          <DashButton onClick={handleRunScan} loading={scanning} disabled={scanning}>
            {scanning ? "Scanning…" : "Run Scan Now"}
          </DashButton>
        </div>

        {scanning && (
          <div className="mt-5 rounded-lg border border-dash-border bg-dash-hover px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-dash-ink">
                Scanning… {scanProgress?.candidates_found ?? 0} candidates checked
              </span>
              <span className="text-dash-sub">{scanProgress?.matches_found ?? 0} matches so far</span>
            </div>
            <p className="mt-1 text-xs text-dash-sub">
              This can take a few minutes. Feel free to browse other pages — the scan keeps running.
            </p>
          </div>
        )}
      </DashCard>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dash-ink">Recent detections</h2>
          <Link
            href="/dashboard/detections"
            className="flex items-center gap-1 text-sm font-medium text-dash-sub hover:text-dash-ink"
          >
            View all <IconChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">
            Loading detections…
          </DashCard>
        ) : recentDetections.length === 0 ? (
          <EmptyState
            title="No detections yet"
            description="Run your first scan to search the internet for unauthorized use of your face."
          />
        ) : (
          <DashCard className="divide-y divide-dash-border p-0">
            {recentDetections.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                {d.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image_url} alt="Detected match" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-dash-hover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-dash-ink">
                    <PlatformLabel platform={d.platform} />
                  </p>
                  <p className="truncate text-xs text-dash-sub">{formatDateTime(d.created_at)}</p>
                </div>
                <RiskBadge level={d.risk_level} />
              </div>
            ))}
          </DashCard>
        )}
      </div>
    </div>
  );
}
