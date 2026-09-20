# 🏆 LocalSports

### Discover and Join Local Sports Tournaments

LocalSports is a web platform designed to make it easier for players and tournament organizers to connect. Players can discover tournaments based on their sport and location, view tournament details, register their teams, and track registration status. Organizers can create and manage their tournaments and handle player/team registration requests.

The goal is to replace the scattered way local tournaments are currently promoted through WhatsApp groups, Instagram, posters, friends, and word of mouth with a single platform for tournament discovery and registration.

---

## ✨ Features

### 🏆 Tournament Discovery

* Browse available local sports tournaments
* Search and filter tournaments
* View tournament details such as:

  * Sport
  * Entry fee
  * Prize information
  * Tournament dates
  * Venue
  * Number of teams
  * Registration information

### 📍 Location & Maps

* Tournament venues displayed using Google Maps
* Location-based tournament discovery
* Interactive map view for tournament locations

### 👤 Player & Organizer Roles

LocalSports provides separate experiences for:

**Player**

* Create an account
* Browse tournaments
* View tournament details
* Register for tournaments
* Manage profile information
* Create/manage a team
* Track registration status

**Tournament Organizer**

* Create tournaments
* Manage tournament information
* View tournament registrations
* Accept or reject registration requests

### 👥 Team Management

* Create a team
* Add team information
* Manage team members
* View team details
* Register a team for tournaments

### 🔐 Authentication & Security

* Supabase Authentication
* Email and password based registration/login
* Protected user sessions
* Player and organizer role-based access
* Supabase Row Level Security (RLS) for database access

### 🏟️ Tournament Management

Organizers can create tournaments with information such as:

* Tournament name
* Sport
* Date
* Venue
* Entry fee
* Prize
* Team capacity
* Tournament information

### 📊 Tournament Brackets & Standings

The project includes tournament-engine functionality for:

* Single-elimination brackets
* Automatic bye handling
* Round-robin fixture generation
* Tournament standings

---

## 🛠️ Tech Stack

| Layer             | Technology           |
| ----------------- | -------------------- |
| Frontend          | Next.js 15           |
| Framework         | Next.js App Router   |
| Language          | TypeScript           |
| Styling           | Tailwind CSS         |
| UI Components     | shadcn/ui            |
| Icons             | Lucide Icons         |
| Database          | Supabase PostgreSQL  |
| Authentication    | Supabase Auth        |
| Database Security | Supabase RLS         |
| Maps              | Google Maps Platform |
| Deployment        | Vercel               |

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       └── page.tsx
│   │
│   ├── organizer/
│   │   └── tournaments/
│   │       ├── new/
│   │       │   └── page.tsx
│   │       └── [id]/
│   │
│   ├── teams/
│   │   ├── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   │
│   ├── tournaments/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       ├── page.tsx
│   │       └── register/
│   │           └── page.tsx
│   │
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/
│   ├── navbar.tsx
│   ├── footer.tsx
│   ├── tournament-card.tsx
│   ├── bracket-view.tsx
│   ├── standings-table.tsx
│   ├── map-view.tsx
│   └── scorekeeper-pad.tsx
│
├── lib/
│   ├── supabase/
│   ├── tournament-engine/
│   ├── google-maps.ts
│   ├── mock-data.ts
│   └── utils.ts
│
└── types/
    ├── database.types.ts
    └── sports.types.ts
```

---

## 🗄️ Database

LocalSports uses **Supabase PostgreSQL** as its primary database.

The database contains tables for core application functionality, including:

* `profiles`
* `tournaments`
* `teams`
* `team_members`
* `team_join_requests`
* `matches`
* `match_events`

Supabase Authentication is used for user accounts, while Row Level Security policies help control access to application data.

---

## 🔑 Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your-google-maps-map-id

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> Never commit `.env.local` or expose your Supabase service-role key publicly.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd LocalSports
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` and add your Supabase and Google Maps credentials.

### 4. Configure Supabase

Open your Supabase project and execute:

```text
supabase/schema.sql
```

in the **Supabase SQL Editor**.

This creates the required database tables, relationships, indexes, triggers, and security policies.

### 5. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🧪 Tournament Engine Tests

The tournament engine can be tested using:

```bash
npx tsx test-engine.ts
```

The tests cover tournament-related logic such as:

* Single-elimination bracket generation
* Bye distribution
* Round-robin fixture generation
* Standings calculations

---

## 🗺️ Project Vision

LocalSports aims to make local sports tournament discovery and participation easier by bringing players and tournament organizers onto one platform.

Instead of searching through multiple WhatsApp groups, Instagram posts, posters, or personal contacts, players can use LocalSports to discover tournaments and manage their participation from one place.

---

## 🔮 Future Improvements

Planned improvements may include:

* Online tournament payments
* Improved tournament registration workflow
* More advanced tournament management
* Live match scoring
* Notifications for registration updates
* Better location-based discovery
* More sports and tournament formats
* Mobile application
* Enhanced organizer and player dashboards

---

## 👨‍💻 Built With

**Next.js • TypeScript • Tailwind CSS • Supabase • PostgreSQL • Google Maps Platform**

LocalSports is being developed as a project to improve the way local sports tournaments are discovered and managed.
