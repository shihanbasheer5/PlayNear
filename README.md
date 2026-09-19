# 🏆 LocalSports — Local Sports Tournament & Community Platform

A web application that connects local sports tournament organizers, sports clubs, team captains, referees, and athletes. Built with **Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage), and Google Maps Platform**.

---

## ✨ Features

- **📍 Tournament Discovery & Geo-Search:** Search local tournaments and venues with Google Maps integration, interactive map views, and directions links.
- **⚡ Automated Bracket & Fixture Engine:** 1-Click bracket generator supporting **Single Elimination** (with automated power-of-2 Bye distributions), **Double Elimination**, and **Round-Robin** (Berger rotation algorithm).
- **📱 Touch-Friendly Mobile Scorekeeper:** Mobile referee console for live score entry, period transitions, card/event logs, and automated winner bracket progression.
- **📊 Real-time Standings Tables:** Auto-calculated points tables with Goal Difference / Net Run Rate / Set Difference rankings and recent form pills.
- **👥 Teams & Squad Management:** Captains can create clubs, manage athlete rosters, assign jersey numbers, and register for upcoming tournaments.
- **🔒 Supabase Security (RLS):** Complete Row-Level Security policies ensuring organizers only modify their own tournaments and captains only manage their squads.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend & Backend** | Next.js 15 (App Router, Server Actions, Route Handlers) |
| **Language** | TypeScript |
| **Styling & UI** | Tailwind CSS + shadcn/ui + Lucide Icons |
| **Database & Auth** | Supabase PostgreSQL + Supabase Auth (`@supabase/ssr`) |
| **File / Media Storage**| Supabase Storage (`tournament-banners`, `team-logos`, `user-avatars`) |
| **Location & Maps** | Google Maps Platform API |
| **Deployment** | Vercel |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your Supabase and Google Maps credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Maps Platform
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your-google-maps-map-id

# App URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run Database Schema in Supabase
Execute the contents of `supabase/schema.sql` in your **Supabase Dashboard -> SQL Editor** to create all tables, indexes, triggers, and Row Level Security (RLS) policies.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx                     # User sign-in
│   │   └── signup/page.tsx                    # User registration
│   ├── (dashboard)/
│   │   └── dashboard/page.tsx                 # Organizer & athlete hub
│   ├── organizer/
│   │   └── tournaments/
│   │       ├── new/page.tsx                   # Multi-step tournament creation wizard
│   │       └── [id]/scorekeeper/[matchId]/    # Referee mobile live scorekeeper pad
│   ├── teams/
│   │   ├── page.tsx                           # Teams directory
│   │   └── new/page.tsx                       # Team creator
│   ├── tournaments/
│   │   ├── page.tsx                           # Discovery with filter & interactive map
│   │   └── [slug]/
│   │       ├── page.tsx                       # Tournament hub (Brackets, Standings, Venue)
│   │       └── register/page.tsx              # Squad tournament registration
│   ├── layout.tsx
│   ├── page.tsx                               # Homepage & hero banner
│   └── globals.css
├── components/
│   ├── ui/                                    # Button, Badge, Card, Input, Tabs
│   ├── navbar.tsx                             # Main navigation
│   ├── footer.tsx                             # Footer
│   ├── tournament-card.tsx                    # Tournament grid cards
│   ├── bracket-view.tsx                       # Interactive knockout bracket tree
│   ├── standings-table.tsx                    # Points and standings table
│   ├── map-view.tsx                           # Interactive Google Maps viewer
│   └── scorekeeper-pad.tsx                    # Touch live match scoring pad
├── lib/
│   ├── supabase/                              # SSR client, server, and middleware
│   ├── tournament-engine/                     # Bracket, round-robin & standings algorithms
│   ├── google-maps.ts                         # Google Maps helper utilities
│   ├── mock-data.ts                           # Rich demo dataset
│   └── utils.ts                               # Formatting & slug utilities
└── types/
    ├── database.types.ts                      # Supabase schema TypeScript interfaces
    └── sports.types.ts                        # Sports presets (Football, Cricket, etc.)
```

---

## 🧪 Run Tests

To run the tournament engine unit tests (bracket generation, byes, round robin, standings):
```bash
npx tsx test-engine.ts
```
