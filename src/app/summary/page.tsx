"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Filter,
  ArrowLeft,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  type Session,
  type Shot,
  fetchSessions,
  fetchAllShotsForDevice,
  getDeviceId,
} from "@/lib/supabase";
import {
  mean,
  median,
  percentile,
  iqr,
  stdDev,
  containmentRadius,
  lateralSpread,
  round,
} from "@/lib/stats";

// ── Types ────────────────────────────────────────────────────────────

interface ClubStats {
  club: string;
  count: number;
  medianCarry: number;
  meanCarry: number;
  iqrCarry: number;
  p10Carry: number;
  p90Carry: number;
  sdDispersion: number;
  iqrDispersion: number;
  containment68: number;
  containment90: number;
  lateralLow: number;
  lateralHigh: number;
  lateralSpread: number;
  shots: Shot[];
}

interface SessionProgressPoint {
  sessionDate: string;
  sessionId: string;
  sdDispersion: number;
  iqrDispersion: number;
  count: number;
}

// ── Chart colors ─────────────────────────────────────────────────────

const CLUB_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#10b981", "#a855f7",
];

// ── Page ─────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allShots, setAllShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sessionFilter, setSessionFilter] = useState("__all__");
  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const [windMin, setWindMin] = useState("");
  const [windMax, setWindMax] = useState("");
  const [tempMin, setTempMin] = useState("");
  const [tempMax, setTempMax] = useState("");

  // Collapsible club sections
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set());

  // ── Fetch data ───────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const deviceId = getDeviceId();
      const [sessData, shotsData] = await Promise.all([
        fetchSessions(deviceId),
        fetchAllShotsForDevice(deviceId),
      ]);
      setSessions(sessData);
      setAllShots(shotsData);
      setLoading(false);
    }
    load();
  }, []);

  // ── Build session lookup ─────────────────────────────────────────

  const sessionMap = useMemo(() => {
    const m = new Map<string, Session>();
    for (const s of sessions) {
      if (s.id) m.set(s.id, s);
    }
    return m;
  }, [sessions]);

  // ── Filter shots ─────────────────────────────────────────────────

  const filteredShots = useMemo(() => {
    let shots = [...allShots];

    // Session filter
    if (sessionFilter !== "__all__") {
      shots = shots.filter((s) => s.session_id === sessionFilter);
    }

    // Conditions filters
    const wMin = windMin ? parseFloat(windMin) : null;
    const wMax = windMax ? parseFloat(windMax) : null;
    const tMin = tempMin ? parseFloat(tempMin) : null;
    const tMax = tempMax ? parseFloat(tempMax) : null;

    if (wMin !== null || wMax !== null || tMin !== null || tMax !== null) {
      shots = shots.filter((shot) => {
        const session = sessionMap.get(shot.session_id);
        if (!session) return false;
        if (wMin !== null && session.wind_speed < wMin) return false;
        if (wMax !== null && session.wind_speed > wMax) return false;
        if (tMin !== null && session.temperature < tMin) return false;
        if (tMax !== null && session.temperature > tMax) return false;
        return true;
      });
    }

    return shots;
  }, [allShots, sessionFilter, windMin, windMax, tempMin, tempMax, sessionMap]);

  // ── Group by club & compute stats ────────────────────────────────

  const clubStats = useMemo(() => {
    const groups = new Map<string, Shot[]>();
    for (const shot of filteredShots) {
      const list = groups.get(shot.club) ?? [];
      list.push(shot);
      groups.set(shot.club, list);
    }

    const stats: ClubStats[] = [];
    for (const [club, shots] of groups) {
      const carries = shots.map((s) => s.carry_adjusted);
      const dispersions = shots.map((s) => s.dispersion_m);

      // Outlier filter: exclude shots < 50% median carry
      let filteredCarries = carries;
      let filteredDispersions = dispersions;
      let filteredShots = shots;

      if (excludeOutliers && carries.length >= 3) {
        const med = median(carries);
        const threshold = med * 0.5;
        const mask = carries.map((c) => c >= threshold);
        filteredCarries = carries.filter((_, i) => mask[i]);
        filteredDispersions = dispersions.filter((_, i) => mask[i]);
        filteredShots = shots.filter((_, i) => mask[i]);
      }

      if (filteredCarries.length === 0) continue;

      const ls = lateralSpread(filteredDispersions);

      stats.push({
        club,
        count: filteredShots.length,
        medianCarry: round(median(filteredCarries)),
        meanCarry: round(mean(filteredCarries)),
        iqrCarry: round(iqr(filteredCarries)),
        p10Carry: round(percentile(filteredCarries, 10)),
        p90Carry: round(percentile(filteredCarries, 90)),
        sdDispersion: round(stdDev(filteredDispersions)),
        iqrDispersion: round(iqr(filteredDispersions)),
        containment68: round(containmentRadius(filteredDispersions, 68)),
        containment90: round(containmentRadius(filteredDispersions, 90)),
        lateralLow: round(ls.low),
        lateralHigh: round(ls.high),
        lateralSpread: round(ls.spread),
        shots: filteredShots,
      });
    }

    // Sort by median carry descending (longest club first)
    stats.sort((a, b) => b.medianCarry - a.medianCarry);
    return stats;
  }, [filteredShots, excludeOutliers]);

  // ── Club gapping data ────────────────────────────────────────────

  const gappingData = useMemo(() => {
    return clubStats.map((cs, i) => {
      const nextClub = clubStats[i + 1];
      const gap = nextClub ? cs.medianCarry - nextClub.medianCarry : 0;
      return {
        club: cs.club,
        medianCarry: cs.medianCarry,
        gap,
        gapWarning: gap > 10,
      };
    });
  }, [clubStats]);

  // ── Progress over time (per-club dispersion by session) ──────────

  const progressData = useMemo(() => {
    const result = new Map<string, SessionProgressPoint[]>();

    for (const cs of clubStats) {
      const bySession = new Map<string, Shot[]>();
      for (const shot of cs.shots) {
        const list = bySession.get(shot.session_id) ?? [];
        list.push(shot);
        bySession.set(shot.session_id, list);
      }

      const points: SessionProgressPoint[] = [];
      for (const [sid, shots] of bySession) {
        if (shots.length < 2) continue;
        const session = sessionMap.get(sid);
        const dispersions = shots.map((s) => s.dispersion_m);
        points.push({
          sessionId: sid,
          sessionDate: session?.created_at
            ? new Date(session.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : sid.slice(0, 8),
          sdDispersion: round(stdDev(dispersions)),
          iqrDispersion: round(iqr(dispersions)),
          count: shots.length,
        });
      }

      // Sort by session date
      points.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      if (points.length > 0) {
        result.set(cs.club, points);
      }
    }

    return result;
  }, [clubStats, sessionMap]);

  // ── Scatter data (all clubs combined) ────────────────────────────

  const scatterData = useMemo(() => {
    return clubStats.flatMap((cs, clubIdx) =>
      cs.shots.map((shot) => ({
        club: cs.club,
        carry: shot.carry_adjusted,
        dispersion: shot.dispersion_m,
        color: CLUB_COLORS[clubIdx % CLUB_COLORS.length],
      }))
    );
  }, [clubStats]);

  // ── Toggle club section ──────────────────────────────────────────

  function toggleClub(club: string) {
    setExpandedClubs((prev) => {
      const next = new Set(prev);
      if (next.has(club)) next.delete(club);
      else next.add(club);
      return next;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  const distUnit = sessions[0]?.distance_unit === "meters" ? "m" : "yd";

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allShots.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 p-4 pt-6 md:p-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Home
          </Button>
        </Link>
        <Card className="flex min-h-[200px] items-center justify-center">
          <CardContent className="text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No shot data yet — complete a range session first!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pt-6 pb-24 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Club Stats</h1>
          <p className="text-sm text-muted-foreground">
            {filteredShots.length} shot{filteredShots.length !== 1 ? "s" : ""} across{" "}
            {clubStats.length} club{clubStats.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Session</Label>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sessions</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id!}>
                    {s.created_at
                      ? new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outlier toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="outliers"
              checked={excludeOutliers}
              onCheckedChange={setExcludeOutliers}
            />
            <Label htmlFor="outliers" className="text-sm">
              Exclude outliers (&lt;50% median carry)
            </Label>
          </div>

          {/* Condition ranges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Wind min</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={windMin}
                onChange={(e) => setWindMin(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Wind max</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="∞"
                value={windMax}
                onChange={(e) => setWindMax(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Temp min</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={tempMin}
                onChange={(e) => setTempMin(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Temp max</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="∞"
                value={tempMax}
                onChange={(e) => setTempMax(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Club Gapping ─────────────────────────────────────────── */}
      {gappingData.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Club Gapping
            </CardTitle>
            <CardDescription>
              Median carry distances — gaps &gt;10 {distUnit} highlighted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gappingData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="club"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: distUnit,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} ${distUnit}`,
                      name === "medianCarry" ? "Median" : name,
                    ]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="medianCarry" radius={[4, 4, 0, 0]}>
                    {gappingData.map((entry, i) => (
                      <Cell
                        key={entry.club}
                        fill={
                          entry.gapWarning
                            ? "#ef4444"
                            : CLUB_COLORS[i % CLUB_COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Gap warnings */}
            {gappingData.some((d) => d.gapWarning) && (
              <div className="mt-3 space-y-1">
                {gappingData
                  .filter((d) => d.gapWarning)
                  .map((d) => (
                    <div
                      key={d.club}
                      className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {d.gap} {distUnit} gap after {d.club}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Scatter: Distance vs Dispersion ──────────────────────── */}
      {scatterData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Distance vs Dispersion
            </CardTitle>
            <CardDescription>
              Every shot — colored by club
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="carry"
                    name="Carry"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: `Carry (${distUnit})`,
                      position: "insideBottom",
                      offset: -5,
                      style: { fontSize: 11 },
                    }}
                  />
                  <YAxis
                    dataKey="dispersion"
                    name="Dispersion"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "Dispersion (m)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      round(value, 1),
                      name,
                    ]}
                  />
                  {clubStats.map((cs, i) => (
                    <Scatter
                      key={cs.club}
                      name={cs.club}
                      data={cs.shots.map((shot) => ({
                        carry: shot.carry_adjusted,
                        dispersion: shot.dispersion_m,
                      }))}
                      fill={CLUB_COLORS[i % CLUB_COLORS.length]}
                      opacity={0.7}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dispersion Progress Over Time ────────────────────────── */}
      {progressData.size > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Dispersion Over Time
            </CardTitle>
            <CardDescription>
              SD of dispersion per session — lower is more consistent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="sessionDate"
                    allowDuplicatedCategory={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "SD (m)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Array.from(progressData.entries()).map(
                    ([club, points], i) => (
                      <Line
                        key={club}
                        data={points}
                        name={club}
                        dataKey="sdDispersion"
                        stroke={CLUB_COLORS[i % CLUB_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Per-Club Detail Sections ─────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Per-Club Breakdown
        </h2>
        {clubStats.map((cs, clubIdx) => {
          const isOpen = expandedClubs.has(cs.club);
          const color = CLUB_COLORS[clubIdx % CLUB_COLORS.length];
          return (
            <Card key={cs.club}>
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleClub(cs.club)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold">{cs.club}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {cs.count} shot{cs.count !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {cs.medianCarry} {distUnit} median
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <CardContent className="border-t pt-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                    <StatItem label="Median carry" value={`${cs.medianCarry} ${distUnit}`} />
                    <StatItem label="Mean carry" value={`${cs.meanCarry} ${distUnit}`} />
                    <StatItem label="IQR (carry)" value={`${cs.iqrCarry} ${distUnit}`} />
                    <StatItem label="10–90% range" value={`${cs.p10Carry}–${cs.p90Carry} ${distUnit}`} />
                    <StatItem label="Dispersion SD" value={`${cs.sdDispersion} m`} />
                    <StatItem label="Dispersion IQR" value={`${cs.iqrDispersion} m`} />
                    <StatItem label="68% radius" value={`${cs.containment68} m`} />
                    <StatItem label="90% radius" value={`${cs.containment90} m`} />
                    <StatItem label="Lateral spread" value={`${cs.lateralLow} to ${cs.lateralHigh} m`} />
                    <StatItem label="Lateral width" value={`${cs.lateralSpread} m`} />
                  </div>

                  {/* Mini scatter for this club */}
                  {cs.shots.length >= 2 && (
                    <div className="mt-4 h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="carry"
                            tick={{ fontSize: 10 }}
                            label={{
                              value: `Carry (${distUnit})`,
                              position: "insideBottom",
                              offset: -3,
                              style: { fontSize: 10 },
                            }}
                          />
                          <YAxis
                            dataKey="dispersion"
                            tick={{ fontSize: 10 }}
                            label={{
                              value: "Disp (m)",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 10 },
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                          <ReferenceLine
                            y={cs.sdDispersion}
                            stroke={color}
                            strokeDasharray="4 4"
                            label={{ value: "SD", position: "right", fontSize: 10 }}
                          />
                          <Scatter
                            data={cs.shots.map((s) => ({
                              carry: s.carry_adjusted,
                              dispersion: s.dispersion_m,
                            }))}
                            fill={color}
                            opacity={0.8}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Small stat display ──────────────────────────────────────────────

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
