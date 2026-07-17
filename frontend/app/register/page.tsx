"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getErrorMessage, signup } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { EMAIL_PATTERN, PHONE_HINT, PHONE_PATTERN } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", profession: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!form.name || !form.email || !form.phone || !form.password) {
      return "Please fill in all fields";
    }
    if (!EMAIL_PATTERN.test(form.email)) {
      return "Please enter a valid email address";
    }
    if (!PHONE_PATTERN.test(form.phone)) {
      return PHONE_HINT;
    }
    if (form.password.length < 8) {
      return "Password must be at least 8 characters";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const result = await signup({ ...form, profession: form.profession.trim() || undefined });
      saveSession({
        subscriberId: result.user_id,
        accessToken: result.access_token ?? undefined,
        email: result.email,
        name: form.name,
      });
      router.push("/onboard");
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">Start protecting your face online.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Input
            id="name"
            label="Full name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Doe"
          />
          <Input
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
          />
          <Input
            id="phone"
            label="Phone (WhatsApp)"
            type="tel"
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
          <Input
            id="profession"
            label="Profession (optional)"
            autoComplete="organization-title"
            value={form.profession}
            onChange={(e) => setForm({ ...form, profession: e.target.value })}
            placeholder="e.g. Actor, Politician, CEO"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
          />

          {error && (
            <p className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already protected?{" "}
          <Link href="/login" className="text-neutral-300 hover:text-white">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
