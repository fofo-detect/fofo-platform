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


# ---------- Generic ----------

class ErrorResponse(BaseModel):
    detail: str
