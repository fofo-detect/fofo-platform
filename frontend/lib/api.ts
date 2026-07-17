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

const DETAIL_MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /already registered|already exists|user already/i, message: "This email is already registered. Please log in instead." },
  { pattern: /password.*(least|character|short)/i, message: "Password must be at least 8 characters" },
  { pattern: /invalid login credentials|invalid email or password/i, message: "Incorrect email or password" },
  { pattern: /unable to validate email|invalid.*email|email.*invalid/i, message: "Please enter a valid email address" },
  { pattern: /rate limit|too many/i, message: "Too many attempts. Please wait a moment and try again." },
];

// Fetch rejects with a plain TypeError (not an ApiError, since no response was ever
// received) for both CORS blocks and genuine offline/network failures — there's no
// way to tell those apart from the browser API, so both map to a connection message.
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (isNetworkError(err)) {
    return "Connection error. Please check your internet and try again.";
  }
  if (err instanceof ApiError) {
    const rule = DETAIL_MESSAGE_RULES.find(({ pattern }) => pattern.test(err.message));
    if (rule) return rule.message;
    return err.message || fallback;
  }
  return fallback;
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
  faces_indexed: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Detection {
  id: string;
  subscriber_id: string;
  scan_id: string | null;
  image_url: string | null;
  source_url: string | null;
  platform: string | null;
  source: string | null;
  distance_score: number | null;
  deepfake_score: number | null;
  risk_level: RiskLevel | null;
  alert_message: string | null;
  alerted_at: string | null;
  created_at: string | null;
  reported: boolean;
  reported_at: string | null;
}

export interface DetectionsListResponse {
  subscriber_id: string;
  total: number;
  detections: Detection[];
}

export type ScanStatus = "pending" | "running" | "completed" | "failed";

export interface ScanResponse {
  scan_id: string;
  subscriber_id: string;
  status: ScanStatus;
  candidates_found: number;
  matches_found: number;
  // Candidates the OpenCV pre-filter rejected before they reached Rekognition.
  opencv_filtered?: number;
  started_at: string;
  completed_at: string | null;
}

export interface ScansListResponse {
  subscriber_id: string;
  total: number;
  scans: ScanResponse[];
}

export type AlertPreferences = Record<RiskLevel, boolean>;

export interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  reference_image_urls: string[];
  alert_preferences: AlertPreferences;
  subscription_status: string | null;
  plan: string | null;
  created_at: string | null;
}

export async function signup(data: {
  email: string;
  password: string;
  name: string;
  phone: string;
  profession?: string;
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

export async function getScanStatus(scanId: string): Promise<ScanResponse> {
  const res = await fetch(`${API_URL}/scan/${scanId}/status`, { cache: "no-store" });
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

export async function listScans(subscriberId: string): Promise<ScansListResponse> {
  const res = await fetch(`${API_URL}/scans/${subscriberId}`, { cache: "no-store" });
  return handleResponse<ScansListResponse>(res);
}

export async function getSubscriber(subscriberId: string): Promise<Subscriber> {
  const res = await fetch(`${API_URL}/subscribers/${subscriberId}`, { cache: "no-store" });
  return handleResponse<Subscriber>(res);
}

export async function updateSubscriber(
  subscriberId: string,
  data: { name?: string; phone?: string }
): Promise<Subscriber> {
  const res = await fetch(`${API_URL}/subscribers/${subscriberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Subscriber>(res);
}

export async function updateAlertPreferences(
  subscriberId: string,
  prefs: Partial<AlertPreferences>
): Promise<Subscriber> {
  const res = await fetch(`${API_URL}/subscribers/${subscriberId}/alert-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  return handleResponse<Subscriber>(res);
}

export async function changePassword(accessToken: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, new_password: newPassword }),
  });
  return handleResponse<{ message: string }>(res);
}

export async function sendTestAlert(subscriberId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/alerts/test/${subscriberId}`, { method: "POST" });
  return handleResponse<{ message: string }>(res);
}

export async function reportDetection(detectionId: string): Promise<Detection> {
  const res = await fetch(`${API_URL}/detections/${detectionId}/report`, { method: "PATCH" });
  return handleResponse<Detection>(res);
}
