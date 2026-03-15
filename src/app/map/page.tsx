"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function MapPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="flex flex-col gap-4 p-4 pt-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Course Map</h1>
        <p className="text-sm text-muted-foreground">
          Tap to measure distances
        </p>
      </header>

      <Card className="flex min-h-[calc(100vh-220px)] items-center justify-center overflow-hidden">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <MapPin className="h-16 w-16 text-muted-foreground/40" />
          {!apiKey ? (
            <>
              <p className="text-lg font-medium text-muted-foreground">
                Google Maps API key required
              </p>
              <p className="max-w-xs text-sm text-muted-foreground/60">
                Add your <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> and restart the dev server.
              </p>
            </>
          ) : (
            <p className="text-lg font-medium text-muted-foreground">
              Map loading…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
