from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ScanStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SubscriptionStatus(str, Enum):
    INCOMPLETE = "incomplete"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"


class Plan(str, Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


# ---------- Auth ----------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=6, max_length=20)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user_id: str
    email: EmailStr
    email_confirmation_required: bool = False


# ---------- Enroll ----------

class EnrollResponse(BaseModel):
    subscriber_id: str
    message: str
    faces_indexed: int


# ---------- Subscriber ----------

# Mirrors scan.py's ALERTABLE_RISK_LEVELS ({HIGH, CRITICAL}) so a subscriber
# who predates the alert_preferences column (migration 004) gets the exact
# same alerting behavior they already had, not a silent change.
DEFAULT_ALERT_PREFERENCES = {"LOW": False, "MEDIUM": False, "HIGH": True, "CRITICAL": True}


class AlertPreferences(BaseModel):
    LOW: bool = False
    MEDIUM: bool = False
    HIGH: bool = True
    CRITICAL: bool = True


class SubscriberOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    reference_image_urls: list[str] = []
    alert_preferences: AlertPreferences = AlertPreferences()
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_status: Optional[str] = None
    plan: Optional[str] = None
    created_at: Optional[datetime] = None


class UpdateSubscriberRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, min_length=6, max_length=20)


class UpdateAlertPreferencesRequest(BaseModel):
    LOW: Optional[bool] = None
    MEDIUM: Optional[bool] = None
    HIGH: Optional[bool] = None
    CRITICAL: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    access_token: str
    new_password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    message: str


# ---------- Scan ----------

class ScanResponse(BaseModel):
    scan_id: str
    subscriber_id: str
    status: ScanStatus
    candidates_found: int
    matches_found: int
    started_at: datetime
    completed_at: Optional[datetime] = None


class ScansListResponse(BaseModel):
    subscriber_id: str
    total: int
    scans: list[ScanResponse]


# ---------- Detections ----------

class DetectionOut(BaseModel):
    id: str
    subscriber_id: str
    scan_id: Optional[str] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    platform: Optional[str] = None
    distance_score: Optional[float] = None
    deepfake_score: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    alert_message: Optional[str] = None
    alerted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class DetectionsListResponse(BaseModel):
    subscriber_id: str
    total: int
    detections: list[DetectionOut]


# ---------- Claude classification ----------

class ClaudeClassification(BaseModel):
    risk_level: RiskLevel
    alert_message: str
    reason: str


# ---------- Stripe ----------

class CreateCheckoutRequest(BaseModel):
    subscriber_id: str
    plan: Plan


class CreateCheckoutResponse(BaseModel):
    checkout_url: str


# ---------- Admin ----------

class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str


class UpdateSubscriberStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|suspended)$")


class AdminSubscriberOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    plan: Optional[str] = None
    subscription_status: Optional[str] = None
    account_status: str = "active"
    created_at: Optional[datetime] = None
    last_scan_at: Optional[datetime] = None
    total_detections: int = 0
    # Business-intelligence fields, computed (not billed - Stripe isn't live
    # yet) from the assigned plan and join date. See services/business_metrics.py.
    mrr_value: int = 0
    next_payment_due: Optional[datetime] = None
    suspended_at: Optional[datetime] = None


class AdminSubscribersListResponse(BaseModel):
    total: int
    subscribers: list[AdminSubscriberOut]


class AdminSubscriberDetail(BaseModel):
    subscriber: AdminSubscriberOut
    scans: list[ScanResponse]
    detections: list[DetectionOut]


class AdminDetectionOut(DetectionOut):
    subscriber_name: Optional[str] = None
    subscriber_email: Optional[str] = None


class AdminDetectionsListResponse(BaseModel):
    total: int
    detections: list[AdminDetectionOut]


class AdminScanOut(ScanResponse):
    subscriber_name: Optional[str] = None
    subscriber_email: Optional[str] = None
    error_message: Optional[str] = None


class AdminScansListResponse(BaseModel):
    total: int
    scans: list[AdminScanOut]


class AdminActivityItem(BaseModel):
    scan_id: str
    subscriber_name: Optional[str] = None
    subscriber_email: Optional[str] = None
    status: ScanStatus
    candidates_found: int
    matches_found: int
    started_at: datetime
    completed_at: Optional[datetime] = None


class AdminSystemStatus(BaseModel):
    api_healthy: bool
    supabase_healthy: bool


class AdminOverviewResponse(BaseModel):
    active_subscribers: int
    scans_today: int
    scans_this_week: int
    scans_this_month: int
    detections_today: int
    detections_this_week: int
    detections_this_month: int
    critical_high_last_24h: int
    system_status: AdminSystemStatus
    recent_activity: list[AdminActivityItem]
    # Business intelligence - all computed from assigned plan + join/suspend
    # dates, not real Stripe billing events (Stripe isn't live yet).
    mrr: float = 0
    monthly_subscriber_count: int = 0
    annual_subscriber_count: int = 0
    scans_today_completed: int = 0
    scans_today_failed: int = 0
    revenue_this_month: float = 0
    revenue_last_month: float = 0
    revenue_change_percent: Optional[float] = None
    cost_this_month_usd: float = 0
    gross_profit_this_month_inr: float = 0
    churn_this_month: int = 0


class AdminSubscriberPaymentRow(BaseModel):
    id: str
    name: Optional[str] = None
    email: EmailStr
    plan: Optional[str] = None
    mrr_value: int
    created_at: Optional[datetime] = None
    next_payment_due: Optional[datetime] = None


class AdminRevenueResponse(BaseModel):
    mrr: float
    arr: float
    monthly_plan_revenue: float
    annual_plan_revenue: float
    cost_breakdown_usd: dict[str, float]
    total_cost_this_month_usd: float
    total_cost_this_month_inr: float
    gross_margin_inr: float
    break_even_subscribers: Optional[int]
    fx_note: str
    subscribers: list[AdminSubscriberPaymentRow]


# ---------- Generic ----------

class ErrorResponse(BaseModel):
    detail: str
