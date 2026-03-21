"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Loader2, Mountain, MapPin, LocateFixed, Plus, Trash2, Star, Briefcase, Map } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  type DistanceUnit,
  type TemperatureUnit,
  type WindUnit,
  type RangeLocation,
  DEFAULT_SETTINGS,
  getDeviceId,
  fetchSettings,
  saveSettings,
} from "@/lib/supabase";

// ── Zod schema ───────────────────────────────────────────────────────
const settingsSchema = z.object({
  distance_unit: z.enum(["yards", "meters"]),
  temperature_unit: z.enum(["celsius", "fahrenheit"]),
  wind_unit: z.enum(["kmh", "mph"]),
  altitude_adjustment: z.boolean().default(true),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ── Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      distance_unit: DEFAULT_SETTINGS.distance_unit,
      temperature_unit: DEFAULT_SETTINGS.temperature_unit,
      wind_unit: DEFAULT_SETTINGS.wind_unit,
      altitude_adjustment: DEFAULT_SETTINGS.altitude_adjustment ?? true,
    },
  });

  // Range locations managed separately from react-hook-form
  const [locations, setLocations] = useState<RangeLocation[]>([]);
  const [mapType, setMapTypeState] = useState<string>(() => {
    if (typeof window === "undefined") return "satellite";
    return localStorage.getItem("golf_map_type") ?? "satellite";
  });

  function setMapType(value: string) {
    setMapTypeState(value);
    localStorage.setItem("golf_map_type", value);
  }

  function addLocation() {
    setLocations((prev) => [
      ...prev,
      { name: "", lat: 0, lng: 0, orientation: 0, elevation: null, is_default: prev.length === 0 },
    ]);
  }

  function removeLocation(idx: number) {
    setLocations((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // If we removed the default, make the first one default
      if (next.length > 0 && !next.some((l) => l.is_default)) {
        next[0].is_default = true;
      }
      return next;
    });
  }

  function updateLocation(idx: number, patch: Partial<RangeLocation>) {
    setLocations((prev) =>
      prev.map((loc, i) => {
        if (i !== idx) {
          // If we're setting a new default, unset others
          if (patch.is_default) return { ...loc, is_default: false };
          return loc;
        }
        return { ...loc, ...patch };
      })
    );
  }

  function geoFillLocation(idx: number) {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(idx, {
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
        });
        toast.success("Location detected");
      },
      () => toast.error("Could not get location")
    );
  }

  // Load settings on mount
// Load settings on mount
useEffect(() => {
  async function load() {
    try {
      const deviceId = getDeviceId();
      console.log("Settings load - deviceId:", deviceId);

      const data = await fetchSettings(deviceId);
      console.log("Settings fetch result:", data); // ← this will tell us if row is found

      if (data) {
        console.log("Applying saved settings to form:", {
          distance_unit: data.distance_unit,
          temperature_unit: data.temperature_unit,
          wind_unit: data.wind_unit,
        });
        form.reset({
          distance_unit: data.distance_unit,
          temperature_unit: data.temperature_unit,
          wind_unit: data.wind_unit,
          altitude_adjustment: data.altitude_adjustment ?? true,
        });
        setLocations(data.range_locations ?? []);
      } else {
        console.log("No saved settings found — using defaults");
      }
    } catch (err) {
      console.error("Unexpected error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }

  load();
}, [form]); // dependency on form is fine if form is stable

  // Save handler
  async function onSubmit(values: SettingsFormValues) {
  setSaving(true);
  try {
    const deviceId = getDeviceId();
    // Filter out locations with empty names before saving
    const validLocations = locations.filter((l) => l.name.trim() !== "");
    const ok = await saveSettings(deviceId, { ...values, range_locations: validLocations });
    if (ok) {
      toast.success("Settings saved");
      // Optional: immediate re-fetch to confirm
      const updated = await fetchSettings(deviceId);
      if (updated) {
        form.reset({
          distance_unit: updated.distance_unit,
          temperature_unit: updated.temperature_unit,
          wind_unit: updated.wind_unit,
          altitude_adjustment: updated.altitude_adjustment ?? true,
        });
        setLocations(updated.range_locations ?? []);
      }
    } else {
      toast.error("Failed to save settings");
    }
  } catch {
    toast.error("An error occurred");
  } finally {
    setSaving(false);
  }
}

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-3 pt-5 md:space-y-6 md:p-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Settings</h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Choose your preferred units
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        {/* Units — compact row-based cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Distance</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RadioGroup
              value={form.watch("distance_unit")}
              onValueChange={(v) =>
                form.setValue("distance_unit", v as DistanceUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yards" id="distance-yards" />
                <Label htmlFor="distance-yards" className="cursor-pointer text-sm">
                  Yards
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="meters" id="distance-meters" />
                <Label htmlFor="distance-meters" className="cursor-pointer text-sm">
                  Meters
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Temperature</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RadioGroup
              value={form.watch("temperature_unit")}
              onValueChange={(v) =>
                form.setValue("temperature_unit", v as TemperatureUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fahrenheit" id="temp-f" />
                <Label htmlFor="temp-f" className="cursor-pointer text-sm">
                  °F
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="celsius" id="temp-c" />
                <Label htmlFor="temp-c" className="cursor-pointer text-sm">
                  °C
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Wind Speed</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RadioGroup
              value={form.watch("wind_unit")}
              onValueChange={(v) =>
                form.setValue("wind_unit", v as WindUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mph" id="wind-mph" />
                <Label htmlFor="wind-mph" className="cursor-pointer text-sm">
                  mph
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kmh" id="wind-kmh" />
                <Label htmlFor="wind-kmh" className="cursor-pointer text-sm">
                  km/h
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Altitude Adjustment */}
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Mountain className="h-4 w-4 text-primary" />
              <Label htmlFor="altitude-adj" className="cursor-pointer text-sm font-medium">
                Altitude adjustment
              </Label>
            </div>
            <Switch
              id="altitude-adj"
              checked={form.watch("altitude_adjustment")}
              onCheckedChange={(v) => form.setValue("altitude_adjustment", v, { shouldDirty: true })}
            />
          </CardContent>
        </Card>

        {/* Map View */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Map className="h-4 w-4 text-primary" />
              Map View
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <RadioGroup
              value={mapType}
              onValueChange={setMapType}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="roadmap" id="map-road" />
                <Label htmlFor="map-road" className="cursor-pointer text-sm">
                  Map
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="satellite" id="map-sat" />
                <Label htmlFor="map-sat" className="cursor-pointer text-sm">
                  Satellite
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hybrid" id="map-hybrid" />
                <Label htmlFor="map-hybrid" className="cursor-pointer text-sm">
                  Hybrid
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* My Bag link */}
        <Link href="/my-bag">
          <Card className="cursor-pointer transition-colors hover:border-primary/40">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Edit My Bag</span>
              </div>
              <span className="text-xs text-muted-foreground">Club selection →</span>
            </CardContent>
          </Card>
        </Link>

        {/* Favorite Range Locations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Range Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No locations yet — add one below.
              </p>
            )}

            {locations.map((loc, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    placeholder="Location name"
                    value={loc.name}
                    onChange={(e) => updateLocation(idx, { name: e.target.value })}
                    className="h-9 text-sm font-medium"
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Set as default"
                      className={`rounded-md p-1.5 transition-colors ${
                        loc.is_default
                          ? "text-yellow-500"
                          : "text-muted-foreground hover:text-yellow-500"
                      }`}
                      onClick={() => updateLocation(idx, { is_default: true })}
                    >
                      <Star className={`h-4 w-4 ${loc.is_default ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove location"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeLocation(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="33.5"
                      value={loc.lat || ""}
                      onChange={(e) =>
                        updateLocation(idx, { lat: e.target.value === "" ? 0 : +e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="-111.9"
                      value={loc.lng || ""}
                      onChange={(e) =>
                        updateLocation(idx, { lng: e.target.value === "" ? 0 : +e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Orientation (0–360°)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={360}
                      step={1}
                      placeholder="180"
                      value={loc.orientation || ""}
                      onChange={(e) =>
                        updateLocation(idx, { orientation: e.target.value === "" ? 0 : +e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">
                      Elevation ({form.watch("distance_unit") === "meters" ? "m" : "ft"})
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Optional"
                      value={loc.elevation ?? ""}
                      onChange={(e) =>
                        updateLocation(idx, {
                          elevation: e.target.value === "" ? null : +e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-[11px]"
                  onClick={() => geoFillLocation(idx)}
                >
                  <LocateFixed className="mr-1 h-3 w-3" />
                  Use Current Location
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={addLocation}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Location
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
