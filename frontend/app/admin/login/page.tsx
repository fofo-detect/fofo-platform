"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { DashButton, DashCard, DashInput } from "@/components/dashboard/ui";
import { getErrorMessage } from "@/lib/api";
import { adminLogin } from "@/lib/admin-api";
import { saveAdminToken } from "@/lib/admin-session";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter the admin password");
      return;
    }
    setLoading(true);
    try {
      const { token } = await adminLogin(password);
      saveAdminToken(token);
      router.push("/admin");
    } catch (err) {
      setError(getErrorMessage(err, "Could not log in. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dash-bg px-6 py-16">
      <DashCard className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white">
            F
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight text-dash-ink">FOFO</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-dash-sub">Admin</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-dash-ink">Internal access</h1>
        <p className="mt-1 text-sm text-dash-sub">Enter the admin password to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <DashInput
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />

          {error && <p className="text-sm text-brand-red">{error}</p>}

          <DashButton type="submit" loading={loading} className="mt-2 w-full">
            Log in
          </DashButton>
        </form>
      </DashCard>
    </main>
  );
}
