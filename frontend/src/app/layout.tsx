import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import Nav, { NavFallback } from "@/components/Nav";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ChannelLens · YouTube channel analytics", template: "%s · ChannelLens" },
  description:
    "Look up any YouTube channel, compare up to four side by side, and track subscriber and view growth over time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          <Suspense fallback={<NavFallback />}>
            <Nav />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
            Data from the YouTube Data API v3. Revenue figures are estimates, not real earnings.
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
