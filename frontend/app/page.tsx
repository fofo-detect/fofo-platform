import Link from "next/link";
import { FaceMeshVisual } from "@/components/landing/FaceMeshVisual";

const NAV_LINKS = [
  { label: "The Threat", href: "#threat" },
  { label: "The Intelligence", href: "#intelligence" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Membership", href: "#membership" },
];

const STATS_BAR = [
  { value: "24/7", label: "Continuous Monitoring" },
  { value: "3-Hour", label: "Alert SLA" },
  { value: "8", label: "Scans Daily" },
  { value: "Court-Ready", label: "Evidence" },
];

const THREAT_STATS = [
  { value: "$200M+", label: "losses from AI executive impersonations in Q1 2025" },
  { value: "62%", label: "of organizations experienced a deepfake attack in the past 12 months" },
  { value: "3 seconds", label: "of voice is all an attacker needs to clone it" },
  { value: "Days or weeks", label: "detection window without FOFO" },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Identity Enrollment",
    body: "Your face is enrolled using liveness detection. Your biometric profile becomes the baseline for all monitoring.",
  },
  {
    step: "02",
    title: "Perimeter Activation",
    body: "Within minutes, your digital perimeter is live. Our systems begin scanning across platforms, geographies, and languages.",
  },
  {
    step: "03",
    title: "Alert and Response",
    body: "When a threat is detected, you are notified within hours. You receive a complete brief — what was found, where, how widely it spread, and your response options.",
  },
];

const SERVICE_FEATURES = [
  {
    number: "01",
    title: "Continuous Face Monitoring",
    body: "We maintain persistent surveillance across all major platforms — Instagram, YouTube, X, TikTok, Facebook, and beyond — scanning for any unauthorized use of your face.",
  },
  {
    number: "02",
    title: "Deepfake Detection and Analysis",
    body: "Our multi-model detection engine identifies AI-generated and AI-manipulated content. Every flag comes with a forensic brief — confidence score, manipulation method, and documented evidence chain.",
  },
  {
    number: "03",
    title: "Instant WhatsApp Alerts",
    body: "The moment a threat is confirmed, a private alert reaches your phone. Not an email. Not a dashboard notification. Your phone.",
  },
];

const CLIENT_COLUMNS = [
  {
    title: "Public Life and Politics",
    body: "Elected officials, political leaders, and public servants whose fabricated words can destabilize institutions or end careers.",
  },
  {
    title: "Business and Finance",
    body: "CEOs, founders, and executives whose endorsement can move markets and whose voice can authorize transactions.",
  },
  {
    title: "Entertainment and Culture",
    body: "Artists, performers, and athletes whose image is simultaneously their livelihood and their identity.",
  },
];

const MEMBERSHIP_INCLUDES = [
  "24/7 continuous monitoring across all major platforms",
  "8 automated scans daily — every 3 hours",
  "Instant WhatsApp alerts on HIGH and CRITICAL detections",
  "Full forensic documentation on every detected incident",
  "Court-ready evidence packages",
  "Monthly private threat intelligence briefing",
  "Priority response within 3 hours of detection",
];

const FOOTER_LINKS = [
  { label: "The Threat", href: "#threat" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Membership", href: "#membership" },
  { label: "Privacy", href: "#" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c2ff]">{children}</p>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#050810] via-[#0a1128] to-black text-white">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050810]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <span className="text-lg font-bold tracking-tight">
            FO<span className="text-[#00c2ff]">FO</span>
          </span>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <Link
            href="/register"
            className="rounded-md bg-[#00c2ff] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#33d1ff]"
          >
            Get Protected
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 md:px-10 md:pb-32 md:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(0,194,255,0.12),transparent_45%)]"
        />
        <div className="relative grid gap-16 md:grid-cols-2 md:items-center md:gap-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00c2ff]/40 bg-[#00c2ff]/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#7fe0ff]">
              Classified · Face Integrity System
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
              Your face is the most powerful thing you own. Someone is already trying to use it
              against you.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              FOFO monitors the entire internet — every platform, every channel — 24 hours a day
              for unauthorized use of your face, voice, and likeness. Deepfakes. Fake endorsements.
              AI-generated identity fraud.
            </p>
            <div className="mt-10">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-[#00c2ff] px-7 py-3.5 text-base font-semibold text-black transition-colors hover:bg-[#33d1ff]"
              >
                Get Protected →
              </Link>
              <p className="mt-4 max-w-sm text-xs leading-relaxed text-white/40">
                FOFO is not a consumer product. It is a private intelligence service for
                individuals whose identity carries public weight.
              </p>
            </div>
          </div>

          <FaceMeshVisual />
        </div>
      </section>

      {/* ---------- Stats bar ---------- */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4 md:px-10">
          {STATS_BAR.map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <p className="text-2xl font-bold text-[#00c2ff] md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- The Threat ---------- */}
      <section id="threat" className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
        <SectionLabel>The Landscape</SectionLabel>
        <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          Seeing is no longer believing. That is the problem.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
          A few years ago, creating a convincing deepfake required significant technical skill.
          Today, it takes three seconds of your voice and a single photograph. Anyone with an
          internet connection can generate video of you saying things you never said, endorsing
          products you never touched, or doing things you would never do. By the time your team
          discovers it, the video has been seen by millions. The damage is done.
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {THREAT_STATS.map((stat) => (
            <div key={stat.label} className="border-l-2 border-[#00c2ff]/40 pl-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-sm leading-snug text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 max-w-2xl text-lg font-medium leading-relaxed text-white/80">
          The problem is not that deepfakes are sophisticated. The problem is that no one is
          watching. <span className="text-[#00c2ff]">FOFO watches.</span>
        </p>
      </section>

      {/* ---------- How It Works ---------- */}
      <section id="how-it-works" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
          <SectionLabel>The Process</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Discreet. Thorough. Ongoing.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {PROCESS_STEPS.map((step) => (
              <div key={step.step}>
                <p className="text-sm font-semibold text-[#00c2ff]">{step.step}</p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- The Intelligence / Features ---------- */}
      <section id="intelligence" className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
        <SectionLabel>The Service</SectionLabel>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          Continuous surveillance of your digital identity. On every surface. Without
          interruption.
        </h2>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {SERVICE_FEATURES.map((feature) => (
            <div
              key={feature.number}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-[#00c2ff]/40"
            >
              <p className="text-xs font-semibold text-[#00c2ff]">{feature.number}</p>
              <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Who We Protect ---------- */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
          <SectionLabel>The Client</SectionLabel>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Built for people whose name is their most valuable asset.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {CLIENT_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-lg font-semibold">{col.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{col.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-14 max-w-2xl text-base font-medium leading-relaxed text-white/70">
            FOFO does not serve everyone. We serve the people for whom the risk is greatest and
            the consequences of inaction are most severe.
          </p>
        </div>
      </section>

      {/* ---------- Membership ---------- */}
      <section id="membership" className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
        <SectionLabel>The Terms</SectionLabel>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          One price. Complete protection. No exceptions.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
          FOFO operates as a private membership service. There are no tiers, no feature
          limitations, and no basic plans. Every client receives the complete service.
        </p>

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
          <div className="rounded-2xl border border-[#00c2ff]/30 bg-white/[0.03] p-8">
            <p className="text-4xl font-bold">
              $599<span className="text-base font-normal text-white/50">/month</span>
            </p>
            <p className="mt-2 text-sm text-white/50">
              or <span className="font-semibold text-white/80">$5,990/year</span> — two months
              complimentary
            </p>

            <ul className="mt-8 flex flex-col gap-3">
              {MEMBERSHIP_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00c2ff]" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-10 inline-flex items-center gap-2 rounded-md bg-[#00c2ff] px-7 py-3.5 text-base font-semibold text-black transition-colors hover:bg-[#33d1ff]"
            >
              Request Access →
            </Link>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-lg font-medium leading-relaxed text-white/80">
              No free trial. No demo access. If you are at the level where FOFO is relevant to
              you, a trial is not what you are looking for. You are looking for certainty.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="text-sm font-semibold text-white">
              FOFO — Face Ownership and Fraud Observation
            </p>
            <p className="mt-1 max-w-md text-xs text-white/40">
              A private intelligence service for individuals whose name, face, and reputation are
              irreplaceable.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 px-6 py-6 text-center text-xs text-white/30 md:px-10">
          © {new Date().getFullYear()} FOFO. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
