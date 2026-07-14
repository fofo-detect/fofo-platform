"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAlerts, IconDetections, IconLogout, IconOverview, IconProfile, IconScans } from "./Icons";
import { useDashboard } from "@/lib/dashboard-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: IconOverview, exact: true },
  { href: "/dashboard/detections", label: "Detections", icon: IconDetections, exact: false },
  { href: "/dashboard/scans", label: "Scan History", icon: IconScans, exact: false },
  { href: "/dashboard/profile", label: "Profile", icon: IconProfile, exact: false },
  { href: "/dashboard/alerts", label: "Alerts", icon: IconAlerts, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const { subscriber, unreviewedCount, logout } = useDashboard();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-dash-border bg-white md:flex">
      <div className="flex h-20 items-center gap-2.5 border-b border-dash-border px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white">
          F
        </span>
        <span className="text-lg font-semibold tracking-tight text-dash-ink">FOFO</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-dash-hover text-dash-ink" : "text-dash-sub hover:bg-dash-hover hover:text-dash-ink"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-red" : "text-dash-sub"}`} />
                {label}
              </span>
              {label === "Detections" && unreviewedCount > 0 && (
                <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs font-semibold text-white">
                  {unreviewedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-dash-border p-3">
        {subscriber?.name && (
          <p className="truncate px-3 pb-2 text-xs text-dash-sub">Signed in as {subscriber.name}</p>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dash-sub transition-colors hover:bg-dash-hover hover:text-dash-ink"
        >
          <IconLogout className="h-[18px] w-[18px]" />
          Log out
        </button>
      </div>
    </aside>
  );
}
