import { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-brand-border bg-brand-panel p-6 shadow-lg shadow-black/40 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
