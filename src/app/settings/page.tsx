"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Loader2, Club, Mountain } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ClubTagInput } from "@/components/ui/club-tag-input";
import { Switch } from "@/components/ui/switch";
import {
  type DistanceUnit,
  type TemperatureUnit,
  type WindUnit,
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
  clubset: z.array(z.string()).default([]),
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
      clubset: DEFAULT_SETTINGS.clubset ?? [],
      altitude_adjustment: DEFAULT_SETTINGS.altitude_adjustment ?? true,
    },
  });

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
          clubset: data.clubset ?? [],
          altitude_adjustment: data.altitude_adjustment ?? true,
        });
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
    const ok = await saveSettings(deviceId, values);  // ← FIXED: string first, then values object
    if (ok) {
      toast.success("Settings saved");
      // Optional: immediate re-fetch to confirm
      const updated = await fetchSettings(deviceId);
      if (updated) {
        form.reset({
          distance_unit: updated.distance_unit,
          temperature_unit: updated.temperature_unit,
          wind_unit: updated.wind_unit,
          clubset: updated.clubset ?? [],
          altitude_adjustment: updated.altitude_adjustment ?? true,
        });
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
    <div className="mx-auto max-w-lg space-y-6 p-4 pt-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose your preferred units
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Distance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distance</CardTitle>
            <CardDescription>
              How distances are displayed on the course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form.watch("distance_unit")}
              onValueChange={(v) =>
                form.setValue("distance_unit", v as DistanceUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yards" id="distance-yards" />
                <Label htmlFor="distance-yards" className="cursor-pointer">
                  Yards
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="meters" id="distance-meters" />
                <Label htmlFor="distance-meters" className="cursor-pointer">
                  Meters
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Temperature */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Temperature</CardTitle>
            <CardDescription>
              Unit for weather temperature readings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form.watch("temperature_unit")}
              onValueChange={(v) =>
                form.setValue("temperature_unit", v as TemperatureUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fahrenheit" id="temp-f" />
                <Label htmlFor="temp-f" className="cursor-pointer">
                  °F
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="celsius" id="temp-c" />
                <Label htmlFor="temp-c" className="cursor-pointer">
                  °C
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Wind */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wind Speed</CardTitle>
            <CardDescription>Unit for wind speed readings</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form.watch("wind_unit")}
              onValueChange={(v) =>
                form.setValue("wind_unit", v as WindUnit)
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mph" id="wind-mph" />
                <Label htmlFor="wind-mph" className="cursor-pointer">
                  mph
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kmh" id="wind-kmh" />
                <Label htmlFor="wind-kmh" className="cursor-pointer">
                  km/h
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Altitude Adjustment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mountain className="h-4 w-4 text-primary" />
              Altitude Adjustment
            </CardTitle>
            <CardDescription>
              Adjust carry distances for elevation (approx +1.2% per 1,000 ft)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="altitude-adj" className="cursor-pointer">
                Enable altitude adjustment
              </Label>
              <Switch
                id="altitude-adj"
                checked={form.watch("altitude_adjustment")}
                onCheckedChange={(v) => form.setValue("altitude_adjustment", v, { shouldDirty: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Club Set */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Club className="h-4 w-4 text-primary" />
              Club Set
            </CardTitle>
            <CardDescription>
              Your bag — used for club selection on the range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClubTagInput
              value={form.watch("clubset") ?? []}
              onChange={(clubs) => form.setValue("clubset", clubs, { shouldDirty: true })}
            />
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
