"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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
import { createSession, WIND_DIRECTIONS } from "@/lib/supabase";

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

  const tempLabel =
    settings.temperature_unit === "celsius" ? "°C" : "°F";
  const windLabel = settings.wind_unit === "kmh" ? "km/h" : "mph";
  const distLabel = settings.distance_unit === "yards" ? "yd" : "m";

  async function onSubmit(values: SessionFormValues) {
    setSubmitting(true);
    try {
      const sessionId = await createSession({
        device_id: deviceId,
        temperature: values.temperature,
        temperature_unit: settings.temperature_unit,
        humidity: values.humidity,
        wind_speed: values.wind_speed,
        wind_unit: settings.wind_unit,
        wind_direction: values.wind_direction,
        elevation: values.elevation,
        distance_unit: settings.distance_unit,
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
    <div className="mx-auto max-w-lg space-y-6 p-4 pt-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          New Range Session
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter current conditions before you start hitting
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Temperature */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conditions</CardTitle>
            <CardDescription>Weather at the range right now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature ({tempLabel})</Label>
              <Input
                id="temperature"
                type="number"
                inputMode="decimal"
                className="h-12 text-lg"
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
              <Label htmlFor="humidity">Humidity (%)</Label>
              <Input
                id="humidity"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                className="h-12 text-lg"
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
              <Label htmlFor="wind_speed">Wind Speed ({windLabel})</Label>
              <Input
                id="wind_speed"
                type="number"
                inputMode="decimal"
                min={0}
                className="h-12 text-lg"
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
              <Label>Wind Direction</Label>
              <Select
                value={form.watch("wind_direction")}
                onValueChange={(v) => form.setValue("wind_direction", v)}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {WIND_DIRECTIONS.map((dir) => (
                    <SelectItem key={dir} value={dir} className="text-base">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Elevation</CardTitle>
            <CardDescription>
              Altitude of the range ({distLabel})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              id="elevation"
              type="number"
              inputMode="decimal"
              className="h-12 text-lg"
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
