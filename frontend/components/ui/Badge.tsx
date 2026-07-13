import { RiskLevel } from "@/lib/api";

const riskStyles: Record<RiskLevel, string> = {
  LOW: "bg-emerald-950 text-emerald-400 border-emerald-800",
  MEDIUM: "bg-amber-950 text-amber-400 border-amber-800",
  HIGH: "bg-orange-950 text-orange-400 border-orange-800",
  CRITICAL: "bg-red-950 text-red-400 border-red-800",
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) {
    return (
      <span className="inline-block rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Unknown
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${riskStyles[level]}`}
    >
      {level}
    </span>
  );
}

export function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium text-neutral-300 ${className}`}
    >
      {children}
    </span>
  );
}
