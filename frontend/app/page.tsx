import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FEATURES = [
  {
    title: "Continuous Face Monitoring",
    description:
      "Scheduled scans search across the open internet for unauthorized use of your face — every platform, every upload.",
  },
  {
    title: "Deepfake Detection",
    description:
      "Every match is scored for deepfake probability so you know instantly whether you're looking at a real photo or a synthetic fake.",
  },
  {
    title: "Instant WhatsApp Alerts",
    description:
      "High and critical risk detections are pushed straight to your phone the moment they're found — no dashboards to babysit.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-6 md:px-16">
        <span className="text-xl font-bold tracking-tight">
          FO<span className="text-brand-red">FO</span>
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-neutral-300 hover:text-white">
            Log in
          </Link>
          <Link href="/register">
            <Button>Get Protected</Button>
          </Link>
        </nav>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center md:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,0,0,0.18),transparent_60%)]"
        />
        <span className="relative mb-6 inline-block rounded-full border border-brand-border bg-brand-panel px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-neutral-400">
          Face Identity Protection
        </span>
        <h1 className="relative max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Your Face Is Your Brand.
          <br />
          <span className="text-brand-red">We Protect It.</span>
        </h1>
        <p className="relative mt-6 max-w-xl text-lg text-neutral-400">
          FOFO scans the internet around the clock for unauthorized and deepfake use of your face —
          and alerts you the moment it finds something.
        </p>
        <div className="relative mt-10">
          <Link href="/register">
            <Button className="px-8 py-4 text-base">Get Protected →</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 px-6 pb-24 md:grid-cols-3 md:px-16">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">{feature.description}</p>
          </Card>
        ))}
      </section>

      <section className="border-t border-brand-border px-6 py-16 text-center md:px-16">
        <h2 className="text-2xl font-bold text-white">One plan. Full protection.</h2>
        <div className="mx-auto mt-8 grid max-w-2xl gap-6 md:grid-cols-2">
          <Card>
            <p className="text-sm uppercase tracking-widest text-neutral-500">Monthly</p>
            <p className="mt-2 text-3xl font-bold text-white">
              ₹50,000<span className="text-base font-normal text-neutral-500">/mo</span>
            </p>
          </Card>
          <Card className="border-brand-red/60">
            <p className="text-sm uppercase tracking-widest text-neutral-500">Annual</p>
            <p className="mt-2 text-3xl font-bold text-white">
              ₹500,000<span className="text-base font-normal text-neutral-500">/yr</span>
            </p>
          </Card>
        </div>
        <Link href="/register">
          <Button className="mt-10 px-8 py-4 text-base">Get Protected →</Button>
        </Link>
      </section>

      <footer className="border-t border-brand-border px-6 py-8 text-center text-xs text-neutral-600 md:px-16">
        © {new Date().getFullYear()} FOFO. All rights reserved.
      </footer>
    </main>
  );
}
