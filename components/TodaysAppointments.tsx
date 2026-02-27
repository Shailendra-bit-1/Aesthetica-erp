import { Clock, ChevronRight, Circle } from "lucide-react";

const appointments = [
  {
    id: 1,
    time: "9:00 AM",
    duration: "45 min",
    patient: "Sophia Laurent",
    initials: "SL",
    treatment: "Botox — Forehead & Crow's Feet",
    status: "completed",
    room: "Suite A",
    avatarColor: "#C5A059",
  },
  {
    id: 2,
    time: "10:00 AM",
    duration: "60 min",
    patient: "Isabella Chen",
    initials: "IC",
    treatment: "Hydrafacial Deluxe",
    status: "in-progress",
    room: "Suite B",
    avatarColor: "#8B7EC8",
  },
  {
    id: 3,
    time: "11:30 AM",
    duration: "30 min",
    patient: "Camille Moreau",
    initials: "CM",
    treatment: "Filler Consultation",
    status: "upcoming",
    room: "Consult Room",
    avatarColor: "#7A9E8E",
  },
  {
    id: 4,
    time: "1:00 PM",
    duration: "75 min",
    patient: "Aria Nakamura",
    initials: "AN",
    treatment: "PRP Hair Restoration",
    status: "upcoming",
    room: "Suite A",
    avatarColor: "#B07A5A",
  },
  {
    id: 5,
    time: "2:30 PM",
    duration: "45 min",
    patient: "Elena Vasquez",
    initials: "EV",
    treatment: "Laser Resurfacing — Full Face",
    status: "upcoming",
    room: "Laser Suite",
    avatarColor: "#9E7A9E",
  },
];

const statusConfig = {
  completed: {
    label: "Completed",
    bg: "rgba(139,158,122,0.12)",
    color: "#6B8A5A",
    dot: "#6B8A5A",
  },
  "in-progress": {
    label: "In Progress",
    bg: "rgba(197,160,89,0.15)",
    color: "#A8853A",
    dot: "#C5A059",
  },
  upcoming: {
    label: "Upcoming",
    bg: "rgba(122,142,158,0.12)",
    color: "#5A7A8A",
    dot: "#7A8E9E",
  },
};

export default function TodaysAppointments() {
  return (
    <section
      className="rounded-2xl overflow-hidden luxury-card"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Clock size={18} style={{ color: "var(--gold)" }} />
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
          >
            Today&apos;s Appointments
          </h3>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
          >
            {appointments.length} scheduled
          </span>
        </div>
        <button
          className="text-sm flex items-center gap-1 font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--gold)" }}
        >
          View all
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Appointment list */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {appointments.map((appt) => {
          const status = statusConfig[appt.status as keyof typeof statusConfig];
          return (
            <div
              key={appt.id}
              className="px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors cursor-pointer group"
            >
              {/* Time column */}
              <div className="w-20 flex-shrink-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {appt.time}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {appt.duration}
                </p>
              </div>

              {/* Vertical line */}
              <div
                className="w-px h-10 flex-shrink-0"
                style={{ background: "var(--border)" }}
              />

              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: appt.avatarColor }}
              >
                {appt.initials}
              </div>

              {/* Patient info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                >
                  {appt.patient}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {appt.treatment}
                </p>
              </div>

              {/* Room badge */}
              <span
                className="text-xs px-2.5 py-1 rounded-lg font-medium hidden sm:block"
                style={{
                  background: "var(--surface-warm)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {appt.room}
              </span>

              {/* Status badge */}
              <span
                className="text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 flex-shrink-0"
                style={{ background: status.bg, color: status.color }}
              >
                <Circle size={6} fill={status.dot} stroke="none" />
                {status.label}
              </span>

              {/* Arrow */}
              <ChevronRight
                size={16}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: "var(--gold)" }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div
        className="px-6 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-warm)" }}
      >
        <button
          className="w-full text-sm font-medium py-2 rounded-xl transition-all duration-200 hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #C5A059, #A8853A)",
            color: "white",
            fontFamily: "Georgia, serif",
          }}
        >
          + Schedule New Appointment
        </button>
      </div>
    </section>
  );
}
