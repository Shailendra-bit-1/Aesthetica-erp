import TopBar from "@/components/TopBar";

export default function Page() {
  const titles: Record<string, string> = {
    patients: "Patient Records",
    scheduler: "Smart Scheduler",
    photos: "Photo Comparison",
    inventory: "Inventory",
    settings: "Settings",
  };
  const title = titles["settings"] ?? "settings";
  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="px-8 py-12 flex flex-col items-center justify-center gap-4" style={{ minHeight: "60vh" }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.25)" }}
        >
          <span style={{ color: "var(--gold)", fontSize: 28 }}>✦</span>
        </div>
        <h1
          className="text-3xl font-semibold"
          style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
        >
          {title}
        </h1>
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          This section is coming soon.
        </p>
      </div>
    </div>
  );
}
