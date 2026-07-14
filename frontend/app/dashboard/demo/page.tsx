"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IconAlerts,
  IconDetections,
  IconLogout,
  IconOverview,
  IconProfile,
  IconScans,
} from "@/components/dashboard/Icons";
import { DetectionsTable } from "@/components/dashboard/DetectionsTable";
import { ScanHistoryList } from "@/components/dashboard/ScanHistoryList";
import { DashButton, DashCard, StatCard } from "@/components/dashboard/ui";
import { DemoData, generateDemoData } from "@/lib/demo-data";

const NAV_ITEMS = [
  { label: "Overview", icon: IconOverview },
  { label: "Detections", icon: IconDetections },
  { label: "Scan History", icon: IconScans },
  { label: "Profile", icon: IconProfile },
  { label: "Alerts", icon: IconAlerts },
];

export default function DemoDashboardPage() {
  const [data, setData] = useState<DemoData | null>(null);

  // Generated client-side only (never at module scope / during SSR) so
  // Math.random()/new Date() here can never cause a hydration mismatch.
  useEffect(() => {
    setData(generateDemoData());
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dash-bg">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-dash-border border-t-brand-red" />
      </div>
    );
  }

  const highRiskCount = data.highRiskAlerts;

  return (
    <div className="min-h-screen bg-dash-bg text-dash-ink">
      <DemoBanner />

      <div className="flex">
        <DemoSidebar subscriberName={data.subscriberName} />

        <div className="flex min-h-screen flex-1 flex-col">
          <main className="flex-1 px-5 py-8 pb-24 md:px-10 md:py-10 md:pb-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
              <div>
                <h1 className="text-2xl font-semibold text-dash-ink">
                  Welcome back, {data.subscriberName.split(" ")[0]}
                </h1>
                <p className="mt-1 text-sm text-dash-sub">Here is the state of your face protection.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Total Detections" value={data.totalDetections} />
                <StatCard label="High Risk Alerts" value={highRiskCount} accent={highRiskCount > 0} />
                <StatCard label="Last Scan" value="Today" caption="Completed successfully" />
                <StatCard label="Next Scheduled Scan" value="Tomorrow" caption="9:00 AM" />
              </div>

              <DashCard className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-dash-ink">Run a scan</h2>
                    <p className="mt-1 text-sm text-dash-sub">
                      Search the internet for unauthorized use of your face.
                    </p>
                  </div>
                  <Link href="/register">
                    <DashButton type="button">Sign up to run real scans</DashButton>
                  </Link>
                </div>
              </DashCard>

              <div>
                <h2 className="mb-4 text-base font-semibold text-dash-ink">Detections</h2>
                <DetectionsTable detections={data.detections} />
              </div>

              <div>
                <h2 className="mb-4 text-base font-semibold text-dash-ink">Scan History</h2>
                <ScanHistoryList scans={data.scans} />
              </div>
            </div>
          </main>
        </div>
      </div>

      <DemoMobileNav />
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm">
      <span className="font-semibold text-amber-900">This is a demo account</span>
      <span className="text-amber-700">— sample data showing what FOFO looks like when actively protecting someone.</span>
      <Link href="/register" className="font-semibold text-brand-red underline underline-offset-2">
        Protect your face
      </Link>
    </div>
  );
}

function DemoSidebar({ subscriberName }: { subscriberName: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-dash-border bg-white md:flex">
      <div className="flex h-20 items-center gap-2.5 border-b border-dash-border px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white">
          F
        </span>
        <span className="text-lg font-semibold tracking-tight text-dash-ink">FOFO</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {NAV_ITEMS.map(({ label, icon: Icon }, i) => (
          <Link
            key={label}
            href="/dashboard/demo"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              i === 0 ? "bg-dash-hover text-dash-ink" : "text-dash-sub hover:bg-dash-hover hover:text-dash-ink"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${i === 0 ? "text-brand-red" : "text-dash-sub"}`} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-dash-border p-3">
        <p className="truncate px-3 pb-2 text-xs text-dash-sub">Signed in as {subscriberName}</p>
        <Link
          href="/"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dash-sub transition-colors hover:bg-dash-hover hover:text-dash-ink"
        >
          <IconLogout className="h-[18px] w-[18px]" />
          Exit demo
        </Link>
      </div>
    </aside>
  );
}

function DemoMobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-dash-border bg-white/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map(({ label, icon: Icon }, i) => (
        <Link
          key={label}
          href="/dashboard/demo"
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
        >
          <Icon className={`h-5 w-5 ${i === 0 ? "text-brand-red" : "text-dash-sub"}`} />
          <span className={i === 0 ? "text-dash-ink" : "text-dash-sub"}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
