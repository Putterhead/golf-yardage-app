"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Wind,
  Thermometer,
  Droplets,
  Plus,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { type Session, fetchSessions, getDeviceId } from "@/lib/supabase";

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const deviceId = getDeviceId();
      const data = await fetchSessions(deviceId);
      setSessions(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Target className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Golf Yardage</h1>
          <p className="text-sm text-muted-foreground">
            Your on-course distance companion
          </p>
        </div>
      </header>

      {/* Start Session CTA */}
      <Link href="/sessions/new">
        <Button size="lg" className="w-full text-base">
          <Plus className="mr-2 h-5 w-5" />
          Start New Range Session
        </Button>
      </Link>

      {/* Past Sessions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Past Sessions
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="flex min-h-[180px] items-center justify-center">
            <CardContent className="text-center">
              <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No sessions yet. Start your first range session!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}/range`}
              >
                <Card className="transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        <Clock className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString(
                              undefined,
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              }
                            )
                          : "Unknown date"}
                      </CardTitle>
                    </div>
                    <CardDescription className="flex flex-wrap gap-3 pt-1 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="h-3 w-3" />
                        {s.temperature}°
                        {s.temperature_unit === "celsius" ? "C" : "F"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Wind className="h-3 w-3" />
                        {s.wind_speed}{" "}
                        {s.wind_unit === "kmh" ? "km/h" : "mph"}{" "}
                        {s.wind_direction}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        {s.humidity}%
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
