import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ────────────────────────────────────────────────────────────
export type DistanceUnit = "yards" | "meters";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindUnit = "kmh" | "mph";

export interface UserSettings {
  id?: string;
  device_id: string;
  distance_unit: DistanceUnit;
  temperature_unit: TemperatureUnit;
  wind_unit: WindUnit;
  updated_at?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Get or create a stable device ID stored in localStorage */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("golf_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("golf_device_id", id);
  }
  return id;
}

/** Default settings */
export const DEFAULT_SETTINGS: Omit<UserSettings, "device_id"> = {
  distance_unit: "yards",
  temperature_unit: "fahrenheit",
  wind_unit: "mph",
};

/** Fetch settings for the current device */
export async function fetchSettings(
  deviceId: string
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching settings:", error);
  }
  return data as UserSettings | null;
}

/** Upsert settings for the current device */
export async function saveSettings(settings: UserSettings): Promise<boolean> {
  const { error } = await supabase.from("user_settings").upsert(
    {
      device_id: settings.device_id,
      distance_unit: settings.distance_unit,
      temperature_unit: settings.temperature_unit,
      wind_unit: settings.wind_unit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" }
  );

  if (error) {
    console.error("Error saving settings:", error);
    return false;
  }
  return true;
}
