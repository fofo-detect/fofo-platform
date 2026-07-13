"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError, enrollFace } from "@/lib/api";
import { getSession } from "@/lib/session";

const SLOT_LABELS = ["Front-facing", "Slight angle", "Different lighting"];

export default function OnboardPage() {
  const router = useRouter();
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/register");
      return;
    }
    setSubscriberId(session.subscriberId);
  }, [router]);

  function handleFileChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  }

  async function handleSubmit() {
    if (!subscriberId) return;
    const files = photos.filter((f): f is File => f !== null);
    if (files.length !== 3) {
      setError("Please upload all 3 photos.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await enrollFace(subscriberId, files);
      router.push("/subscribe");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enrollment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const allSelected = photos.every((p) => p !== null);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-white">Enroll your face</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Upload 3 clear photos of your face. FOFO uses these to build your protection profile —
          they are never shared publicly.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SLOT_LABELS.map((label, index) => (
            <label
              key={label}
              htmlFor={`photo-${index}`}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-brand-border bg-neutral-900 text-center transition-colors hover:border-brand-red"
            >
              {previews[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[index] as string} alt={label} className="h-full w-full object-cover" />
              ) : (
                <span className="px-3 text-xs text-neutral-500">{label}</span>
              )}
              <input
                id={`photo-${index}`}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(index, e)}
              />
            </label>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={!allSelected}
          className="mt-8 w-full"
        >
          {loading ? "Encoding your face…" : "Continue"}
        </Button>
      </Card>
    </main>
  );
}
