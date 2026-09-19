-- ========================================================================
-- PLAYNEAR (LOCALSPORTS) — CANONICAL DATABASE SCHEMA & POLICIES
-- ========================================================================
-- This is the single, canonical source of truth for the PlayNear database.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- 1. SPORTS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'TEAM', -- 'TEAM' or 'INDIVIDUAL_DOUBLES'
    icon_name VARCHAR(50) DEFAULT 'Trophy',
    rules_template JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================================================
-- 2. USER PROFILES TABLE (Mirrors auth.users)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    username VARCHAR(100) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(50),
    phone VARCHAR(50),
    avatar_url TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    bio TEXT,
    primary_sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
    primary_sport VARCHAR(50) DEFAULT 'cricket',
    other_sports TEXT[] DEFAULT '{}',
    playing_position VARCHAR(100),
    experience_achievements TEXT,
    role VARCHAR(50) DEFAULT 'PLAYER', -- 'PLAYER', 'ORGANIZER', 'ADMIN'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ========================================================================
-- 3. TEAMS TABLE (Sports Clubs & Squads)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    logo_url TEXT,
    city VARCHAR(100),
    bio TEXT,
    max_players INT DEFAULT 15,
    current_players INT DEFAULT 1,
    positions_needed TEXT DEFAULT '',
    target_tournament TEXT,
    target_tournament_id UUID,
    stats JSONB DEFAULT '{"matches": 0, "won": 0, "lost": 0, "draw": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_slug ON public.teams(slug);

-- ========================================================================
-- 4. TEAM MEMBERS TABLE (Active Squad Rosters)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_in_team VARCHAR(100) DEFAULT 'Player',
    jersey_number INT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- ========================================================================
-- 5. TEAM JOIN REQUESTS TABLE (Athlete Applications)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.team_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT DEFAULT '',
    position_applying_for TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- ========================================================================
-- 6. TEAM LEAVE REQUESTS TABLE (Squad Exit Requests)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.team_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- ========================================================================
-- 7. TOURNAMENTS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    banner_url TEXT,
    format VARCHAR(50) NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    status VARCHAR(50) DEFAULT 'REGISTRATION_OPEN',
    
    registration_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    registration_end_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    tournament_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    tournament_end_date TIMESTAMPTZ NOT NULL DEFAULT now(),

    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT NOT NULL,
    venue_city VARCHAR(100) NOT NULL,
    venue_place_id VARCHAR(255),
    venue_lat DOUBLE PRECISION,
    venue_lng DOUBLE PRECISION,

    max_teams INT NOT NULL DEFAULT 8,
    min_players_per_team INT DEFAULT 1,
    max_players_per_team INT DEFAULT 15,
    entry_fee INT DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    prize_pool TEXT DEFAULT '',
    rules_text TEXT DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);

-- Ensure foreign key for target_tournament_id on teams if created after tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teams_target_tournament_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_target_tournament_id_fkey
      FOREIGN KEY (target_tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ========================================================================
-- 8. TOURNAMENT TEAMS (Registrations)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.tournament_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    seed_number INT,
    group_name VARCHAR(50),
    roster_snapshot JSONB,
    registered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tournament_id, team_id)
);

-- ========================================================================
-- 9. STAGES TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    stage_type VARCHAR(50) NOT NULL,
    stage_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================================================
-- 10. MATCHES TABLE (Fixtures)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
    round_number INT DEFAULT 1,
    match_number INT NOT NULL,
    
    home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    winner_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,

    status VARCHAR(50) DEFAULT 'SCHEDULED',
    start_time TIMESTAMPTZ,
    court_or_pitch VARCHAR(100),
    
    home_score VARCHAR(50) DEFAULT '0',
    away_score VARCHAR(50) DEFAULT '0',
    score_details JSONB DEFAULT '{}'::jsonb,
    
    next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    next_match_slot VARCHAR(10),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================================================
-- 11. MATCH EVENTS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    minute_or_over VARCHAR(50),
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    player_name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- ── Sports Policies ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public sports read" ON public.sports;
CREATE POLICY "Public sports read" ON public.sports FOR SELECT USING (true);

-- ── Profiles Policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- ── Teams Policies ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public teams read" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Captains can update own teams" ON public.teams;
DROP POLICY IF EXISTS "Captains can delete own teams" ON public.teams;

CREATE POLICY "Public teams read" ON public.teams FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT WITH CHECK (auth.uid() = captain_id);

CREATE POLICY "Captains can update own teams"
  ON public.teams FOR UPDATE USING (auth.uid() = captain_id);

CREATE POLICY "Captains can delete own teams"
  ON public.teams FOR DELETE USING (auth.uid() = captain_id);

-- ── Team Members Policies ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public team members read" ON public.team_members;
DROP POLICY IF EXISTS "Captains can add team members" ON public.team_members;
DROP POLICY IF EXISTS "Captains can remove team members" ON public.team_members;

CREATE POLICY "Public team members read" ON public.team_members FOR SELECT USING (true);

CREATE POLICY "Captains can add team members"
  ON public.team_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

CREATE POLICY "Captains can remove team members"
  ON public.team_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

-- ── Team Join Requests Policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own join requests" ON public.team_join_requests;
DROP POLICY IF EXISTS "Captains can view team join requests" ON public.team_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON public.team_join_requests;
DROP POLICY IF EXISTS "Users can withdraw own requests" ON public.team_join_requests;
DROP POLICY IF EXISTS "Captains can update request status" ON public.team_join_requests;

CREATE POLICY "Users can view own join requests"
  ON public.team_join_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Captains can view team join requests"
  ON public.team_join_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

CREATE POLICY "Users can create join requests"
  ON public.team_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can withdraw own requests"
  ON public.team_join_requests FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Captains can update request status"
  ON public.team_join_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

-- ── Team Leave Requests Policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.team_leave_requests;
DROP POLICY IF EXISTS "Captains can view team leave requests" ON public.team_leave_requests;
DROP POLICY IF EXISTS "Members can create leave requests" ON public.team_leave_requests;
DROP POLICY IF EXISTS "Users can update or delete own leave requests" ON public.team_leave_requests;
DROP POLICY IF EXISTS "Captains can update leave request status" ON public.team_leave_requests;

CREATE POLICY "Users can view own leave requests"
  ON public.team_leave_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Captains can view team leave requests"
  ON public.team_leave_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

CREATE POLICY "Members can create leave requests"
  ON public.team_leave_requests FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_leave_requests.team_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update or delete own leave requests"
  ON public.team_leave_requests FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Captains can update leave request status"
  ON public.team_leave_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND captain_id = auth.uid())
  );

-- ── Tournaments Policies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public tournaments read" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can update own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can delete own tournaments" ON public.tournaments;

CREATE POLICY "Public tournaments read" ON public.tournaments FOR SELECT USING (true);

CREATE POLICY "Organizers can create tournaments"
  ON public.tournaments FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own tournaments"
  ON public.tournaments FOR UPDATE USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete own tournaments"
  ON public.tournaments FOR DELETE USING (auth.uid() = organizer_id);

-- ── Tournament Teams (Registrations) Policies ────────────────────────────
DROP POLICY IF EXISTS "Public tournament registrations read" ON public.tournament_teams;
DROP POLICY IF EXISTS "Captains can register teams" ON public.tournament_teams;
DROP POLICY IF EXISTS "Captains can delete team registrations" ON public.tournament_teams;
DROP POLICY IF EXISTS "Organizers can update registration status" ON public.tournament_teams;
DROP POLICY IF EXISTS "Organizers can delete registrations" ON public.tournament_teams;

CREATE POLICY "Public tournament registrations read"
  ON public.tournament_teams FOR SELECT USING (true);

CREATE POLICY "Captains can register teams"
  ON public.tournament_teams FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE teams.id = tournament_teams.team_id AND teams.captain_id = auth.uid())
  );

CREATE POLICY "Captains can delete team registrations"
  ON public.tournament_teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE teams.id = tournament_teams.team_id AND teams.captain_id = auth.uid())
  );

CREATE POLICY "Organizers can update registration status"
  ON public.tournament_teams FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tournaments WHERE tournaments.id = tournament_teams.tournament_id AND tournaments.organizer_id = auth.uid())
  ) WITH CHECK (true);

CREATE POLICY "Organizers can delete registrations"
  ON public.tournament_teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tournaments WHERE tournaments.id = tournament_teams.tournament_id AND tournaments.organizer_id = auth.uid())
  );

-- ── Stages & Matches Policies ────────────────────────────────────────────
DROP POLICY IF EXISTS "Public stages read" ON public.stages;
DROP POLICY IF EXISTS "Organizers can manage stages" ON public.stages;

CREATE POLICY "Public stages read" ON public.stages FOR SELECT USING (true);

CREATE POLICY "Organizers can manage stages" ON public.stages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND organizer_id = auth.uid())
);

DROP POLICY IF EXISTS "Public matches read" ON public.matches;
DROP POLICY IF EXISTS "Organizers can manage matches" ON public.matches;

CREATE POLICY "Public matches read" ON public.matches FOR SELECT USING (true);

CREATE POLICY "Organizers can manage matches" ON public.matches FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND organizer_id = auth.uid())
);

DROP POLICY IF EXISTS "Public match events read" ON public.match_events;
DROP POLICY IF EXISTS "Organizers can manage match events" ON public.match_events;

CREATE POLICY "Public match events read" ON public.match_events FOR SELECT USING (true);

CREATE POLICY "Organizers can manage match events" ON public.match_events FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE m.id = match_id AND t.organizer_id = auth.uid()
  )
);

-- ========================================================================
-- 13. USER SIGNUP TRIGGER
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'PLAYER')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================================================================
-- 14. RPC STORED PROCEDURES (SECURITY DEFINER)
-- ========================================================================

-- ── 14.1 Get or Create Sport ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_sport(
    p_slug TEXT,
    p_name TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'TEAM',
    p_icon_name TEXT DEFAULT 'Trophy'
)
RETURNS TABLE (id UUID, name TEXT, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_name TEXT;
    v_slug TEXT;
BEGIN
    SELECT s.id, s.name, s.slug INTO v_id, v_name, v_slug
    FROM public.sports s
    WHERE LOWER(s.slug) = LOWER(p_slug)
    LIMIT 1;

    IF v_id IS NULL THEN
        INSERT INTO public.sports (name, slug, category, icon_name, rules_template)
        VALUES (
            COALESCE(p_name, INITCAP(p_slug)),
            LOWER(p_slug),
            p_category,
            p_icon_name,
            '{}'::jsonb
        )
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING sports.id, sports.name, sports.slug INTO v_id, v_name, v_slug;
    END IF;

    RETURN QUERY SELECT v_id, v_name, v_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_sport(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- ── 14.2 Update Registration Status by Organizer ─────────────────────────
CREATE OR REPLACE FUNCTION public.update_registration_status(
  p_registration_id UUID,
  p_new_status TEXT,
  p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id UUID;
  v_organizer_id  UUID;
BEGIN
  SELECT tournament_id INTO v_tournament_id
  FROM public.tournament_teams
  WHERE id = p_registration_id;

  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  SELECT organizer_id INTO v_organizer_id
  FROM public.tournaments
  WHERE id = v_tournament_id;

  IF v_organizer_id IS DISTINCT FROM p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: You do not own this tournament');
  END IF;

  UPDATE public.tournament_teams
  SET status = p_new_status
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'success', true, 
    'registration_id', p_registration_id, 
    'new_status', p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_registration_status(UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- ── 14.3 Delete Registration by Organizer ────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_registration_by_organizer(
  p_registration_id UUID,
  p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id UUID;
  v_organizer_id  UUID;
BEGIN
  SELECT tournament_id INTO v_tournament_id
  FROM public.tournament_teams
  WHERE id = p_registration_id;

  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  SELECT organizer_id INTO v_organizer_id
  FROM public.tournaments
  WHERE id = v_tournament_id;

  IF v_organizer_id IS DISTINCT FROM p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: You do not own this tournament');
  END IF;

  DELETE FROM public.tournament_teams
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_registration_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_registration_by_organizer(UUID, UUID) TO authenticated, anon, service_role;

-- ── 14.4 Delete Team by Captain ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_team_by_captain(
  p_team_id UUID,
  p_captain_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_captain_id UUID;
  v_team_name  VARCHAR(255);
BEGIN
  SELECT captain_id, name INTO v_captain_id, v_team_name
  FROM public.teams
  WHERE id = p_team_id;

  IF v_captain_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF v_captain_id IS DISTINCT FROM p_captain_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Only the team captain can delete this team');
  END IF;

  -- Clean up dependencies gracefully
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_leave_requests') THEN
    DELETE FROM public.team_leave_requests WHERE team_id = p_team_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_join_requests') THEN
    DELETE FROM public.team_join_requests WHERE team_id = p_team_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    DELETE FROM public.team_members WHERE team_id = p_team_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_teams') THEN
    DELETE FROM public.tournament_teams WHERE team_id = p_team_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    UPDATE public.matches SET home_team_id = NULL WHERE home_team_id = p_team_id;
    UPDATE public.matches SET away_team_id = NULL WHERE away_team_id = p_team_id;
    UPDATE public.matches SET winner_team_id = NULL WHERE winner_team_id = p_team_id;
  END IF;

  DELETE FROM public.teams WHERE id = p_team_id;

  RETURN jsonb_build_object('success', true, 'message', 'Team deleted successfully', 'team_name', v_team_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_team_by_captain(UUID, UUID) TO authenticated, anon, service_role;

-- ========================================================================
-- 15. STORAGE CONFIGURATION (Avatars Bucket & Policies)
-- ========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Avatar images are publicly accessible'
    ) THEN
      CREATE POLICY "Avatar images are publicly accessible"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload avatars'
    ) THEN
      CREATE POLICY "Users can upload avatars"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can update their avatars'
    ) THEN
      CREATE POLICY "Users can update their avatars"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
  END IF;
END $$;

-- ========================================================================
-- 16. SEED DATA: OFFICIAL 4 SPORTS + SUPPORTED CATEGORIES
-- ========================================================================
INSERT INTO public.sports (name, slug, category, icon_name, rules_template)
VALUES
  ('Cricket', 'cricket', 'TEAM', 'Award', '{"score_unit": "Runs", "points_for_win": 2, "points_for_draw": 1, "points_for_loss": 0, "tie_breaker": "RUN_RATE"}'::jsonb),
  ('Football', 'football', 'TEAM', 'Trophy', '{"score_unit": "Goals", "points_for_win": 3, "points_for_draw": 1, "points_for_loss": 0, "tie_breaker": "GOAL_DIFF"}'::jsonb),
  ('Kabaddi', 'kabaddi', 'TEAM', 'Users', '{"score_unit": "Points", "points_for_win": 2, "points_for_draw": 1, "points_for_loss": 0}'::jsonb),
  ('Volleyball', 'volleyball', 'TEAM', 'Flame', '{"score_unit": "Sets", "points_for_win": 2, "points_for_draw": 0, "points_for_loss": 0, "tie_breaker": "SET_DIFF"}'::jsonb),
  ('Basketball', 'basketball', 'TEAM', 'Target', '{"score_unit": "Points", "points_for_win": 2, "points_for_draw": 0, "points_for_loss": 1, "tie_breaker": "SET_DIFF"}'::jsonb),
  ('Badminton', 'badminton', 'INDIVIDUAL_DOUBLES', 'Zap', '{"score_unit": "Sets", "points_for_win": 2, "points_for_draw": 0, "points_for_loss": 0, "tie_breaker": "SET_DIFF"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon_name = EXCLUDED.icon_name,
  rules_template = EXCLUDED.rules_template;

-- ========================================================================
-- 17. RELOAD SCHEMA CACHE
-- ========================================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
