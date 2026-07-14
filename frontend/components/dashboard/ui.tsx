"use client";

import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, forwardRef } from "react";
import { RiskLevel, ScanStatus } from "@/lib/api";

export function DashCard({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-dash-border bg-dash-card shadow-[0_1px_2px_rgba(26,26,26,0.04),0_8px_24px_-16px_rgba(26,26,26,0.12)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  caption?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <DashCard className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-dash-sub">{label}</p>
        {icon && <span className="text-dash-sub">{icon}</span>}
      </div>
      <p className={`mt-3 text-2xl font-semibold ${accent ? "text-brand-red" : "text-dash-ink"}`}>{value}</p>
      {caption && <p className="mt-1 text-xs text-dash-sub">{caption}</p>}
    </DashCard>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

interface DashButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-red text-white hover:bg-[#6f0000] disabled:hover:bg-brand-red",
  secondary: "bg-white border border-dash-border text-dash-ink hover:border-dash-ink/30 hover:bg-dash-hover",
  ghost: "bg-transparent text-dash-sub hover:text-dash-ink",
};

export const DashButton = forwardRef<HTMLButtonElement, DashButtonProps>(
  ({ variant = "primary", loading = false, className = "", children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {children}
    </button>
  )
);
DashButton.displayName = "DashButton";

interface DashInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DashInput = forwardRef<HTMLInputElement, DashInputProps>(
  ({ label, error, className = "", id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-dash-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded-lg border border-dash-border bg-white px-3.5 py-2.5 text-sm text-dash-ink placeholder:text-dash-sub/60 outline-none transition-colors focus:border-brand-red disabled:cursor-not-allowed disabled:bg-dash-hover disabled:text-dash-sub ${
          error ? "border-red-400" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </div>
  )
);
DashInput.displayName = "DashInput";

const riskStyles: Record<RiskLevel, string> = {
  LOW: "bg-neutral-100 text-neutral-600 border-neutral-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-50 text-brand-red border-red-200",
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) {
    return (
      <span className="inline-block rounded-full border border-dash-border bg-dash-hover px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-dash-sub">
        Unknown
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${riskStyles[level]}`}
    >
      {level}
    </span>
  );
}

const scanStatusStyles: Record<ScanStatus, string> = {
  pending: "bg-neutral-100 text-neutral-600 border-neutral-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-brand-red border-red-200",
};

const scanStatusLabels: Record<ScanStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${scanStatusStyles[status]}`}
    >
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />}
      {scanStatusLabels[status]}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-dash-border py-16 text-center">
      <p className="text-base font-medium text-dash-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-dash-sub">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-brand-red" : "bg-neutral-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{message}</div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-dash-border border-t-brand-red ${className}`}
    />
  );
}
