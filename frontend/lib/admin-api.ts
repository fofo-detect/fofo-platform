import { ApiError, Detection, RiskLevel, ScanResponse, ScanStatus } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON, keep statusText
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function adminLogin(password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return handleResponse<{ token: string }>(res);
}

export interface AdminActivityItem {
  scan_id: string;
  subscriber_name: string | null;
  subscriber_email: string | null;
  status: ScanStatus;
  candidates_found: number;
  matches_found: number;
  started_at: string;
  completed_at: string | null;
}

export interface AdminOverview {
  active_subscribers: number;
  scans_today: number;
  scans_this_week: number;
  scans_this_month: number;
  detections_today: number;
  detections_this_week: number;
  detections_this_month: number;
  critical_high_last_24h: number;
  system_status: { api_healthy: boolean; supabase_healthy: boolean };
  recent_activity: AdminActivityItem[];
  mrr: number;
  monthly_subscriber_count: number;
  annual_subscriber_count: number;
  scans_today_completed: number;
  scans_today_failed: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_change_percent: number | null;
  cost_this_month_usd: number;
  gross_profit_this_month_inr: number;
  churn_this_month: number;
}

export async function getAdminOverview(token: string): Promise<AdminOverview> {
  const res = await fetch(`${API_URL}/admin/overview`, { headers: authHeaders(token), cache: "no-store" });
  return handleResponse<AdminOverview>(res);
}

export type AccountStatus = "active" | "suspended";

export interface AdminSubscriber {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  plan: string | null;
  subscription_status: string | null;
  account_status: AccountStatus;
  created_at: string | null;
  last_scan_at: string | null;
  total_detections: number;
  mrr_value: number;
  next_payment_due: string | null;
  suspended_at: string | null;
}

export interface AdminSubscribersList {
  total: number;
  subscribers: AdminSubscriber[];
}

export async function listAdminSubscribers(token: string): Promise<AdminSubscribersList> {
  const res = await fetch(`${API_URL}/admin/subscribers`, { headers: authHeaders(token), cache: "no-store" });
  return handleResponse<AdminSubscribersList>(res);
}

export interface AdminSubscriberDetail {
  subscriber: AdminSubscriber;
  scans: ScanResponse[];
  detections: Detection[];
}

export async function getAdminSubscriber(token: string, id: string): Promise<AdminSubscriberDetail> {
  const res = await fetch(`${API_URL}/admin/subscribers/${id}`, { headers: authHeaders(token), cache: "no-store" });
  return handleResponse<AdminSubscriberDetail>(res);
}

export async function updateSubscriberAccountStatus(
  token: string,
  id: string,
  status: AccountStatus
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/admin/subscribers/${id}/status`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleResponse<{ message: string }>(res);
}

export async function adminTriggerScan(token: string, id: string): Promise<ScanResponse> {
  const res = await fetch(`${API_URL}/admin/subscribers/${id}/scan`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse<ScanResponse>(res);
}

export interface AdminDetection extends Detection {
  subscriber_name: string | null;
  subscriber_email: string | null;
}

export interface AdminDetectionsList {
  total: number;
  detections: AdminDetection[];
}

export async function listAdminDetections(
  token: string,
  filters: { risk_level?: RiskLevel; platform?: string; subscriber_id?: string; date_from?: string; date_to?: string } = {}
): Promise<AdminDetectionsList> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  const res = await fetch(`${API_URL}/admin/detections${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return handleResponse<AdminDetectionsList>(res);
}

export interface AdminScan extends ScanResponse {
  subscriber_name: string | null;
  subscriber_email: string | null;
  error_message: string | null;
}

export interface AdminScansList {
  total: number;
  scans: AdminScan[];
}

export async function listAdminScans(
  token: string,
  filters: { status?: ScanStatus; subscriber_id?: string; date_from?: string; date_to?: string } = {}
): Promise<AdminScansList> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  const res = await fetch(`${API_URL}/admin/scans${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return handleResponse<AdminScansList>(res);
}

export interface ProviderUsage {
  calls_today: number;
  calls_this_month: number;
  [key: string]: unknown;
}

export interface ApiUsage {
  serpapi: ProviderUsage & {
    plan_searches_left: number | null;
    this_month_usage?: number;
    total_searches_left?: number;
    days_until_exhausted: number | null;
  };
  youtube: ProviderUsage;
  rekognition: ProviderUsage & { estimated_cost_usd_this_month: number };
  sightengine: ProviderUsage & { estimated_cost_usd_this_month: number };
  anthropic: ProviderUsage & { estimated_cost_usd_this_month: number; cost_note: string };
  total_estimated_cost_usd_this_month: number;
  cost_per_subscriber_this_month_usd: number | null;
  cost_scope_note: string;
}

export async function getAdminApiUsage(token: string): Promise<ApiUsage> {
  const res = await fetch(`${API_URL}/admin/api-usage`, { headers: authHeaders(token), cache: "no-store" });
  return handleResponse<ApiUsage>(res);
}

export interface AdminSubscriberPaymentRow {
  id: string;
  name: string | null;
  email: string;
  plan: string | null;
  mrr_value: number;
  created_at: string | null;
  next_payment_due: string | null;
}

export interface AdminRevenue {
  mrr: number;
  arr: number;
  monthly_plan_revenue: number;
  annual_plan_revenue: number;
  cost_breakdown_usd: Record<string, number>;
  total_cost_this_month_usd: number;
  total_cost_this_month_inr: number;
  gross_margin_inr: number;
  break_even_subscribers: number | null;
  fx_note: string;
  subscribers: AdminSubscriberPaymentRow[];
}

export async function getAdminRevenue(token: string): Promise<AdminRevenue> {
  const res = await fetch(`${API_URL}/admin/revenue`, { headers: authHeaders(token), cache: "no-store" });
  return handleResponse<AdminRevenue>(res);
}
