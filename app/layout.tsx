import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalSidebar from "@/components/ConditionalSidebar";
import InactivityGuard from "@/components/InactivityGuard";
import { ClinicProvider } from "@/contexts/ClinicContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { FeatureFlagsProvider } from "@flags/context";
import ImpersonationBanner from "@/components/ImpersonationBanner";
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
  title: "Aesthetica — Luxury Clinic Dashboard",
  description: "Premium Aesthetic & Dermatology Practice Management",
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
                <ImpersonationBanner />
                <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
                  <ConditionalSidebar />
                  <main className="flex-1 overflow-y-auto">
                    {children}
                  </main>
                </div>
              </InactivityGuard>
            </ImpersonationProvider>
          </FeatureFlagsProvider>
        </ClinicProvider>
        <Toaster
          position="top-right"
          gap={8}
          toastOptions={{
            style: {
              background: "#1C1917",
              border: "1px solid rgba(197,160,89,0.35)",
              color: "#E8E2D4",
              fontFamily: "Georgia, serif",
              borderRadius: "14px",
              padding: "14px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            },
          }}
        />
      </body>
    </html>
  );
}
