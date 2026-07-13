"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/Badge";
import { ApiError, Detection, listDetections, runScan } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";

export default function DashboardPage() {
  const router = useRouter();
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  const fetchDetections = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDetections(id);
      setDetections(result.detections);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load detections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setSubscriberId(session.subscriberId);
    fetchDetections(session.subscriberId);
  }, [router, fetchDetections]);

  async function handleRunScan() {
    if (!subscriberId) return;
    setScanning(true);
    setError(null);
    try {
      const scan = await runScan(subscriberId);
      setLastScanTime(scan.completed_at ?? new Date().toISOString());
      await fetchDetections(subscriberId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Your protection dashboard</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {detections.length} detection{detections.length === 1 ? "" : "s"} found
            {lastScanTime ? ` · last scan ${new Date(lastScanTime).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRunScan} loading={scanning}>
            {scanning ? "Scanning the web…" : "Run Scan Now"}
          </Button>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-16 text-neutral-500">
          Loading detections…
        </Card>
      ) : detections.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-lg font-medium text-white">No detections yet</p>
          <p className="max-w-sm text-sm text-neutral-500">
            Run your first scan to search the internet for unauthorized use of your face.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-brand-border text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-4 font-medium">Image</th>
                <th className="px-5 py-4 font-medium">Source</th>
                <th className="px-5 py-4 font-medium">Platform</th>
                <th className="px-5 py-4 font-medium">Risk</th>
                <th className="px-5 py-4 font-medium">Deepfake score</th>
                <th className="px-5 py-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {detections.map((detection) => (
                <tr key={detection.id} className="border-b border-brand-border last:border-0">
                  <td className="px-5 py-4">
                    {detection.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detection.image_url}
                        alt="Detected match"
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-neutral-800" />
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-5 py-4">
                    {detection.source_url ? (
                      <a
                        href={detection.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-300 hover:text-white hover:underline"
                      >
                        {detection.source_url}
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-neutral-400">{detection.platform ?? "—"}</td>
                  <td className="px-5 py-4">
                    <RiskBadge level={detection.risk_level} />
                  </td>
                  <td className="px-5 py-4 text-neutral-400">
                    {detection.deepfake_score !== null
                      ? `${Math.round(detection.deepfake_score * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-neutral-500">
                    {detection.created_at ? new Date(detection.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
