"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError, createCheckoutSession } from "@/lib/api";
import { getSession } from "@/lib/session";

type Plan = "monthly" | "annual";

export default function SubscribePage() {
  const router = useRouter();
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setSubscriberId(session.subscriberId);
  }, [router]);

  async function handleSubscribe(plan: Plan) {
    if (!subscriberId) return;
    setError(null);
    setLoadingPlan(plan);
    try {
      const { checkout_url } = await createCheckoutSession(subscriberId, plan);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start checkout. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">Activate your protection</h1>
          <p className="mt-2 text-neutral-400">One plan. Full coverage. No trials, no tiers.</p>
        </div>

        {error && (
          <p className="mb-6 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="flex flex-col">
            <p className="text-sm uppercase tracking-widest text-neutral-500">Monthly</p>
            <p className="mt-3 text-4xl font-bold text-white">
              ₹50,000<span className="text-base font-normal text-neutral-500">/mo</span>
            </p>
            <p className="mt-2 text-sm text-neutral-500">Billed every month, cancel anytime.</p>
            <Button
              onClick={() => handleSubscribe("monthly")}
              loading={loadingPlan === "monthly"}
              disabled={loadingPlan !== null && loadingPlan !== "monthly"}
              className="mt-8"
            >
              Subscribe Monthly
            </Button>
          </Card>

          <Card className="flex flex-col border-brand-red/60">
            <p className="text-sm uppercase tracking-widest text-neutral-500">Annual</p>
            <p className="mt-3 text-4xl font-bold text-white">
              ₹500,000<span className="text-base font-normal text-neutral-500">/yr</span>
            </p>
            <p className="mt-2 text-sm text-neutral-500">Two months free versus monthly billing.</p>
            <Button
              onClick={() => handleSubscribe("annual")}
              loading={loadingPlan === "annual"}
              disabled={loadingPlan !== null && loadingPlan !== "annual"}
              className="mt-8"
            >
              Subscribe Annually
            </Button>
          </Card>
        </div>
      </div>
    </main>
  );
}
