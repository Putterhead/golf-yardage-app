"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Wind,
  Thermometer,
  Droplets,
  Loader2,
  Clock,
  Mountain,
  Eye,
  Crosshair,
  Trash2,
  ArrowLeft,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  type Session,
  fetchSessions,
  fetchShotCounts,
  deleteSession,
  getDeviceId,
} from "@/lib/supabase";
import { exportSessionCSV } from "@/lib/export-csv";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [shotCounts, setShotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const deviceId = getDeviceId();
    const data = await fetchSessions(deviceId);
    setSessions(data);

    const ids = data.map((s) => s.id).filter(Boolean) as string[];
    const counts = await fetchShotCounts(ids);
    setShotCounts(counts);

    setLoading(false);
  }

  async function handleDelete(sessionId: string) {
    setDeletingId(sessionId);
    const ok = await deleteSession(sessionId);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShotCounts((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      toast.success("Session deleted");
    } else {
      toast.error("Failed to delete session");
    }
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 pb-24 md:p-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Sessions</h1>
          <p className="text-sm text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="flex min-h-[180px] items-center justify-center">
          <CardContent className="text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No range sessions yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => {
            const count = s.id ? shotCounts[s.id] ?? 0 : 0;
            const distLabel = s.distance_unit === "meters" ? "m" : "ft";
            const tempLabel = s.temperature_unit === "celsius" ? "C" : "F";
            const windLabel = s.wind_unit === "kmh" ? "km/h" : "mph";

            return (
              <Card
                key={s.id}
                className="flex flex-col justify-between transition-colors hover:border-primary/40"
              >
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
                  {/* Conditions badges */}
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

                  {/* Action buttons */}
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
                        disabled={exportingId === s.id}
                        onClick={async () => {
                          if (!s.id) return;
                          setExportingId(s.id);
                          await exportSessionCSV(s);
                          setExportingId(null);
                        }}
                      >
                        {exportingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the session and all {count} shot{count !== 1 ? "s" : ""} recorded in it. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => s.id && handleDelete(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
