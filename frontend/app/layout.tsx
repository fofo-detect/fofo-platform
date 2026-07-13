import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOFO | Face Identity Protection",
  description: "Your face is your brand. We protect it. Continuous deepfake and unauthorized-use monitoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-black text-neutral-100 antialiased min-h-screen">{children}</body>
    </html>
  );
}
