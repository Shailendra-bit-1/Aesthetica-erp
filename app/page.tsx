"use client";

import TopBar from "@/components/TopBar";
import StatsRow from "@/components/StatsRow";
import TodaysAppointments from "@/components/TodaysAppointments";
import RecentPatients from "@/components/RecentPatients";
import QuickActions from "@/components/QuickActions";

export default function OverviewPage() {
  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="flex-1 px-8 pb-10 space-y-8">

        {/* Live stats row — shows Global View banner automatically for superadmin */}
        <StatsRow />

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left column — Appointments */}
          <div className="col-span-2 space-y-6">
            <TodaysAppointments />
          </div>

          {/* Right column — Quick actions */}
          <div className="col-span-1 space-y-6">
            <QuickActions />
          </div>
        </div>

        {/* Recent Patients — live, scoped by clinic, HIPAA-logged on click */}
        <RecentPatients />
      </div>
    </div>
  );
}
