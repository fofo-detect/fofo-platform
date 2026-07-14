"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDetections,
  IconLogout,
  IconOverview,
  IconProfile,
  IconScans,
  IconUsage,
} from "@/components/dashboard/Icons";
import { useAdminAuth } from "@/lib/admin-context";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: IconOverview, exact: true },
  { href: "/admin/subscribers", label: "Subscribers", icon: IconProfile, exact: false },
  { href: "/admin/detections", label: "Detections", icon: IconDetections, exact: false },
  { href: "/admin/scans", label: "Scan Monitor", icon: IconScans, exact: false },
  { href: "/admin/api-usage", label: "API Usage", icon: IconUsage, exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-dash-border bg-white md:flex">
      <div className="flex h-20 items-center gap-2.5 border-b border-dash-border px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white">
          F
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-semibold tracking-tight text-dash-ink">FOFO</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-dash-sub">Admin</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-dash-hover text-dash-ink" : "text-dash-sub hover:bg-dash-hover hover:text-dash-ink"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-red" : "text-dash-sub"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-dash-border p-3">
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
