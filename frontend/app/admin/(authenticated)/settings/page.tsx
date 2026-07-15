"use client";

import { DashCard } from "@/components/dashboard/ui";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Settings</h1>
        <p className="mt-1 text-sm text-dash-sub">Admin access and platform configuration notes.</p>
      </div>

      <DashCard className="p-6">
        <h2 className="text-sm font-semibold text-dash-ink">Admin password</h2>
        <p className="mt-2 text-sm text-dash-sub">
          This dashboard is protected by a single shared password stored in the <code>ADMIN_PASSWORD</code>{" "}
          environment variable. To rotate it, update the value on Railway and in the backend&apos;s local{" "}
          <code>.env</code>, then redeploy - every existing admin session stays valid until it expires (12
          hours) or the password is changed, whichever comes first.
        </p>
      </DashCard>

      <DashCard className="p-6">
        <h2 className="text-sm font-semibold text-dash-ink">Data notes</h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm text-dash-sub">
          <li>Revenue, MRR, and payment dates are computed from each subscriber&apos;s assigned plan and join date - Stripe billing isn&apos;t live yet, so nothing here is a verified payment.</li>
          <li>API cost figures are rough estimates based on public per-call pricing, not real invoices.</li>
          <li>Suspending an account blocks that subscriber from logging in and from running scans (including admin-triggered scans) immediately.</li>
        </ul>
      </DashCard>

      <DashCard className="p-6">
        <h2 className="text-sm font-semibold text-dash-ink">External dashboards</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-dash-sub">
          <li>Railway: deployment logs and environment variables</li>
          <li>Supabase: database, migrations, and row-level security policies</li>
          <li>SerpAPI account page: authoritative search quota and billing</li>
        </ul>
      </DashCard>
    </div>
  );
}
