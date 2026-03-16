"use client";

import { useEffect, useState } from "react";
import {
  type UserSettings,
  DEFAULT_SETTINGS,
  getDeviceId,
  fetchSettings,
} from "@/lib/supabase";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    async function load() {
      const id = getDeviceId();
      setDeviceId(id);
      const data = await fetchSettings(id);
      setSettings(data);
      setLoading(false);
    }
    load();
  }, []);

  const resolved = settings ?? {
    device_id: deviceId,
    ...DEFAULT_SETTINGS,
  };

  return { settings: resolved, loading, deviceId };
}
