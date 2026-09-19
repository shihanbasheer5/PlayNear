export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'PLAYER' | 'ORGANIZER' | 'ADMIN';
export type SportCategory = 'TEAM' | 'INDIVIDUAL_DOUBLES';
export type TournamentFormat =
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'ROUND_ROBIN'
  | 'GROUP_PLUS_KNOCKOUT';
export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type MatchStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface Sport {
  id: string;
  name: string;
  slug: string;
  category: SportCategory;
  icon_name: string;
  rules_template: {
    period_name?: string; // 'Half', 'Quarter', 'Set', 'Innings'
    default_periods?: number;
    score_unit?: string; // 'Goals', 'Points', 'Runs'
    points_for_win?: number;
    points_for_draw?: number;
    points_for_loss?: number;
  };
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
  bio?: string | null;
  primary_sport_id?: string | null;
  primary_sport?: string | null;
  other_sports?: string[] | null;
  playing_position?: string | null;
  experience_achievements?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  captain_id: string;
  sport_id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  city?: string | null;
  bio?: string | null;
  max_players?: number | null;
  current_players?: number | null;
  positions_needed?: string | null;
  target_tournament?: string | null;
  target_tournament_id?: string | null;
  stats: {
    matches: number;
    won: number;
    lost: number;
    draw: number;
  };
  created_at: string;
  updated_at: string;
  captain?: Profile;
  sport?: Sport;
  member_count?: number;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role_in_team: string;
  jersey_number?: number | null;
  status: 'INVITED' | 'ACTIVE' | 'INACTIVE';
  joined_at: string;
  user?: Profile;
}

export interface TeamJoinRequest {
  id: string;
  team_id: string;
  user_id: string;
  message?: string | null;
  position_applying_for?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  updated_at: string;
  team?: Team;
  user?: Profile;
}

export interface Tournament {
  id: string;
  organizer_id: string;
  sport_id: string;
  title: string;
  slug: string;
  description: string;
  banner_url?: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
  tournament_end_date: string;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  venue_place_id?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  max_teams: number;
  min_players_per_team: number;
  max_players_per_team: number;
  entry_fee: number;
  currency: string;
  prize_pool?: string | null;
  rules_text?: string | null;
  created_at: string;
  updated_at: string;
  organizer?: Profile;
  sport?: Sport;
  registered_count?: number;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_id: string;
  status: RegistrationStatus;
  seed_number?: number | null;
  group_name?: string | null;
  roster_snapshot?: {
    player_id: string;
    name: string;
    jersey_number?: number;
  }[];
  registered_at: string;
  team?: Team;
}

export interface Stage {
  id: string;
  tournament_id: string;
  name: string;
  stage_type: 'GROUP' | 'KNOCKOUT';
  stage_order: number;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  stage_id?: string | null;
  round_number: number;
  match_number: number;
  home_team_id?: string | null;
  away_team_id?: string | null;
  winner_team_id?: string | null;
  status: MatchStatus;
  start_time?: string | null;
  court_or_pitch?: string | null;
  home_score: string;
  away_score: string;
  score_details: Json;
  next_match_id?: string | null;
  next_match_slot?: 'HOME' | 'AWAY' | null;
  created_at: string;
  updated_at: string;
  home_team?: Team | null;
  away_team?: Team | null;
  winner_team?: Team | null;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  event_type: string;
  minute_or_over?: string | null;
  team_id?: string | null;
  player_name?: string | null;
  description: string;
  created_at: string;
}
