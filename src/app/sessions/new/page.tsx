"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Play, MapPin, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import { createSession, fetchLatestSession, WIND_DIRECTIONS } from "@/lib/supabase";

// ── Schema ───────────────────────────────────────────────────────────
const sessionSchema = z.object({
  temperature: z.coerce.number({ required_error: "Required" }),
  humidity: z.coerce.number().min(0).max(100),
  wind_speed: z.coerce.number().min(0),
  wind_direction: z.string().min(1, "Pick a direction"),
  elevation: z.coerce.number(),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

// ── Page ─────────────────────────────────────────────────────────────
export default function NewSessionPage() {
  const router = useRouter();
  const { settings, loading: settingsLoading, deviceId } = useSettings();
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const didFetchSession = useRef(false);

  // Track manual user interaction — undefined means "use auto-default"
  const [userPickedValue, setUserPickedValue] = useState<string | undefined>(undefined);

  const rangeLocations = (settings?.range_locations ?? []).filter((l) => l.name.trim() !== "");

  // Derive auto-default synchronously (no useEffect needed)
  const autoDefault = rangeLocations.find((l) => l.is_default) ?? rangeLocations[0] ?? null;
  const selectValue = userPickedValue ?? autoDefault?.name ?? "__none__";

  // Derive location object from current value
  const selectedLocation = selectValue !== "__none__"
    ? rangeLocations.find((l) => l.name === selectValue) ?? null
    : null;

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      temperature: 72,
      humidity: 50,
      wind_speed: 0,
      wind_direction: "N",
      elevation: 0,
    },
  });

  // Auto-fill elevation when auto-default first resolves
  useEffect(() => {
    if (autoDefault?.elevation != null && userPickedValue === undefined) {
      form.setValue("elevation", autoDefault.elevation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDefault?.name]);

  // Pre-fill from latest session (once)
  useEffect(() => {
    if (settingsLoading || !deviceId || didFetchSession.current) return;
    didFetchSession.current = true;

    (async () => {
      const latest = await fetchLatestSession(deviceId);
      if (latest) {
        form.reset({
          temperature: latest.temperature,
          humidity: latest.humidity,
          wind_speed: latest.wind_speed,
          wind_direction: latest.wind_direction,
          elevation: autoDefault?.elevation ?? latest.elevation,
        });
        setPrefilled(true);
        toast.info("Loaded from your last session");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading, deviceId]);

  const tempLabel =
    settings?.temperature_unit === "celsius" ? "°C" : "°F";
  const windLabel = settings?.wind_unit === "kmh" ? "km/h" : "mph";
  const distLabel = settings?.distance_unit === "yards" ? "yd" : "m";

  async function onSubmit(values: SessionFormValues) {
    setSubmitting(true);
    try {
      const sessionId = await createSession({
        device_id: deviceId,
        temperature: values.temperature,
        temperature_unit: settings?.temperature_unit,
        humidity: values.humidity,
        wind_speed: values.wind_speed,
        wind_unit: settings?.wind_unit,
        wind_direction: values.wind_direction,
        elevation: values.elevation,
        distance_unit: settings?.distance_unit,
        location_name: selectedLocation?.name ?? null,
        location_lat: selectedLocation?.lat ?? null,
        location_lng: selectedLocation?.lng ?? null,
      });

      if (sessionId) {
        toast.success("Session started");
        router.push(`/sessions/${sessionId}/range`);
      } else {
        toast.error("Failed to create session");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-3 pt-5 md:space-y-6 md:p-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          New Range Session
        </h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Enter current conditions before you start hitting
        </p>
      </header>

      {prefilled && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pre-filled from your default location and most recent session — edit as needed.</span>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 md:space-y-4">
        {/* Range Location */}
        {rangeLocations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Range Location
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <Select
                value={selectValue}
                onValueChange={(v) => {
                  setUserPickedValue(v);
                  if (v === "__none__") {
                    form.setValue("elevation", 0);
                    return;
                  }
                  const loc = rangeLocations.find((l) => l.name === v);
                  if (loc?.elevation != null) {
                    form.setValue("elevation", loc.elevation);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    No location selected
                  </SelectItem>

                  {rangeLocations.map((loc) => (
                    <SelectItem
                      key={loc.name}
                      value={loc.name}
                      className={loc.is_default ? "font-semibold" : ""}
                    >
                      {loc.is_default ? `⭐ ${loc.name} (Default)` : loc.name}
                      {loc.elevation != null ? ` · ${loc.elevation} ${settings?.distance_unit === "meters" ? "m" : "ft"}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Conditions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="temperature" className="text-sm">Temperature ({tempLabel})</Label>
              <Input
                id="temperature"
                type="number"
                inputMode="decimal"
                className="h-10 text-base"
                {...form.register("temperature")}
              />
              {form.formState.errors.temperature && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.temperature.message}
                </p>
              )}
            </div>

            {/* Humidity */}
            <div className="space-y-2">
              <Label htmlFor="humidity" className="text-sm">Humidity (%)</Label>
              <Input
                id="humidity"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                className="h-10 text-base"
                {...form.register("humidity")}
              />
              {form.formState.errors.humidity && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.humidity.message}
                </p>
              )}
            </div>

            {/* Wind Speed */}
            <div className="space-y-2">
              <Label htmlFor="wind_speed" className="text-sm">Wind Speed ({windLabel})</Label>
              <Input
                id="wind_speed"
                type="number"
                inputMode="decimal"
                min={0}
                className="h-10 text-base"
                {...form.register("wind_speed")}
              />
              {form.formState.errors.wind_speed && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.wind_speed.message}
                </p>
              )}
            </div>

            {/* Wind Direction */}
            <div className="space-y-2">
              <Label className="text-sm">Wind Direction</Label>
              <Select
                value={form.watch("wind_direction")}
                onValueChange={(v) => form.setValue("wind_direction", v)}
              >
                <SelectTrigger className="h-10 text-base">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {WIND_DIRECTIONS.map((dir) => (
                    <SelectItem key={dir} value={dir} className="text-sm">
                      {dir}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.wind_direction && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.wind_direction.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Elevation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Elevation ({distLabel})</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <Input
              id="elevation"
              type="number"
              inputMode="decimal"
              className="h-10 text-base"
              {...form.register("elevation")}
            />
            {form.formState.errors.elevation && (
              <p className="text-xs text-destructive">
                {form.formState.errors.elevation.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          className="w-full text-base"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Play className="mr-2 h-5 w-5" />
          )}
          Start Session
        </Button>
      </form>
    </div>
  );
}