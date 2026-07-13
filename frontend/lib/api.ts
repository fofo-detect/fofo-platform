const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

export interface AuthResponse {
  access_token: string | null;
  refresh_token: string | null;
  user_id: string;
  email: string;
  email_confirmation_required: boolean;
}

export interface EnrollResponse {
  subscriber_id: string;
  message: string;
  vector_dimensions: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Detection {
  id: string;
  subscriber_id: string;
  scan_id: string | null;
  image_url: string | null;
  source_url: string | null;
  platform: string | null;
  distance_score: number | null;
  deepfake_score: number | null;
  risk_level: RiskLevel | null;
  alert_message: string | null;
  alerted_at: string | null;
  created_at: string | null;
}

export interface DetectionsListResponse {
  subscriber_id: string;
  total: number;
  detections: Detection[];
}

export interface ScanResponse {
  scan_id: string;
  subscriber_id: string;
  status: string;
  candidates_found: number;
  matches_found: number;
  started_at: string;
  completed_at: string | null;
}

export async function signup(data: {
  email: string;
  password: string;
  name: string;
  phone: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<AuthResponse>(res);
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<AuthResponse>(res);
}

export async function enrollFace(subscriberId: string, files: File[]): Promise<EnrollResponse> {
  const formData = new FormData();
  formData.append("subscriber_id", subscriberId);
  files.forEach((file) => formData.append("files", file));

  const res = await fetch(`${API_URL}/enroll`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<EnrollResponse>(res);
}

export async function listDetections(subscriberId: string): Promise<DetectionsListResponse> {
  const res = await fetch(`${API_URL}/detections/${subscriberId}`, { cache: "no-store" });
  return handleResponse<DetectionsListResponse>(res);
}

export async function runScan(subscriberId: string): Promise<ScanResponse> {
  const res = await fetch(`${API_URL}/scan/${subscriberId}`, { method: "POST" });
  return handleResponse<ScanResponse>(res);
}

export async function createCheckoutSession(
  subscriberId: string,
  plan: "monthly" | "annual"
): Promise<{ checkout_url: string }> {
  const res = await fetch(`${API_URL}/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriber_id: subscriberId, plan }),
  });
  return handleResponse<{ checkout_url: string }>(res);
}
