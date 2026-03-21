import { type Session, type Shot, fetchShots } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * Export shots for a session as CSV. If shots are not provided,
 * they will be fetched from Supabase.
 */
export async function exportSessionCSV(
  session: Session,
  shotsArg?: Shot[]
): Promise<void> {
  const sessionId = session.id;
  if (!sessionId) {
    toast.error("Session has no ID");
    return;
  }

  const shots = shotsArg ?? (await fetchShots(sessionId));
  if (shots.length === 0) {
    toast.info("No shots to export");
    return;
  }

  const unit = session.distance_unit === "yards" ? "yd" : "m";
  const tempLabel = session.temperature_unit === "celsius" ? "°C" : "°F";
  const windLabel = session.wind_unit === "kmh" ? "km/h" : "mph";
  const elevLabel = session.distance_unit === "meters" ? "m" : "ft";

  const meta = [
    `Session ID: ${sessionId}`,
    `Date: ${session.created_at ? new Date(session.created_at).toLocaleString() : "Unknown"}`,
    `Temperature: ${session.temperature}${tempLabel}`,
    `Humidity: ${session.humidity}%`,
    `Wind: ${session.wind_speed} ${windLabel} ${session.wind_direction}`,
    `Elevation: ${session.elevation} ${elevLabel}`,
    `Shots: ${shots.length}`,
    "",
  ];

  const header = [
    "Shot #",
    "Club",
    `Raw Carry (${unit})`,
    `Adjusted Carry (${unit})`,
    "Dispersion (m)",
    "Timestamp",
  ];
  const rows = shots.map((s, i) => [
    i + 1,
    s.club,
    s.carry_raw,
    s.carry_adjusted,
    s.dispersion_m,
    s.created_at ? new Date(s.created_at).toLocaleString() : "",
  ]);

  const escape = (v: string | number) => {
    const str = String(v);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csv = [
    ...meta,
    header.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${sessionId}_shots_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success("CSV downloaded");
}
