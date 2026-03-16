import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Regular client (can be used for reads/authenticated operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Anon-only client (forces anon role, disables session persistence)
export const anonSupabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

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
  clubset?: string[];
  altitude_adjustment?: boolean;
  updated_at?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Get or create a stable device ID stored in localStorage */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem("golf_device_id");
  console.log("getDeviceId - from localStorage:", id);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("golf_device_id", id);
    console.log("getDeviceId - generated new ID:", id);
  }

  console.log("getDeviceId - returning:", id);
  return id;
}

/** Default club suggestions shown in the settings tag input */
export const CLUB_SUGGESTIONS = [
  "Driver", "3-Wood", "5-Wood", "7-Wood",
  "3-Iron", "4-Iron", "5-Iron", "6-Iron", "7-Iron", "8-Iron", "9-Iron",
  "PW", "GW", "SW", "LW",
  "50°", "52°", "54°", "56°", "58°", "60°",
] as const;

/** Fallback clubs when user has no custom clubset */
export const FALLBACK_CLUBS = [
  "Driver", "3-Wood", "5-Wood", "7-Iron", "9-Iron", "PW", "50°", "54°", "58°",
];

/** Default settings */
export const DEFAULT_SETTINGS: Omit<UserSettings, "device_id"> = {
  distance_unit: "yards",
  temperature_unit: "fahrenheit",
  wind_unit: "mph",
  clubset: [],
  altitude_adjustment: true,
};

/** Fetch settings for the current device */
export async function fetchSettings(
  deviceId: string
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) {
    // Log only genuine errors (network, auth, permissions, etc.)
    console.error("Error fetching settings:", error);
    return null;
  }

  return data as UserSettings | null;
}

/** Upsert settings for the current device using anon-only client */
export async function saveSettings(deviceId: string, settings: Partial<UserSettings>): Promise<boolean> {
  if (!deviceId) {
    console.error("No deviceId provided for saveSettings");
    return false;
  }

  const payload = {
    device_id: deviceId,  // ensure it's a string
    ...settings
  };

  console.log("Saving settings with payload:", payload);

  const { error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "device_id" });

  if (error) {
    console.error("SAVE ERROR - full details:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      status: (error as unknown as Record<string, unknown>).status,
      rawError: error
    });
    return false;
  }

  console.log("Settings saved successfully");
  return true;
}

// ── Session & Shot Types ─────────────────────────────────────────────

export interface Session {
  id?: string;
  device_id: string;
  temperature: number;
  temperature_unit: TemperatureUnit;
  humidity: number;
  wind_speed: number;
  wind_unit: WindUnit;
  wind_direction: string;
  elevation: number;
  distance_unit: DistanceUnit;
  created_at?: string;
}

export interface Shot {
  id?: string;
  session_id: string;
  club: string;
  carry_raw: number;
  carry_adjusted: number;
  dispersion_m: number;
  lat_lng: {
    tee: { lat: number; lng: number };
    target: { lat: number; lng: number };
    landing: { lat: number; lng: number };
  };
  created_at?: string;
}

// ── Club list ────────────────────────────────────────────────────────

export const CLUBS = [
  "Driver",
  "3-Wood",
  "5-Wood",
  "3-Hybrid",
  "4-Iron",
  "5-Iron",
  "6-Iron",
  "7-Iron",
  "8-Iron",
  "9-Iron",
  "PW",
  "GW",
  "SW",
  "LW",
] as const;

export type Club = (typeof CLUBS)[number];

// ── Wind directions ──────────────────────────────────────────────────

export const WIND_DIRECTIONS = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW",
] as const;

// ── Session CRUD ─────────────────────────────────────────────────────

export async function createSession(session: Omit<Session, "id" | "created_at">): Promise<string | null> {
  const { data, error } = await supabase
    .from("sessions")
    .insert(session)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating session:", error);
    return null;
  }
  return data?.id ?? null;
}

export async function fetchSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }
  return data as Session;
}

export async function fetchSessions(deviceId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
  return (data as Session[]) ?? [];
}

// ── Shot CRUD ────────────────────────────────────────────────────────

export async function createShot(shot: Omit<Shot, "id" | "created_at">): Promise<Shot | null> {
  const { data, error } = await supabase
    .from("shots")
    .insert(shot)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating shot:", error);
    return null;
  }
  return data as Shot;
}

export async function fetchShots(sessionId: string): Promise<Shot[]> {
  const { data, error } = await supabase
    .from("shots")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching shots:", error);
    return [];
  }
  return (data as Shot[]) ?? [];
}

export async function deleteShot(shotId: string): Promise<boolean> {
  const { error } = await supabase
    .from("shots")
    .delete()
    .eq("id", shotId);

  if (error) {
    console.error("Error deleting shot:", error);
    return false;
  }
  return true;
}
