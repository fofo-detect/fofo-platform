"use client";

import { useEffect, useMemo, useState } from "react";
import { DashButton, DashCard, EmptyState, PlatformLabel, RiskBadge } from "@/components/dashboard/ui";
import { Detection, RiskLevel, reportDetection } from "@/lib/api";
import { formatDate, formatScore, sourceHost } from "@/lib/format";

// Stable, top-level help/report domains rather than specific deep-link
// article IDs - those change often and an unverifiable guess is worse than
// a slightly less convenient but definitely-correct starting point.
const PLATFORM_REPORT_URLS: Record<string, string> = {
  "instagram.com": "https://help.instagram.com",
  "facebook.com": "https://www.facebook.com/help",
  "twitter.com": "https://help.twitter.com",
  "x.com": "https://help.twitter.com",
  "tiktok.com": "https://www.tiktok.com/legal/report/feedback",
};

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
  } catch {
    return null;
  }
  return null;
}

function getReportUrl(detection: Detection): string {
  if (detection.platform === "YouTube" && detection.source_url) {
    const videoId = extractYouTubeVideoId(detection.source_url);
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}&action=flag`;
  }
  const platformKey = (detection.platform || "").toLowerCase();
  return PLATFORM_REPORT_URLS[platformKey] || detection.source_url || "#";
}

const RISK_FILTERS: Array<{ label: string; value: RiskLevel | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Critical", value: "CRITICAL" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Highest Risk", value: "risk" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const PAGE_SIZE = 20;

export function DetectionsTable({
  detections,
  loading = false,
}: {
  detections: Detection[];
  loading?: boolean;
}) {
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [sort, setSort] = useState<SortValue>("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [riskFilter, sort]);

  const filtered = useMemo(() => {
    const rows = riskFilter === "ALL" ? detections : detections.filter((d) => d.risk_level === riskFilter);
    return [...rows].sort((a, b) => {
      if (sort === "risk") {
        return (RISK_ORDER[b.risk_level ?? ""] ?? 0) - (RISK_ORDER[a.risk_level ?? ""] ?? 0);
      }
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [detections, riskFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {RISK_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRiskFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                riskFilter === value
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-dash-border bg-white text-dash-sub hover:text-dash-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          className="rounded-lg border border-dash-border bg-white px-3 py-1.5 text-sm text-dash-ink outline-none focus:border-brand-red"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <DashCard className="flex items-center justify-center py-16 text-sm text-dash-sub">
          Loading detections…
        </DashCard>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No detections yet"
          description="Run your first scan to search the internet for unauthorized use of your face."
        />
      ) : (
        <>
          <DashCard className="divide-y divide-dash-border p-0">
            {pageRows.map((d) => (
              <DetectionRow key={d.id} detection={d} />
            ))}
          </DashCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-dash-sub">
              <span>
                Page {page} of {totalPages} · {filtered.length} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-dash-border bg-white px-3 py-1.5 font-medium text-dash-ink disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-dash-border bg-white px-3 py-1.5 font-medium text-dash-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DetectionRow({ detection }: { detection: Detection }) {
  const [reported, setReported] = useState(detection.reported);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);

  async function handleConfirmReport() {
    setReporting(true);
    try {
      window.open(getReportUrl(detection), "_blank", "noopener,noreferrer");
      await reportDetection(detection.id);
      setReported(true);
    } catch {
      // Best-effort: the report tab still opened for the user even if our
      // own reported-flag write failed - not worth blocking on.
    } finally {
      setReporting(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      {detection.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detection.image_url}
          alt="Detected match"
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-lg bg-dash-hover" />
      )}

      <div className="min-w-0 flex-1">
        {detection.source_url ? (
          <a
            href={detection.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium text-dash-ink underline decoration-dash-border decoration-1 underline-offset-2 hover:text-brand-red"
          >
            {sourceHost(detection.source_url)}
          </a>
        ) : (
          <span className="text-sm font-medium text-dash-sub">No source URL</span>
        )}
        <p className="mt-0.5 text-xs text-dash-sub">
          <PlatformLabel platform={detection.platform} />
        </p>
        {detection.alert_message && (
          <p className="mt-1 max-w-xl truncate text-xs italic text-dash-sub" title={detection.alert_message}>
            "{detection.alert_message}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-6 sm:gap-8">
        <div className="text-right">
          <p className="text-xs text-dash-sub">Deepfake score</p>
          <p className="text-sm font-medium text-dash-ink">{formatScore(detection.deepfake_score)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-dash-sub">Found</p>
          <p className="text-sm font-medium text-dash-ink">{formatDate(detection.created_at)}</p>
        </div>
        <RiskBadge level={detection.risk_level} />
        <DashButton
          variant="secondary"
          className="px-2.5 py-1.5 text-xs"
          disabled={reported}
          onClick={() => setShowConfirm(true)}
        >
          {reported ? "Reported ✓" : "Report"}
        </DashButton>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !reporting && setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-dash-ink">
              Report this content to {detection.platform || "the platform"}?
            </h3>
            <p className="mt-2 text-sm text-dash-sub">
              FOFO will submit an abuse report on your behalf. A report page for{" "}
              {detection.platform || "this platform"} will open in a new tab.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <DashButton variant="secondary" onClick={() => setShowConfirm(false)} disabled={reporting}>
                Cancel
              </DashButton>
              <DashButton onClick={handleConfirmReport} loading={reporting}>
                Confirm
              </DashButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
