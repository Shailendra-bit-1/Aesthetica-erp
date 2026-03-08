
export default function Page() {
  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>

      <div className="px-8 py-12 flex flex-col items-center justify-center gap-4" style={{ minHeight: "60vh" }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.25)" }}
        >
          📊
        </div>
        <h1
          className="text-3xl font-semibold"
          style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
        >
          Analytics
        </h1>
        <span
          className="text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-widest"
          style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)" }}
        >
          Superadmin Only
        </span>
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          This section is coming soon.
        </p>
      </div>
    </div>
  );
}
