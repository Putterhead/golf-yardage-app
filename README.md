# Golf Yardage App

A mobile-first Progressive Web App for tracking distances, weather, and club selection on the golf course. Built with Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **Theme:** Dark mode by default (golf range friendly)
- **Maps:** @react-google-maps/api
- **Charts:** Recharts
- **Backend:** Supabase (database + auth helpers)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **PWA:** Custom service worker + web manifest

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ (with npm)
- A [Supabase](https://supabase.com/) project
- A [Google Maps API key](https://console.cloud.google.com/) (for map features)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy or edit `.env.local` and fill in your keys:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Create the Supabase table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  distance_unit TEXT NOT NULL DEFAULT 'yards',
  temperature_unit TEXT NOT NULL DEFAULT 'fahrenheit',
  wind_unit TEXT NOT NULL DEFAULT 'mph',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anonymous reads/writes (tighten with RLS + auth as needed)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## PWA Installation

The app is installable on mobile devices:
1. Open the app in Chrome/Safari on your phone
2. Tap "Add to Home Screen" (or the browser install prompt)
3. The app runs in standalone mode with offline caching

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (dark theme, bottom nav, PWA)
│   ├── page.tsx            # Home — dashboard with stat cards
│   ├── map/page.tsx        # Map — Google Maps integration
│   └── settings/page.tsx   # Settings — unit preferences
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── navigation.tsx      # Mobile bottom navigation bar
│   ├── theme-provider.tsx  # next-themes dark mode provider
│   └── pwa-register.tsx    # Service worker registration
└── lib/
    ├── utils.ts            # cn() utility for Tailwind classes
    └── supabase.ts         # Supabase client + settings CRUD
public/
├── manifest.json           # PWA web manifest
├── sw.js                   # Service worker (network-first caching)
└── icons/                  # App icons (SVG placeholders)
```

## Upgrading Icons

The placeholder SVG icons in `public/icons/` work for development. For production, generate proper PNG icons (192×192 and 512×512) and update `manifest.json` accordingly.

## License

MIT
