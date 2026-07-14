"use client";

import Link from "next/link";
import { useState } from "react";
import { DashButton, DashCard, ErrorBanner, Switch } from "@/components/dashboard/ui";
import { RiskLevel, getErrorMessage, sendTestAlert, updateAlertPreferences } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard-context";

const RISK_LEVELS: Array<{ level: RiskLevel; label: string; description: string }> = [
  { level: "CRITICAL", label: "Critical risk", description: "Confirmed unauthorized deepfake or explicit misuse." },
  { level: "HIGH", label: "High risk", description: "Strong likelihood of unauthorized use of your face." },
  { level: "MEDIUM", label: "Medium risk", description: "Possible match that needs manual review." },
  { level: "LOW", label: "Low risk", description: "Low-confidence match, unlikely to need action." },
];

export default function AlertsPage() {
  const { session, subscriber, loading, error, refetchSubscriber } = useDashboard();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleToggle(level: RiskLevel, next: boolean) {
    setToggleError(null);
    setSavingLevel(level);
    try {
      await updateAlertPreferences(session.subscriberId, { [level]: next } as Partial<Record<RiskLevel, boolean>>);
      await refetchSubscriber();
    } catch (err) {
      setToggleError(getErrorMessage(err, "Could not update alert settings. Please try again."));
    } finally {
      setSavingLevel(null);
    }
  }

  async function handleTestAlert() {
    setTestError(null);
    setTestResult(null);
    setTestSending(true);
    try {
      const result = await sendTestAlert(session.subscriberId);
      setTestResult(result.message);
    } catch (err) {
      setTestError(getErrorMessage(err, "Could not send test alert. Please try again."));
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Alert Settings</h1>
        <p className="mt-1 text-sm text-dash-sub">Choose which risk levels send you a WhatsApp alert.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <DashCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-dash-ink">WhatsApp number</h2>
            <p className="mt-1 text-sm text-dash-sub">
              {loading ? "Loading…" : subscriber?.phone || "No number on file"}
            </p>
          </div>
          <Link href="/dashboard/profile" className="text-sm font-medium text-dash-sub hover:text-dash-ink">
            Edit
          </Link>
        </div>
      </DashCard>

      <DashCard className="p-6">
        <h2 className="text-base font-semibold text-dash-ink">Alert by risk level</h2>
        {toggleError && (
          <div className="mt-4">
            <ErrorBanner message={toggleError} />
          </div>
        )}
        <div className="mt-4 flex flex-col divide-y divide-dash-border">
          {RISK_LEVELS.map(({ level, label, description }) => (
            <div key={level} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-dash-ink">{label}</p>
                <p className="mt-0.5 text-xs text-dash-sub">{description}</p>
              </div>
              <Switch
                checked={subscriber?.alert_preferences?.[level] ?? false}
                onChange={(next) => handleToggle(level, next)}
                disabled={loading || savingLevel === level}
              />
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard className="p-6">
        <h2 className="text-base font-semibold text-dash-ink">Test alert</h2>
        <p className="mt-1 text-sm text-dash-sub">Send a test WhatsApp message to confirm alerts are working.</p>

        {testResult && <p className="mt-3 text-sm text-emerald-700">{testResult}</p>}
        {testError && (
          <div className="mt-3">
            <ErrorBanner message={testError} />
          </div>
        )}

        <div className="mt-4">
          <DashButton variant="secondary" onClick={handleTestAlert} loading={testSending} disabled={loading}>
            Send test alert
          </DashButton>
        </div>
      </DashCard>
    </div>
  );
}
