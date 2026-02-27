import { ImageIcon, ChevronRight, ArrowLeftRight, Download } from "lucide-react";

const photos = [
  {
    id: 1,
    patient: "Sophia Laurent",
    initials: "SL",
    treatment: "Botox — Forehead",
    date: "Feb 26, 2026",
    beforeColor: "#D4C5B0",
    afterColor: "#E8DDD0",
    avatarColor: "#C5A059",
    improvement: "Excellent",
    sessions: 2,
  },
  {
    id: 2,
    patient: "Isabella Chen",
    initials: "IC",
    treatment: "Hydrafacial",
    date: "Feb 24, 2026",
    beforeColor: "#C8B8A5",
    afterColor: "#E0D5C8",
    avatarColor: "#8B7EC8",
    improvement: "Significant",
    sessions: 3,
  },
  {
    id: 3,
    patient: "Camille Moreau",
    initials: "CM",
    treatment: "Lip Filler",
    date: "Feb 22, 2026",
    beforeColor: "#D0BFAF",
    afterColor: "#EAE0D5",
    avatarColor: "#7A9E8E",
    improvement: "Excellent",
    sessions: 1,
  },
  {
    id: 4,
    patient: "Aria Nakamura",
    initials: "AN",
    treatment: "PRP Therapy",
    date: "Feb 20, 2026",
    beforeColor: "#C5B5A2",
    afterColor: "#DED0C2",
    avatarColor: "#B07A5A",
    improvement: "Good",
    sessions: 4,
  },
];

const improvementConfig = {
  Excellent: { bg: "rgba(139,158,122,0.15)", color: "#6B8A5A" },
  Significant: { bg: "rgba(197,160,89,0.15)", color: "#A8853A" },
  Good: { bg: "rgba(122,142,158,0.15)", color: "#5A7A8A" },
};

export default function RecentPhotos() {
  return (
    <section
      className="rounded-2xl luxury-card overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <ImageIcon size={18} style={{ color: "var(--gold)" }} />
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
          >
            Recent Photos
          </h3>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
          >
            Before &amp; After
          </span>
        </div>
        <button
          className="text-sm flex items-center gap-1 font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--gold)" }}
        >
          View all photos
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Photo grid */}
      <div className="p-6 grid grid-cols-4 gap-5">
        {photos.map((photo) => {
          const impConfig =
            improvementConfig[photo.improvement as keyof typeof improvementConfig];
          return (
            <div
              key={photo.id}
              className="group cursor-pointer"
            >
              {/* Before/After image frames */}
              <div className="relative rounded-xl overflow-hidden mb-3">
                <div className="grid grid-cols-2 gap-0.5">
                  {/* Before */}
                  <div
                    className="h-32 flex flex-col items-center justify-center relative overflow-hidden"
                    style={{ background: photo.beforeColor }}
                  >
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 5px)",
                      }}
                    />
                    {/* Simulated face silhouette */}
                    <div
                      className="w-10 h-12 rounded-full opacity-30"
                      style={{ background: "rgba(0,0,0,0.2)" }}
                    />
                    <span
                      className="absolute bottom-2 left-2 text-xs font-bold uppercase tracking-wider"
                      style={{ color: "rgba(0,0,0,0.4)" }}
                    >
                      Before
                    </span>
                  </div>
                  {/* After */}
                  <div
                    className="h-32 flex flex-col items-center justify-center relative overflow-hidden"
                    style={{ background: photo.afterColor }}
                  >
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px)",
                      }}
                    />
                    <div
                      className="w-10 h-12 rounded-full opacity-20"
                      style={{ background: "rgba(0,0,0,0.15)" }}
                    />
                    <span
                      className="absolute bottom-2 right-2 text-xs font-bold uppercase tracking-wider"
                      style={{ color: "rgba(0,0,0,0.35)" }}
                    >
                      After
                    </span>
                  </div>
                </div>

                {/* Center compare button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div
                    className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      background: "rgba(28,25,23,0.85)",
                      color: "var(--gold)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <ArrowLeftRight size={12} />
                    Compare
                  </div>
                </div>

                {/* Download overlay */}
                <button
                  className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                  style={{ background: "rgba(28,25,23,0.7)" }}
                >
                  <Download size={11} style={{ color: "var(--gold)" }} />
                </button>
              </div>

              {/* Patient info */}
              <div className="flex items-start gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: photo.avatarColor }}
                >
                  {photo.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                  >
                    {photo.patient}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {photo.treatment}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: impConfig.bg, color: impConfig.color }}
                    >
                      {photo.improvement}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Session {photo.sessions}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-warm)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Showing 4 of 127 photo records
        </p>
        <button
          className="text-xs font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{
            background: "rgba(197,160,89,0.15)",
            color: "var(--gold)",
            border: "1px solid rgba(197,160,89,0.3)",
          }}
        >
          Open Photo Studio →
        </button>
      </div>
    </section>
  );
}
