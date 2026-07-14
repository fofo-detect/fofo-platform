"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { clearAdminToken, getAdminToken } from "@/lib/admin-session";

interface AdminAuthContextValue {
  token: string;
  logout: () => void;
  handleAuthError: (err: unknown) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getAdminToken();
    if (!t) {
      router.replace("/admin/login");
      return;
    }
    setToken(t);
  }, [router]);

  function logout() {
    clearAdminToken();
    router.push("/admin/login");
  }

  // Returns true if `err` was an expired/invalid session (and redirects),
  // so callers can skip setting a generic error message in that case.
  function handleAuthError(err: unknown): boolean {
    if (err instanceof ApiError && err.status === 401) {
      logout();
      return true;
    }
    return false;
  }

  if (!token) return null;

  return (
    <AdminAuthContext.Provider value={{ token, logout, handleAuthError }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
