"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Trophy, 
  Search, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Zap, 
  Users, 
  Award, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  ChevronRight,
  PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TournamentCard } from "@/components/tournament-card";
import { SUPPORTED_SPORTS, getSportEmoji } from "@/lib/sports-config";
import { Tournament } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { getEffectiveTournamentStatus, isTournamentOver } from "@/lib/tournament-status";

type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

interface PlayerRegistration {
  id: string;
  status: RegistrationStatus;
  registered_at: string;
  payment_status: string;
  team: { id: string; name: string } | null;
  tournament: {
    id: string;
    title: string;
    slug: string;
    venue_city: string | null;
    tournament_start_date: string | null;
    sport: { name: string; icon_name: string | null } | null;
  } | null;
}

interface FeaturedTeam {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  city: string | null;
  bio: string | null;
  member_count?: number;
  current_players?: number | null;
  max_players?: number | null;
  positions_needed?: string | null;
  target_tournament?: string | null;
  sport: {
    id: string;
    name: string;
    slug: string;
    icon_name?: string | null;
  } | null;
  captain: {
    full_name: string;
    first_name: string | null;
  } | null;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [teams, setTeams] = React.useState<FeaturedTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = React.useState(true);
  const [searchInput, setSearchInput] = React.useState("");
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [userRole, setUserRole] = React.useState<"PLAYER" | "ORGANIZER" | null>(null);
  const [registrations, setRegistrations] = React.useState<PlayerRegistration[]>([]);
  const [regLoading, setRegLoading] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(1);

  React.useEffect(() => {
    async function loadFeaturedTournaments() {
      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select(`
            *,
            sport:sports(id, name, slug, icon_name),
            organizer:profiles(id, full_name, first_name),
            tournament_teams(id, status)
          `)
          .order("created_at", { ascending: false })
          .limit(6);

        if (!error && data && data.length > 0) {
          const mapped = data.map((t: Record<string, unknown>) => {
            const teamRows = (t.tournament_teams as Array<{ id: string; status: string }> | null) || [];
            const approvedCount = teamRows.filter((tt) => tt.status === "APPROVED").length;
            const displayTitle = (t.title || t.name || "Tournament") as string;
            const displayCity = (t.venue_city || t.city || "") as string;

            const rawTourney = {
              ...t,
              title: displayTitle,
              name: displayTitle,
              venue_city: displayCity,
              registered_count: approvedCount,
              tournament_teams: undefined,
            } as unknown as Tournament;

            return {
              ...rawTourney,
              status: getEffectiveTournamentStatus(rawTourney),
            };
          });
          const activeMapped = mapped.filter((t) => !isTournamentOver(t) && t.status !== "COMPLETED");
          setTournaments(activeMapped);
        } else {
          setTournaments(
            MOCK_TOURNAMENTS
              .map((m) => ({
                ...m,
                status: getEffectiveTournamentStatus(m),
              }))
              .filter((m) => !isTournamentOver(m) && m.status !== "COMPLETED")
              .slice(0, 6)
          );
        }
      } catch (err) {
        console.error("Error loading homepage tournaments:", err);
        setTournaments(
          MOCK_TOURNAMENTS
            .map((m) => ({
              ...m,
              status: getEffectiveTournamentStatus(m),
            }))
            .filter((m) => !isTournamentOver(m) && m.status !== "COMPLETED")
            .slice(0, 6)
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadFeaturedTournaments();
  }, [supabase]);

  // Load registered tournaments for logged-in players
  React.useEffect(() => {
    async function checkUserAndLoadRegs() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);

      const role = (user.user_metadata?.role || "PLAYER").toUpperCase() as "PLAYER" | "ORGANIZER";
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const finalRole = (profile?.role || role || "PLAYER").toUpperCase() as "PLAYER" | "ORGANIZER";
      setUserRole(finalRole);

      // Organizers manage tournaments and don't participate in player registrations
      if (finalRole === "ORGANIZER") {
        return;
      }

      setRegLoading(true);
      try {
        const res = await fetch("/api/player/tournaments");
        if (res.ok) {
          const data = await res.json();
          let seenSet = new Set<string>();
          try {
            const raw = typeof window !== "undefined" ? (localStorage.getItem("playnear_seen_rejected_tournaments") || localStorage.getItem("localsports_seen_rejected_tournaments")) : null;
            if (raw) seenSet = new Set(JSON.parse(raw));
          } catch {}

          const activeRegs = (data.registrations || []).filter((r: any) => {
            if (r.status === "REJECTED") {
              return !(r.dismissed_by_player || seenSet.has(r.id));
            }
            return true;
          });
          setRegistrations(activeRegs.slice(0, 4));
        }
      } catch {
        // silently fail on home page
      } finally {
        setRegLoading(false);
      }
    }
    checkUserAndLoadRegs();
  }, [supabase]);

  // Load featured teams for team directory preview
  React.useEffect(() => {
    async function loadFeaturedTeams() {
      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const data = await res.json();
          if (data.teams && data.teams.length > 0) {
            setTeams(data.teams.slice(0, 6));
          }
        }
      } catch (err) {
        console.error("Error loading homepage teams:", err);
      } finally {
        setTeamsLoading(false);
      }
    }
    loadFeaturedTeams();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/tournaments?search=${encodeURIComponent(searchInput.trim())}`);
    } else {
      router.push("/tournaments");
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* 1. HERO SECTION (Clean, Dynamic Bento with Sports Visual) */}
      <section className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 lg:p-12 border border-[#191314]/[0.08] shadow-[0_16px_45px_rgba(25,19,20,0.05)] space-y-8">
            {/* Ambient Background Glow behind athletes */}
            <div className="absolute top-0 right-0 w-[300px] sm:w-[450px] lg:w-[560px] h-[300px] sm:h-[450px] lg:h-[560px] bg-gradient-to-bl from-sky-100/70 via-[#ecf95a]/20 to-transparent rounded-full blur-3xl pointer-events-none -z-0 translate-x-12 -translate-y-12" />

            {/* Main Content & Athletes Grid */}
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-10">
              {/* Left Column: Headlines, Info & CTAs */}
              <div className="space-y-5 max-w-2xl flex-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f4f4f4] border border-[#191314]/10 text-xs font-bold text-[#191314] shadow-xs">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>The Modern Local Sports Platform</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-[#191314] leading-[1.08]">
                  Organize &amp; Compete in{" "}
                  <span className="bg-[#ecf95a] text-[#191314] px-3 py-0.5 rounded-2xl inline-block mt-1 shadow-xs">
                    Local Sports Tournaments
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                  From automated bracket generation and venue discovery to squad rosters and seamless tournament registration — everything local organizers, team captains, and athletes need.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link href="/tournaments">
                    <Button size="lg" className="gap-2 text-sm bg-[#ecf95a] text-[#191314] hover:bg-[#dbee3b] font-bold rounded-full px-7 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                      Explore Tournaments <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {userRole === "ORGANIZER" ? (
                    <Link href="/organizer">
                      <Button size="lg" className="text-sm bg-[#f4f4f4] text-[#191314] hover:bg-stone-200 rounded-full px-7 font-bold border border-[#191314]/10 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]">
                        Organizer Hub
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/teams/new">
                      <Button size="lg" className="text-sm bg-[#f4f4f4] text-[#191314] hover:bg-stone-200 rounded-full px-7 font-bold border border-[#191314]/10 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]">
                        Create Team
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Trust Badges */}
                <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" /> Automated Brackets
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-500" /> Squad Management
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-emerald-500" /> Live Match Scoring
                  </span>
                </div>
              </div>

              {/* Right Column: Scaled Athletes Illustration & Interactive Floating Chips */}
              <div className="relative lg:w-[460px] xl:w-[500px] shrink-0 flex items-center justify-center pt-4 lg:pt-0">
                <div className="relative w-full max-w-[420px] lg:max-w-none flex items-center justify-center">
                  <img
                    src="/sports-hero-athletes.png"
                    alt="Local Sports Athletes"
                    className="w-full h-auto max-h-[340px] sm:max-h-[380px] lg:max-h-[420px] object-contain drop-shadow-[0_12px_32px_rgba(30,64,175,0.15)] transition-transform duration-500 hover:scale-[1.02] select-none pointer-events-auto"
                  />

                  {/* Floating Pill: Active Leagues */}
                  <div className="absolute top-2 right-2 sm:right-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#191314]/10 shadow-[0_8px_20px_rgba(0,0,0,0.08)] flex items-center gap-2 text-xs font-bold text-[#191314]">
                    <span className="flex h-2 w-2 rounded-full bg-[#ecf95a]" />
                    <span>50+ Local Tournaments</span>
                  </div>

                  {/* Floating Pill: Knockout Brackets */}
                  <div className="absolute bottom-2 left-2 sm:left-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#191314]/10 shadow-[0_8px_20px_rgba(0,0,0,0.08)] flex items-center gap-2 text-xs font-bold text-[#191314]">
                    <span>⚡</span>
                    <span>Live Bracket Updates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Search Bar & Sports */}
            <div className="relative z-10 space-y-4 pt-6 border-t border-[#191314]/[0.08]">
              <form 
                onSubmit={handleSearchSubmit}
                className="bg-[#f4f4f4] p-1.5 rounded-full border border-[#191314]/10 flex flex-col sm:flex-row gap-2 max-w-2xl"
              >
                <div className="flex-1 flex items-center gap-2.5 px-4 py-2 text-[#191314]">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search tournaments (e.g. Mumbai, Football, Cup)..."
                    className="w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder:text-muted-foreground text-[#191314]"
                  />
                </div>
                <Button type="submit" size="sm" className="shrink-0 text-xs bg-[#191314] text-white hover:bg-black rounded-full px-6 font-bold">
                  Search
                </Button>
              </form>

              {/* Quick Sport Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-xs text-muted-foreground font-semibold">Sports:</span>
                {SUPPORTED_SPORTS.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/tournaments?sport=${s.slug}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#191314]/10 bg-white text-[#191314] hover:bg-[#191314] hover:text-white transition-all text-xs font-bold shadow-2xs"
                  >
                    <span>{s.emoji}</span>
                    <span>{s.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED TOURNAMENTS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="zen-pill mb-2">Featured Competitions</div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-[#191314]">
              Upcoming &amp; Ongoing Tournaments
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Browse verified tournaments with online bracket seedings and cash prize pools.
            </p>
          </div>
          <Link href="/tournaments">
            <Button variant="pill" size="sm" className="gap-1.5 font-semibold text-xs border border-[#191314]/15 shrink-0 bg-[#f4f4f4] text-[#191314]">
              View All Tournaments <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#191314]" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-[32px] bg-card space-y-3">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-lg font-bold">No Tournaments Published Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Be the first organizer to create and host a tournament in your city!
            </p>
            <div className="pt-2">
              <Link href="/organizer/tournaments/new">
                <Button size="sm" className="bg-[#ecf95a] text-[#191314] hover:bg-[#dbee3b] font-bold rounded-full">Create First Tournament</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {/* 3. REGISTERED TOURNAMENTS SECTION — visible for logged-in players */}
      {isLoggedIn && (registrations.length > 0 || regLoading) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="zen-pill mb-2">Your Activity</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#191314]">
                Registered Tournaments
              </h2>
            </div>
            <Link href="/registered-tournaments">
              <Button variant="pill" size="sm" className="gap-1.5 font-semibold text-xs border border-[#191314]/15 shrink-0 bg-[#f4f4f4] text-[#191314]">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {regLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#191314]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {registrations.map((reg) => {
                const t = reg.tournament;
                const statusColors: Record<string, string> = {
                  PENDING: "bg-amber-500/15 text-amber-700 border-amber-500/30",
                  APPROVED: "bg-[#ecf95a] text-[#191314] font-bold border-[#191314]/15",
                  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
                };
                const statusLabels: Record<string, string> = {
                  PENDING: "Pending Approval",
                  APPROVED: "Approved ✓",
                  REJECTED: "Rejected",
                };
                return (
                  <Link
                    key={reg.id}
                    href={t?.slug ? `/tournaments/${t.slug}` : "/registered-tournaments"}
                    className="zen-card p-5 hover:border-[#191314]/25 transition-all space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-2xl">{t?.sport?.icon_name || "🏆"}</div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${statusColors[reg.status]}`}>
                        {statusLabels[reg.status]}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {t?.title || "Tournament"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t?.venue_city || ""}{t?.tournament_start_date ? ` • ${formatDate(t.tournament_start_date)}` : ""}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground">
                        Team: <span className="font-semibold text-foreground">{reg.team?.name || "Unknown"}</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. TEAMS DIRECTORY SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="zen-pill mb-2">Local Clubs &amp; Teams</div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-[#191314]">
              Explore Teams &amp; Join a Squad
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Discover local teams in your city, browse player rosters, or create your own club to compete.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {userRole === "ORGANIZER" ? (
              <Link href="/organizer">
                <Button variant="pill" size="sm" className="gap-1.5 font-semibold text-xs border border-[#191314]/15 bg-[#f4f4f4] text-[#191314]">
                  Organizer Hub <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/teams">
                  <Button variant="pill" size="sm" className="gap-1.5 font-semibold text-xs border border-[#191314]/15 bg-[#f4f4f4] text-[#191314]">
                    View Teams Directory <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/teams/new">
                  <Button size="sm" className="gap-1.5 font-bold text-xs bg-[#191314] text-white hover:bg-black rounded-full px-4">
                    <PlusCircle className="h-3.5 w-3.5 text-[#ecf95a]" /> Create Team
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {teamsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : teams.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-border rounded-[32px] bg-card space-y-3">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-lg font-bold">No Teams Registered Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Be the first captain to register your club and recruit players from your city!
            </p>
            {userRole !== "ORGANIZER" ? (
              <div className="pt-1">
                <Link href="/teams/new">
                  <Button variant="lime" size="sm">Create First Team</Button>
                </Link>
              </div>
            ) : (
              <div className="pt-1">
                <Link href="/organizer/tournaments/new">
                  <Button variant="lime" size="sm">Host a Tournament</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => {
              const sportSlug = team.sport?.slug || "";
              const memberCount = team.member_count ?? team.current_players ?? 0;
              const maxPlayers = team.max_players || 15;

              return (
                <div
                  key={team.id}
                  className="zen-card p-6 flex flex-col justify-between transition-all group hover:border-black/25"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform overflow-hidden border border-black/10 shadow-2xs">
                        {team.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              if (e.currentTarget.parentElement) {
                                e.currentTarget.parentElement.innerText = getSportEmoji(sportSlug);
                              }
                            }}
                          />
                        ) : (
                          getSportEmoji(sportSlug)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base leading-tight truncate group-hover:text-primary transition-colors">
                          {team.name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                          {team.city || "Local Team"}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {team.sport && (
                            <span className="text-[10px] bg-black/[0.05] dark:bg-white/10 text-foreground px-2.5 py-0.5 rounded-full font-semibold">
                              {getSportEmoji(sportSlug)} {team.sport.name}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <Users className="h-2.5 w-2.5" />
                            {memberCount}/{maxPlayers} members
                          </span>
                        </div>
                      </div>
                    </div>

                    {team.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {team.bio}
                      </p>
                    )}

                    {team.positions_needed && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Looking for: {team.positions_needed}
                      </p>
                    )}

                    {team.target_tournament && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold w-fit">
                        <Trophy className="h-3 w-3 text-amber-600 shrink-0" />
                        <span>Targeting:</span>
                        <span className="font-bold truncate max-w-[170px]">{team.target_tournament}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-4 border-t border-border/60 flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                      {team.captain?.first_name || team.captain?.full_name ? (
                        <span>Captain: <strong className="text-foreground">{team.captain.first_name || team.captain.full_name.split(" ")[0]}</strong></span>
                      ) : (
                        <span>Open squad</span>
                      )}
                    </div>
                    <Link href={`/teams/${team.id}`}>
                      <Button size="sm" className="text-xs font-semibold rounded-full px-4 bg-[#191314] text-white hover:bg-black">
                        View Team <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. PLATFORM PILLARS / BENTO ECOSYSTEM (Styled in Bento cards with highlighted lime card) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="zen-pill">Our Mission</div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#191314] leading-tight">
            We provide a secure, intuitive, and efficient platform
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Streamlining local sports management so organizers, captains, and athletes can focus on the game.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Organizers */}
          <div className="zen-card p-8 sm:p-9 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#f4f4f4] text-[#191314] flex items-center justify-center border border-[#191314]/10">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#191314]">Tournament Organizers</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create and publish tournaments in minutes. Configure entry fees, set venue locations with Google Maps geocoding, and review team registrations.
              </p>
            </div>
            <ul className="text-xs space-y-2.5 text-muted-foreground pt-4 border-t border-border/60">
              <li className="flex items-center gap-2">✓ Automated Knockout Brackets &amp; Seedings</li>
              <li className="flex items-center gap-2">✓ Google Maps Venue Placements &amp; Geocoding</li>
              <li className="flex items-center gap-2">✓ Team Registration Approvals &amp; Fee Tracking</li>
            </ul>
          </div>

          {/* Card 2: Captains — SIGNATURE LIME BENTO CARD matching the palette */}
          <div className="bg-[#ecf95a] text-[#191314] rounded-[28px] p-8 sm:p-9 space-y-5 flex flex-col justify-between border border-[#191314]/10 shadow-[0_16px_40px_rgba(236,249,90,0.25)]">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#191314] text-white flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-[#191314]">Team Captains &amp; Clubs</h3>
              <p className="text-xs text-[#191314]/80 leading-relaxed font-medium">
                Build your club squad, manage player rosters, approve join requests, and register directly for local tournaments.
              </p>
            </div>
            <ul className="text-xs space-y-2.5 text-[#191314]/90 font-semibold pt-4 border-t border-[#191314]/15">
              <li className="flex items-center gap-2">✓ Full Squad Roster Builder &amp; Profiles</li>
              <li className="flex items-center gap-2">✓ 1-Click Tournament Team Registration</li>
              <li className="flex items-center gap-2">✓ Player Join Requests &amp; Squad Approvals</li>
            </ul>
          </div>

          {/* Card 3: Athletes & Competitors */}
          <div className="zen-card p-8 sm:p-9 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#f4f4f4] text-[#191314] flex items-center justify-center border border-[#191314]/10">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#191314]">Athletes &amp; Competitors</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Find upcoming competitions in your city, discover local teams to join, track your registration status, and get directions to venues.
              </p>
            </div>
            <ul className="text-xs space-y-2.5 text-muted-foreground pt-4 border-t border-border/60">
              <li className="flex items-center gap-2">✓ Search Tournaments by Sport &amp; City</li>
              <li className="flex items-center gap-2">✓ Interactive Brackets &amp; Match Schedules</li>
              <li className="flex items-center gap-2">✓ Turn-by-Turn Google Maps Venue Navigation</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. FREQUENTLY ASKED QUESTIONS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <div className="zen-pill">FAQs</div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#191314]">
            Frequently asked questions
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            We have given answers to the most popular questions below
          </p>
        </div>

        <div className="divide-y divide-[#191314]/10 border-y border-[#191314]/10">
          {/* Question 01 */}
          <div className="py-5">
            <button
              onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}
              className="w-full flex items-center justify-between text-left gap-4 group"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground font-bold">01</span>
                <span className="text-base font-bold text-[#191314] group-hover:text-emerald-700 transition-colors">
                  Is it free to create a team and browse tournaments?
                </span>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                openFaq === 0 ? "bg-[#ecf95a] text-[#191314]" : "bg-[#f4f4f4] text-[#191314]"
              }`}>
                {openFaq === 0 ? "−" : "+"}
              </div>
            </button>
            {openFaq === 0 && (
              <div className="pl-9 pr-12 pt-3 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-200">
                Yes! Creating a squad, adding player rosters, customizing your team logo, and browsing local competitions are completely free. When registering for tournaments that charge entry fees, payments are handled securely via Razorpay.
              </div>
            )}
          </div>

          {/* Question 02 (Expanded by default) */}
          <div className="py-5">
            <button
              onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
              className="w-full flex items-center justify-between text-left gap-4 group"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground font-bold">02</span>
                <span className="text-base font-bold text-[#191314] group-hover:text-emerald-700 transition-colors">
                  Which sports are supported on PlayNear?
                </span>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                openFaq === 1 ? "bg-[#ecf95a] text-[#191314]" : "bg-[#f4f4f4] text-[#191314]"
              }`}>
                {openFaq === 1 ? "−" : "+"}
              </div>
            </button>
            {openFaq === 1 && (
              <div className="pl-9 pr-12 pt-3 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-200 space-y-2">
                <p>
                  PlayNear exclusively focuses on 4 major local sports: <strong>Cricket (🏏)</strong>, <strong>Football (⚽)</strong>, <strong>Kabaddi (🤼)</strong>, and <strong>Volleyball (🏐)</strong>.
                </p>
                <p>
                  Each sport includes custom squad position presets (e.g., Batsman/Bowler, Striker/Midfielder, Raider/Defender, Spiker/Setter) and specialized tournament formats.
                </p>
              </div>
            )}
          </div>

          {/* Question 03 */}
          <div className="py-5">
            <button
              onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
              className="w-full flex items-center justify-between text-left gap-4 group"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground font-bold">03</span>
                <span className="text-base font-bold text-[#191314] group-hover:text-emerald-700 transition-colors">
                  How does live scorekeeping and bracket tracking work?
                </span>
              </div>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                openFaq === 2 ? "bg-[#ecf95a] text-[#191314]" : "bg-[#f4f4f4] text-[#191314]"
              }`}>
                {openFaq === 2 ? "−" : "+"}
              </div>
            </button>
            {openFaq === 2 && (
              <div className="pl-9 pr-12 pt-3 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-200">
                Tournament organizers can update live match scores, sets, and points directly from the Scorekeeper screen. Completed matches automatically advance the winning squads through single elimination and double elimination knockout brackets in real time.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. CTA BANNER (High-contrast Obsidian Bento Container with Lime Button) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#191314] text-white rounded-[32px] sm:rounded-[40px] p-8 sm:p-14 relative overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold">
              Get Started with PlayNear
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Ready to Host or Compete?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Host a local tournament, build your team squad, or register for upcoming competitions in your area today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 z-10">
            <Link href="/organizer/tournaments/new">
              <Button size="lg" className="bg-[#ecf95a] text-[#191314] hover:bg-[#dbee3b] font-extrabold rounded-full px-7 py-3.5 text-xs sm:text-sm shadow-md gap-2">
                <PlusCircle className="h-4 w-4" />
                Host a Tournament
              </Button>
            </Link>
            <Link href="/tournaments">
              <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full px-6 py-3.5 text-xs sm:text-sm border border-white/15 gap-2">
                <Trophy className="h-4 w-4 text-[#ecf95a]" />
                Browse Tournaments
              </Button>
            </Link>
            {userRole === "ORGANIZER" ? (
              <Link href="/organizer">
                <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full px-6 py-3.5 text-xs sm:text-sm border border-white/15 gap-2">
                  <Trophy className="h-4 w-4" />
                  Organizer Hub
                </Button>
              </Link>
            ) : (
              <Link href="/teams">
                <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full px-6 py-3.5 text-xs sm:text-sm border border-white/15 gap-2">
                  <Users className="h-4 w-4" />
                  Explore Teams
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
