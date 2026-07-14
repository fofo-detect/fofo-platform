"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Detection,
  ScanResponse,
  Subscriber,
  getErrorMessage,
  getSubscriber,
  listDetections,
  listScans,
} from "@/lib/api";
import { FofoSession, clearSession, getSession } from "@/lib/session";

const LAST_VIEWED_KEY = "fofo_detections_last_viewed";

interface DashboardContextValue {
  session: FofoSession;
  subscriber: Subscriber | null;
  detections: Detection[];
  scans: ScanResponse[];
  loading: boolean;
  error: string | null;
  unreviewedCount: number;
  refetchSubscriber: () => Promise<void>;
  refetchDetections: () => Promise<void>;
  refetchScans: () => Promise<void>;
  markDetectionsViewed: () => void;
  logout: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<FofoSession | null>(null);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [scans, setScans] = useState<ScanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastViewed, setLastViewed] = useState<string>("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    setLastViewed(window.localStorage.getItem(LAST_VIEWED_KEY) || "");
  }, [router]);

  const fetchSubscriber = useCallback(async (subscriberId: string) => {
    try {
      setSubscriber(await getSubscriber(subscriberId));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your profile."));
    }
  }, []);

  const fetchDetections = useCallback(async (subscriberId: string) => {
    try {
      const result = await listDetections(subscriberId);
      setDetections(result.detections);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load detections."));
    }
  }, []);

  const fetchScans = useCallback(async (subscriberId: string) => {
    try {
      const result = await listScans(subscriberId);
      setScans(result.scans);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load scan history."));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSubscriber(session.subscriberId),
      fetchDetections(session.subscriberId),
      fetchScans(session.subscriberId),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, fetchSubscriber, fetchDetections, fetchScans]);

  function markDetectionsViewed() {
    const now = new Date().toISOString();
    window.localStorage.setItem(LAST_VIEWED_KEY, now);
    setLastViewed(now);
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  const unreviewedCount = useMemo(() => {
    if (!lastViewed) return detections.length;
    const cutoff = new Date(lastViewed).getTime();
    return detections.filter((d) => d.created_at && new Date(d.created_at).getTime() > cutoff).length;
  }, [detections, lastViewed]);

  const value = useMemo<DashboardContextValue | null>(() => {
    if (!session) return null;
    return {
      session,
      subscriber,
      detections,
      scans,
      loading,
      error,
      unreviewedCount,
      refetchSubscriber: () => fetchSubscriber(session.subscriberId),
      refetchDetections: () => fetchDetections(session.subscriberId),
      refetchScans: () => fetchScans(session.subscriberId),
      markDetectionsViewed,
      logout,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, subscriber, detections, scans, loading, error, unreviewedCount]);

  if (!value) return null;

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
