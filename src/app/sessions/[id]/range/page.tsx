"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
} from "@react-google-maps/api";
import {
  Loader2,
  Plus,
  Square,
  Target,
  MapPin,
  Flag,
  CircleDot,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  type Shot,
  FALLBACK_CLUBS,
  fetchSession,
  fetchShots,
  createShot,
  deleteShot,
} from "@/lib/supabase";
import { useSettings } from "@/hooks/use-settings";
import {
  type LatLng,
  haversineMeters,
  metersToUnit,
  dispersionMeters,
  adjustedCarry,
} from "@/lib/geo";

// ── Types ────────────────────────────────────────────────────────────

type PlacementMode = "tee" | "target" | "landing" | "idle";

const MAP_CONTAINER: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

const DRAG_THROTTLE_MS = 50; // ~20fps cap for smooth mobile drag

// Stable Polyline options (defined outside component to avoid re-creation)
const POLYLINE_TEE_TARGET: google.maps.PolylineOptions = {
  strokeColor: "#ffffff",
  strokeOpacity: 0,
  strokeWeight: 2,
  geodesic: true,
  icons: [
    {
      icon: { path: "M 0,-1 0,1", strokeOpacity: 0.6, scale: 3 },
      offset: "0",
      repeat: "12px",
    },
  ],
};

const POLYLINE_PREVIEW: google.maps.PolylineOptions = {
  strokeColor: "#22c55e",
  strokeOpacity: 0.9,
  strokeWeight: 3,
  geodesic: true,
};


const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1b3a1b" }],
  },
];

// ── Component ────────────────────────────────────────────────────────

export default function RangePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  // Data
  const [session, setSession] = useState<Session | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);

  // Dynamic club list from settings
  const { settings, loading: settingsLoading } = useSettings();
  const clubList = useMemo(() => {
    const cs = settings.clubset;
    if (cs && cs.length > 0) return cs;
    return FALLBACK_CLUBS;
  }, [settings.clubset]);

  // Show toast once if using fallback
  const [fallbackNotified, setFallbackNotified] = useState(false);
  useEffect(() => {
    if (!settingsLoading && (!settings.clubset || settings.clubset.length === 0) && !fallbackNotified) {
      toast.info("No custom clubs set \u2014 using defaults");
      setFallbackNotified(true);
    }
  }, [settingsLoading, settings.clubset, fallbackNotified]);

  // Map state
  const [tee, setTee] = useState<LatLng | null>(null);
  const [target, setTarget] = useState<LatLng | null>(null);
  const [landing, setLanding] = useState<LatLng | null>(null);
  const [mode, setMode] = useState<PlacementMode>("idle");
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [center, setCenter] = useState<LatLng>({ lat: 33.5, lng: -111.9 });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mapType] = useState<string>(() => {
    if (typeof window === "undefined") return "satellite";
    return localStorage.getItem("golf_map_type") ?? "satellite";
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const lastDragTs = useRef(0);
  const teeTargetLineRef = useRef<google.maps.Polyline | null>(null);
  const previewLineRef = useRef<google.maps.Polyline | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setMapTypeId(mapType);
  }, [mapType]);

  // ── Native polyline: Tee → Target (white dashed) ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (tee && target && map) {
      if (!teeTargetLineRef.current) {
        teeTargetLineRef.current = new google.maps.Polyline({
          ...POLYLINE_TEE_TARGET,
          map,
        });
      }
      teeTargetLineRef.current.setPath([tee, target]);
    } else if (teeTargetLineRef.current) {
      teeTargetLineRef.current.setMap(null);
      teeTargetLineRef.current = null;
    }
  }, [tee, target]);

  // ── Native polyline: Tee → Landing preview (green solid) ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (tee && landing && map) {
      if (!previewLineRef.current) {
        previewLineRef.current = new google.maps.Polyline({
          ...POLYLINE_PREVIEW,
          map,
        });
      }
      previewLineRef.current.setPath([tee, landing]);
    } else if (previewLineRef.current) {
      previewLineRef.current.setMap(null);
      previewLineRef.current = null;
    }
  }, [tee, landing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teeTargetLineRef.current?.setMap(null);
      previewLineRef.current?.setMap(null);
    };
  }, []);

  // Set default selected club once clubList is resolved
  useEffect(() => {
    if (clubList.length > 0 && !selectedClub) {
      setSelectedClub(clubList[0]);
    }
  }, [clubList, selectedClub]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  // ── Load session + shots ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [s, sh] = await Promise.all([
        fetchSession(sessionId),
        fetchShots(sessionId),
      ]);
      setSession(s);
      setShots(sh);
      setLoadingSession(false);
    }
    load();
  }, [sessionId]);

  // ── Center map: session location → default range location → browser geolocation
  useEffect(() => {
    // 1. Session has a stored location
    if (session?.location_lat != null && session?.location_lng != null) {
      setCenter({ lat: session.location_lat, lng: session.location_lng });
      return;
    }
    // 2. Default range location from settings
    const defaultLoc = (settings.range_locations ?? []).find((l) => l.is_default);
    if (defaultLoc) {
      setCenter({ lat: defaultLoc.lat, lng: defaultLoc.lng });
      return;
    }
    // 3. Browser geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // ignore error, keep default center
      );
    }
  }, [session, settings.range_locations]);

  // ── Map click handler ──────────────────────────────────────────────
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const pt: LatLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };

      if (mode === "tee") {
        setTee(pt);
        setTarget(null);
        setLanding(null);
        setMode("idle");
        toast.info("Tee placed. Now set Target.");
      } else if (mode === "target") {
        setTarget(pt);
        setLanding(null);
        setMode("idle");
        console.log("Target pin placed");
        toast.info("Target placed. Hit a shot, then tap Landing.");
      } else if (mode === "landing") {
        setLanding(pt);
        setMode("idle");
        console.log("Landing pin placed");
      }
    },
    [mode]
  );

  // ── Shot calculation ───────────────────────────────────────────────
  const altEnabled = settings.altitude_adjustment !== false;
  const shotPreview = useMemo(() => {
    if (!tee || !landing || !session) return null;

    const rawM = haversineMeters(tee, landing);
    const shouldAdjust = altEnabled && session.elevation > 0;
    const adjM = shouldAdjust
      ? adjustedCarry(rawM, session.elevation, session.distance_unit)
      : rawM;
    const dispM = target ? dispersionMeters(tee, target, landing) : 0;

    const unit = session.distance_unit;
    return {
      rawCarry: metersToUnit(rawM, unit),
      adjustedCarry: metersToUnit(adjM, unit),
      dispersionM: dispM,
      rawM,
      adjM,
      unit,
    };
  }, [tee, target, landing, session, altEnabled]);

  // ── Save shot ──────────────────────────────────────────────────────
  async function handleSaveShot() {
    if (!tee || !landing || !shotPreview || !session) return;
    setSaving(true);

    const shot = await createShot({
      session_id: sessionId,
      club: selectedClub,
      carry_raw: +shotPreview.rawCarry.toFixed(1),
      carry_adjusted: +shotPreview.adjustedCarry.toFixed(1),
      dispersion_m: +shotPreview.dispersionM.toFixed(1),
      lat_lng: {
        tee,
        target: target ?? tee,
        landing,
      },
    });

    if (shot) {
      setShots((prev) => [...prev, shot]);
      setLanding(null);
      console.log("Shot saved — clearing preview");
      toast.success(`${selectedClub}: ${shotPreview.adjustedCarry.toFixed(0)} ${shotPreview.unit}`);
    } else {
      toast.error("Failed to save shot");
    }
    setSaving(false);
  }

  // ── Delete shot (optimistic) ──────────────────────────────────────
  async function handleDeleteShot(shotId: string) {
    const prev = shots;
    setShots((s) => s.filter((sh) => sh.id !== shotId));
    setDeletingId(shotId);

    const ok = await deleteShot(shotId);
    if (ok) {
      const updated = await fetchShots(sessionId);
      setShots(updated);
      toast.success("Shot deleted successfully");
    } else {
      setShots(prev);
      toast.error("Failed to delete shot — restored");
    }
    setDeletingId(null);
  }

  // ── Marker drag handlers (throttled live + finalize on end) ─────
  function handleTeeDrag(e: google.maps.MapMouseEvent) {
    const now = Date.now();
    if (now - lastDragTs.current < DRAG_THROTTLE_MS) return;
    lastDragTs.current = now;
    if (!e.latLng) return;
    setTee({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  function handleTeeDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    setTee({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  function handleTargetDrag(e: google.maps.MapMouseEvent) {
    const now = Date.now();
    if (now - lastDragTs.current < DRAG_THROTTLE_MS) return;
    lastDragTs.current = now;
    if (!e.latLng) return;
    setTarget({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  function handleTargetDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    setTarget({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  function handleLandingDrag(e: google.maps.MapMouseEvent) {
    const now = Date.now();
    if (now - lastDragTs.current < DRAG_THROTTLE_MS) return;
    lastDragTs.current = now;
    if (!e.latLng) return;
    setLanding({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  function handleLandingDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    setLanding({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }

  // ── Reset pins ──────────────────────────────────────────────────────
  function handleResetPins() {
    console.log("Reset Pins clicked — clearing tee/target/landing");
    setTee(null);
    setTarget(null);
    setLanding(null);
    setMode("idle");
    toast.info("Pins cleared — set Tee to start");
  }

  // ── New Shot (reset landing) ───────────────────────────────────────
  function handleNewShot() {
    setLanding(null);
    setMode("landing");
    toast.info("Tap where the ball landed");
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loadingSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const distLabel = session.distance_unit === "yards" ? "yd" : "m";
  const altitudeEnabled = settings.altitude_adjustment !== false && session.elevation > 0;
  const elevationFeet = session.distance_unit === "meters"
    ? session.elevation * 3.28084
    : session.elevation;
  const elevationPct = +((elevationFeet / 1000) * 1.2).toFixed(1);

  return (
    <div className="flex flex-col gap-3 p-3 pb-24 md:p-6">
      {/* Header with conditions summary */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Range Session</h1>
          <p className="text-xs text-muted-foreground">
            {session.temperature}°{session.temperature_unit === "celsius" ? "C" : "F"} ·{" "}
            {session.wind_speed} {session.wind_unit === "kmh" ? "km/h" : "mph"} {session.wind_direction} ·{" "}
            {session.humidity}% hum
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/")}
        >
          <Square className="mr-1 h-4 w-4" />
          End
        </Button>
      </header>

      {/* Placement controls */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={mode === "tee" ? "default" : "outline"}
          onClick={() => setMode("tee")}
          className="h-10 min-w-[80px]"
        >
          <MapPin className="mr-1 h-4 w-4" />
          Tee
        </Button>
        <Button
          size="sm"
          variant={mode === "target" ? "default" : "outline"}
          onClick={() => setMode("target")}
          disabled={!tee}
          className="h-10 min-w-[80px]"
        >
          <Flag className="mr-1 h-4 w-4" />
          Target
        </Button>
        <Button
          size="sm"
          variant={mode === "landing" ? "default" : "outline"}
          onClick={() => setMode("landing")}
          disabled={!tee}
          className="h-10 min-w-[80px]"
        >
          <CircleDot className="mr-1 h-4 w-4" />
          Landing
        </Button>

        {/* Reset pins */}
        {tee && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetPins}
            className="h-10 min-w-[80px] text-muted-foreground"
            title="Reset tee and target positions"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
        )}

        {/* Club selector */}
        <Select value={selectedClub} onValueChange={setSelectedClub}>
          <SelectTrigger className="h-10 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clubList.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Google Map */}
      <div className="relative h-[45vh] min-h-[280px] overflow-hidden rounded-lg border md:h-[55vh]">
        {!isLoaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={center}
            zoom={18}
            mapTypeId={mapType}
            onClick={handleMapClick}
            onLoad={onMapLoad}
            options={{
              mapTypeId: mapType,
              styles: mapType === "roadmap" ? DARK_MAP_STYLES : [],
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: "greedy",
              draggableCursor: "grab",
              clickableIcons: false,
            }}
          >
            {tee && (
              <Marker
                position={tee}
                label={{ text: "T", color: "#fff", fontWeight: "bold" }}
                draggable
                onDrag={handleTeeDrag}
                onDragEnd={handleTeeDragEnd}
                title="Drag to reposition tee"
              />
            )}
            {target && (
              <Marker
                position={target}
                label={{ text: "F", color: "#fff", fontWeight: "bold" }}
                draggable
                onDrag={handleTargetDrag}
                onDragEnd={handleTargetDragEnd}
                title="Drag to reposition target"
              />
            )}
            {landing && (
              <Marker
                position={landing}
                label={{ text: "L", color: "#fff", fontWeight: "bold" }}
                draggable
                onDragStart={() => { console.log("Preview cleared on drag start"); setMode("idle"); }}
                onDrag={handleLandingDrag}
                onDragEnd={handleLandingDragEnd}
                title="Drag to adjust landing"
              />
            )}

          </GoogleMap>
        )}

        {/* Mode indicator overlay */}
        {mode !== "idle" && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
            Tap to place {mode}
          </div>
        )}
      </div>

      {/* Shot preview + save */}
      {shotPreview && landing && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              {selectedClub} — Shot Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 text-center ${altitudeEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <p className="text-xs text-muted-foreground">
                  {altitudeEnabled ? "Raw Carry" : "Carry"}
                </p>
                <p className="text-xl font-bold">
                  {shotPreview.rawCarry.toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {distLabel}
                  </span>
                </p>
              </div>
              {altitudeEnabled && (
                <div>
                  <p className="text-xs text-muted-foreground">Adjusted</p>
                  <p className="text-xl font-bold text-primary">
                    {shotPreview.adjustedCarry.toFixed(0)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {distLabel}
                    </span>
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Dispersion</p>
                <p className="text-xl font-bold">
                  {shotPreview.dispersionM > 0 ? "+" : ""}
                  {shotPreview.dispersionM.toFixed(1)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    m {shotPreview.dispersionM >= 0 ? "R" : "L"}
                  </span>
                </p>
              </div>
            </div>
            {altitudeEnabled && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  +{elevationPct}% due to {session.elevation} {distLabel === "yd" ? "ft" : "m"} elevation
                </span>
              </p>
            )}
            <Button
              className="mt-3 w-full"
              onClick={handleSaveShot}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Save Shot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Shot button (when no landing yet) */}
      {!landing && tee && (
        <Button
          size="lg"
          className="w-full text-base"
          onClick={handleNewShot}
        >
          <Plus className="mr-2 h-5 w-5" />
          New Shot
        </Button>
      )}

      {/* Shot list */}
      {shots.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Shots ({shots.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shots.map((s, i) => (
              <div
                key={s.id ?? i}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="font-medium">{s.club}</span>
                </div>
                <div className="flex items-center gap-2 text-right text-xs">
                  {altitudeEnabled ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {s.carry_raw} {distLabel}
                      </span>
                      <span className="font-semibold text-primary">
                        {s.carry_adjusted} {distLabel}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium">
                      {s.carry_raw} {distLabel}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {s.dispersion_m > 0 ? "+" : ""}
                    {s.dispersion_m}m
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Delete shot"
                        className="-mr-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this shot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Shot {i + 1} ({s.club} — {s.carry_adjusted} {distLabel}) will be permanently removed. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => s.id && handleDeleteShot(s.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
