import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalTopBar from "@/components/ConditionalTopBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import InactivityGuard from "@/components/InactivityGuard";
import { ClinicProvider } from "@/contexts/ClinicContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { FeatureFlagsProvider } from "@flags/context";
import FeedbackWidget from "@/components/FeedbackWidget";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aesthetica — Clinic Management Suite",
  description: "Aesthetic & Dermatology Practice Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClinicProvider>
          {/* FeatureFlagsProvider MUST be inside ClinicProvider (needs activeClinicId) */}
          <FeatureFlagsProvider>
            <ImpersonationProvider>
              <InactivityGuard>
                <ConditionalTopBar />
                <main className="min-h-screen pt-16" style={{ background: "var(--bg)" }}>
                  {children}
                </main>
                <FeedbackWidget />
                <MobileBottomNav />
              </InactivityGuard>
            </ImpersonationProvider>
          </FeatureFlagsProvider>
        </ClinicProvider>
        <Toaster
          position="top-right"
          gap={8}
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: "10px",
              padding: "12px 16px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
