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

class SubscriberOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_status: Optional[str] = None
    plan: Optional[str] = None
    created_at: Optional[datetime] = None


# ---------- Scan ----------

class ScanResponse(BaseModel):
    scan_id: str
    subscriber_id: str
    status: ScanStatus
    candidates_found: int
    matches_found: int
    started_at: datetime
    completed_at: Optional[datetime] = None


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
