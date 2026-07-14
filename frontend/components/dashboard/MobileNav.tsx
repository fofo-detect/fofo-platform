"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAlerts, IconDetections, IconOverview, IconProfile, IconScans } from "./Icons";
import { useDashboard } from "@/lib/dashboard-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: IconOverview, exact: true },
  { href: "/dashboard/detections", label: "Detections", icon: IconDetections, exact: false },
  { href: "/dashboard/scans", label: "Scans", icon: IconScans, exact: false },
  { href: "/dashboard/profile", label: "Profile", icon: IconProfile, exact: false },
  { href: "/dashboard/alerts", label: "Alerts", icon: IconAlerts, exact: false },
];

export function MobileNav() {
  const pathname = usePathname();
  const { unreviewedCount } = useDashboard();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-dash-border bg-white/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
          >
            <Icon className={`h-5 w-5 ${active ? "text-brand-red" : "text-dash-sub"}`} />
            <span className={active ? "text-dash-ink" : "text-dash-sub"}>{label}</span>
            {label === "Detections" && unreviewedCount > 0 && (
              <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-brand-red" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
