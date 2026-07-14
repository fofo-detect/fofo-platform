"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { DashButton, DashCard, DashInput } from "@/components/dashboard/ui";
import { getErrorMessage, changePassword, updateSubscriber } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard-context";
import { PHONE_HINT, PHONE_PATTERN } from "@/lib/validation";

export default function ProfilePage() {
  const { session, subscriber, loading, refetchSubscriber } = useDashboard();

  const [form, setForm] = useState({ name: "", phone: "" });
  const [initialized, setInitialized] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (subscriber && !initialized) {
      setForm({ name: subscriber.name ?? "", phone: subscriber.phone ?? "" });
      setInitialized(true);
    }
  }, [subscriber, initialized]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!form.name || !form.phone) {
      setProfileError("Please fill in all fields");
      return;
    }
    if (!PHONE_PATTERN.test(form.phone)) {
      setProfileError(PHONE_HINT);
      return;
    }
    setSavingProfile(true);
    try {
      await updateSubscriber(session.subscriberId, { name: form.name, phone: form.phone });
      await refetchSubscriber();
      setProfileSuccess("Profile updated");
    } catch (err) {
      setProfileError(getErrorMessage(err, "Could not update profile. Please try again."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!session.accessToken) {
      setPasswordError("Please log out and log back in to change your password.");
      return;
    }
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(session.accessToken, passwordForm.newPassword);
      setPasswordSuccess("Password updated successfully");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(getErrorMessage(err, "Could not update password. Please try again."));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-ink">Profile & Settings</h1>
        <p className="mt-1 text-sm text-dash-sub">Manage your account details and enrolled face photos.</p>
      </div>

      <DashCard className="p-6">
        <h2 className="text-base font-semibold text-dash-ink">Account details</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 flex flex-col gap-4">
          <DashInput id="email" label="Email" value={subscriber?.email ?? ""} disabled />
          <DashInput
            id="name"
            label="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={loading}
          />
          <DashInput
            id="phone"
            label="Phone number (WhatsApp)"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98765 43210"
            disabled={loading}
          />

          {profileError && <p className="text-sm text-brand-red">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-emerald-700">{profileSuccess}</p>}

          <div>
            <DashButton type="submit" loading={savingProfile} disabled={loading}>
              Save changes
            </DashButton>
          </div>
        </form>
      </DashCard>

      <DashCard className="p-6">
        <h2 className="text-base font-semibold text-dash-ink">Change password</h2>
        <form onSubmit={handleChangePassword} className="mt-4 flex flex-col gap-4">
          <DashInput
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="At least 8 characters"
          />
          <DashInput
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="Repeat new password"
          />

          {passwordError && <p className="text-sm text-brand-red">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-emerald-700">{passwordSuccess}</p>}

          <div>
            <DashButton type="submit" variant="secondary" loading={savingPassword}>
              Update password
            </DashButton>
          </div>
        </form>
      </DashCard>

      <DashCard className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dash-ink">Enrolled face photos</h2>
          <Link href="/onboard">
            <DashButton variant="secondary" type="button">
              Re-enroll face
            </DashButton>
          </Link>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-dash-sub">Loading…</p>
        ) : subscriber?.reference_image_urls && subscriber.reference_image_urls.length > 0 ? (
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {subscriber.reference_image_urls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Enrolled face angle"
                className="aspect-square w-full rounded-lg border border-dash-border object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-dash-sub">No enrolled photos found. Complete enrollment to get protected.</p>
        )}
      </DashCard>
    </div>
  );
}
