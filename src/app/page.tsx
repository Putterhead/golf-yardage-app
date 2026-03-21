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
  Mountain,
  Eye,
  Crosshair,
  BarChart3,
  List,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type Session,
  fetchSessions,
  fetchShotCounts,
  getDeviceId,
} from "@/lib/supabase";
import { exportSessionCSV } from "@/lib/export-csv";

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [shotCounts, setShotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      const deviceId = getDeviceId();
      const data = await fetchSessions(deviceId);
      setSessions(data);

      // Fetch shot counts for all sessions
      const ids = data.map((s) => s.id).filter(Boolean) as string[];
      const counts = await fetchShotCounts(ids);
      setShotCounts(counts);

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 pb-24 md:p-8">
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

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/sessions/new" className="flex-1">
          <Button size="lg" className="w-full text-base">
            <Plus className="mr-2 h-5 w-5" />
            Start New Range Session
          </Button>
        </Link>
        <Link href="/summary" className="flex-1">
          <Button size="lg" variant="outline" className="w-full text-base">
            <BarChart3 className="mr-2 h-5 w-5" />
            View Club Stats
          </Button>
        </Link>
      </div>

      {/* Latest Range Session */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Latest Range Session
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
                No range sessions yet — start one above!
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {(() => {
              const s = sessions[0];
              const count = s.id ? shotCounts[s.id] ?? 0 : 0;
              const distLabel = s.distance_unit === "meters" ? "m" : "ft";
              const tempLabel = s.temperature_unit === "celsius" ? "C" : "F";
              const windLabel = s.wind_unit === "kmh" ? "km/h" : "mph";

              return (
                <Card className="flex flex-col justify-between transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium leading-snug">
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
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        <Crosshair className="mr-1 h-3 w-3" />
                        {count} shot{count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                        <Thermometer className="h-3 w-3" />
                        {s.temperature}°{tempLabel}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                        <Droplets className="h-3 w-3" />
                        {s.humidity}%
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                        <Wind className="h-3 w-3" />
                        {s.wind_speed} {windLabel} {s.wind_direction}
                      </Badge>
                      {s.elevation > 0 && (
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                          <Mountain className="h-3 w-3" />
                          {s.elevation} {distLabel}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/sessions/${s.id}/range`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {count > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exporting}
                          onClick={async () => {
                            setExporting(true);
                            await exportSessionCSV(s);
                            setExporting(false);
                          }}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          CSV
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {sessions.length > 1 && (
              <Link href="/sessions" className="mt-3 block">
                <Button variant="outline" className="w-full">
                  <List className="mr-2 h-4 w-4" />
                  View All Sessions ({sessions.length})
                </Button>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
