"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  ShieldCheck, 
  Navigation, 
  ExternalLink,
  ChevronLeft,
  Edit3,
  Lock
} from "lucide-react";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getEffectiveTournamentStatus, isTournamentRegistrationOpen } from "@/lib/tournament-status";
import { getGoogleMapsDirectionsUrl } from "@/lib/google-maps";
import { createClient } from "@/lib/supabase/client";
import { Team, Tournament } from "@/types/database.types";
import { getSportEmoji } from "@/lib/sports-config";

export default function TournamentDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = createClient();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = React.useState(false);

  React.useEffect(() => {
    async function loadTournament() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          setCurrentUserRole((profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase());
        }

        // 1. Query Supabase directly for the tournament by slug
        const { data, error } = await supabase
          .from("tournaments")
          .select(`
            *,
            sport:sports(id, name, slug, icon_name),
            organizer:profiles(id, full_name, first_name),
            tournament_teams(
              id,
              status,
              registered_at,
              team:teams(
                id,
                name,
                slug,
                city,
                logo_url,
                bio,
                stats
              )
            )
          `)
          .eq("slug", slug)
          .single();

        if (!error && data) {
          const rawTeams = (data.tournament_teams || [])
            .filter((r: any) => r.team && r.status !== "REJECTED")
            .map((r: any) => ({
              id: r.team.id,
              name: r.team.name,
              slug: r.team.slug,
              city: r.team.city || data.venue_city || "",
              logo_url: r.team.logo_url,
              bio: r.team.bio,
              stats: r.team.stats || { matches: 0, won: 0, lost: 0, draw: 0 },
              registered_at: r.registered_at,
              registration_status: r.status,
            }));
          setTeams(rawTeams as unknown as Team[]);

          setTournament({
            ...data,
            title: data.title || data.name || "Tournament",
            venue_city: data.venue_city || data.city || "",
            registered_count: rawTeams.length,
          } as unknown as Tournament);

          if (user && data.organizer_id === user.id) {
            setIsOrganizer(true);
          }
        } else {
          // Fallback to mock data if matching slug exists
          const fallback = MOCK_TOURNAMENTS.find((t) => t.slug === slug);
          if (fallback) {
            setTournament(fallback);
          }
        }
      } catch (err) {
        console.error("Error loading tournament details:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadTournament();
  }, [slug, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-5xl">🏆</div>
        <h1 className="text-2xl font-extrabold">Tournament Not Found</h1>
        <p className="text-sm text-muted-foreground">The tournament you are looking for does not exist or has been removed.</p>
        <Link href="/tournaments">
          <Button variant="sports">← Browse All Tournaments</Button>
        </Link>
      </div>
    );
  }

  const sportSlug = tournament.sport?.slug || "";
  const sportName = tournament.sport?.name || "Sports";
  const effectiveStatus = getEffectiveTournamentStatus(tournament);
  const isOpen = isTournamentRegistrationOpen(tournament);
  const isOngoing = effectiveStatus === "ONGOING";
  const isClosed = effectiveStatus === "REGISTRATION_CLOSED";
  const isCompleted = effectiveStatus === "COMPLETED";

  return (
    <div className="pb-16 space-y-8">
      {/* Top Banner Header */}
      <div className="relative bg-slate-950 text-white border-b border-border">
        {/* Cover Photo */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-900">
          {tournament.banner_url ? (
            <img
              src={tournament.banner_url}
              alt={tournament.title}
              className="w-full h-full object-cover opacity-60"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        </div>

        {/* Header Overlay Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-10 space-y-6 pb-6">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Tournaments
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="sports" className="gap-1">
                  <span>{getSportEmoji(sportSlug)}</span>
                  {sportName}
                </Badge>
                {isOngoing && <Badge variant="live">LIVE NOW</Badge>}
                {isOpen && <Badge variant="success">Registration Open</Badge>}
                {isClosed && <Badge variant="warning">Registration Closed</Badge>}
                {isCompleted && <Badge variant="secondary">Completed</Badge>}
                <Badge variant="secondary" className="bg-slate-800 text-slate-200 border-none text-xs">
                  {tournament.format.replace(/_/g, " ")}
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                {tournament.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
                  {formatDate(tournament.tournament_start_date)} – {formatDate(tournament.tournament_end_date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                  {tournament.venue_name}, {tournament.venue_city}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-400 shrink-0" />
                  {tournament.registered_count ?? 0}/{tournament.max_teams} Teams Registered
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {currentUserRole === "ORGANIZER" ? (
                isOrganizer ? (
                  <Link href={`/organizer/tournaments/${tournament.id}`}>
                    <Button variant="sports" size="lg" className="font-bold shadow-lg shadow-blue-500/25 gap-2">
                      <Edit3 className="h-4 w-4" /> Manage Tournament
                    </Button>
                  </Link>
                ) : (
                  <Link href="/organizer">
                    <Button variant="outline" size="lg" className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" /> Organizer Hub
                    </Button>
                  </Link>
                )
              ) : isOpen ? (
                <Link href={`/tournaments/${tournament.slug}/register`}>
                  <Button variant="sports" size="lg" className="font-bold shadow-lg shadow-blue-500/25">
                    Register Squad ({formatCurrency(tournament.entry_fee, tournament.currency || "INR")})
                  </Button>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Button disabled variant="outline" size="lg" className="bg-slate-900/80 border-slate-800 text-slate-400 cursor-not-allowed">
                    <Lock className="h-4 w-4 mr-1.5" />
                    {isOngoing ? "Tournament in Progress" : isCompleted ? "Tournament Completed" : "Registration Closed"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Overview & Venue
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" /> Registered Teams ({teams.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW & VENUE MAP */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Cols: Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card border border-border p-6 rounded-2xl space-y-3 shadow-sm">
                  <h3 className="text-lg font-bold">About the Tournament</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {tournament.description || "No tournament description provided."}
                  </p>
                </div>

                {tournament.rules_text && (
                  <div className="bg-card border border-border p-6 rounded-2xl space-y-3 shadow-sm">
                    <h3 className="text-lg font-bold">Rules & Regulations</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tournament.rules_text}
                    </p>
                  </div>
                )}

                {tournament.prize_pool && (
                  <div className="bg-card border border-border p-6 rounded-2xl space-y-3 shadow-sm">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" /> Prize Pool & Awards
                    </h3>
                    <p className="text-sm font-semibold text-foreground whitespace-pre-line leading-relaxed">
                      {tournament.prize_pool}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Col: Venue & Specs */}
              <div className="space-y-6">
                <div className="bg-card border border-border p-6 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-500" /> Venue & Directions
                  </h3>

                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-foreground">{tournament.venue_name}</div>
                    <p className="text-xs text-muted-foreground">{tournament.venue_address}</p>
                    <p className="text-xs text-muted-foreground">{tournament.venue_city}</p>
                  </div>

                  <a
                    href={getGoogleMapsDirectionsUrl(
                      tournament.venue_lat ?? 19.076,
                      tournament.venue_lng ?? 72.8777,
                      tournament.venue_address || tournament.venue_city
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="sports" className="w-full gap-2 text-xs font-semibold mt-2">
                      <Navigation className="h-4 w-4" />
                      Get Directions
                      <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  </a>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl space-y-3 shadow-sm text-xs">
                  <h4 className="font-bold text-foreground">Tournament Specifications</h4>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span>Max Squad Size:</span>
                      <span className="font-semibold text-foreground">{tournament.max_players_per_team} Players</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span>Team Entry Fee:</span>
                      <span className="font-bold text-foreground font-mono">
                        {formatCurrency(tournament.entry_fee, tournament.currency || "INR")}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span>Registration Closes:</span>
                      <span className="font-semibold text-foreground">{formatDate(tournament.registration_end_date)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span>Tournament Start:</span>
                      <span className="font-semibold text-foreground">{formatDate(tournament.tournament_start_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: REGISTERED TEAMS */}
          <TabsContent value="teams" className="space-y-6">
            <div>
              <h3 className="text-xl font-bold">Registered Teams</h3>
              <p className="text-xs text-muted-foreground">
                Squads registered and confirmed for this competition.
              </p>
            </div>

            {teams.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h4 className="font-bold text-base">No Squads Registered Yet</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Be the first captain to register your team for this tournament!
                </p>
                {isOpen && currentUserRole !== "ORGANIZER" && (
                  <Link href={`/tournaments/${tournament.slug}/register`}>
                    <Button variant="sports" size="sm" className="mt-2">
                      Register Your Squad
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams.map((team, idx) => (
                  <div key={team.id} className="bg-card border border-border p-4 rounded-xl space-y-3 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                          {team.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-primary uppercase">Team #{idx + 1}</div>
                        <h4 className="font-bold text-sm leading-tight truncate">{team.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{team.city || tournament.venue_city}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>Record: {team.stats?.won ?? 0}W - {team.stats?.lost ?? 0}L</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Confirmed
                      </Badge>
                    </div>

                    <Link href={`/teams/${team.id}`} className="block">
                      <Button variant="ghost" size="sm" className="w-full text-xs h-7 hover:bg-muted/80">
                        View Team Profile
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
