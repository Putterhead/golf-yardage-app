"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClubTagInput } from "@/components/ui/club-tag-input";
import {
  getDeviceId,
  fetchSettings,
  saveSettings,
} from "@/lib/supabase";

export default function MyBagPage() {
  const [clubs, setClubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const deviceId = getDeviceId();
      const data = await fetchSettings(deviceId);
      if (data?.clubset) {
        setClubs(data.clubset);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const deviceId = getDeviceId();
    const ok = await saveSettings(deviceId, { clubset: clubs });
    if (ok) {
      toast.success("Bag saved");
    } else {
      toast.error("Failed to save bag");
    }
    setSaving(false);
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
      <header className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">My Bag</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Manage your club set for range sessions
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Briefcase className="h-4 w-4 text-primary" />
            Club Set
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClubTagInput value={clubs} onChange={setClubs} />
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save Bag
      </Button>
    </div>
  );
}
