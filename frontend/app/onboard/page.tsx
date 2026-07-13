"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { FaceCapture } from "@/components/FaceCapture";
import { ApiError, enrollFace } from "@/lib/api";
import { getSession } from "@/lib/session";

export default function OnboardPage() {
  const router = useRouter();
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/register");
      return;
    }
    setSubscriberId(session.subscriberId);
  }, [router]);

  async function handleComplete(files: File[]) {
    if (!subscriberId) return;
    setError(null);
    setSubmitting(true);
    try {
      await enrollFace(subscriberId, files);
      router.push("/subscribe");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enrollment failed. Please try again.");
      setSubmitting(false);
    }
  }

  if (!subscriberId) return null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-lg">
        <h1 className="text-center text-2xl font-bold text-white">Enroll your face</h1>
        <p className="mt-1 text-center text-sm text-neutral-400">
          We use your camera to build your protection profile — nothing is shared publicly.
        </p>

        <div className="mt-8">
          <FaceCapture onComplete={handleComplete} submitting={submitting} />
        </div>

        {error && (
          <p className="mt-6 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}
      </Card>
    </main>
  );
}
