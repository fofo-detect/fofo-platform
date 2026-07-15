"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDetections,
  IconLogout,
  IconOverview,
  IconProfile,
  IconScans,
  IconSettings,
  IconTrendingUp,
  IconUsage,
} from "@/components/dashboard/Icons";
import { useAdminAuth } from "@/lib/admin-context";

const NAV_GROUPS = [
  {
    label: "Business",
    items: [
      { href: "/admin", label: "Overview", icon: IconOverview, exact: true },
      { href: "/admin/revenue", label: "Revenue", icon: IconTrendingUp, exact: false },
      { href: "/admin/subscribers", label: "Subscribers", icon: IconProfile, exact: false },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/scans", label: "Scans", icon: IconScans, exact: false },
      { href: "/admin/detections", label: "Detections", icon: IconDetections, exact: false },
      { href: "/admin/api-usage", label: "API Usage", icon: IconUsage, exact: false },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", label: "Settings", icon: IconSettings, exact: false }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-dash-ink text-white md:flex">
      <div className="flex h-20 items-center gap-2.5 border-b border-white/10 px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white">
          F
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">FOFO</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : "text-white/50"}`} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-white/10 p-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
          Admin
        </span>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <IconLogout className="h-[18px] w-[18px]" />
          Log out
        </button>
      </div>
    </aside>
  );
}
