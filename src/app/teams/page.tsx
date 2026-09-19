"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  PlusCircle,
  MapPin,
  Users,
  ChevronRight,
  Filter,
  X,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_SPORTS, getSportEmoji } from "@/lib/sports-config";

interface TeamCard {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  bio: string | null;
  logo_url?: string | null;
  target_tournament?: string | null;
  positions_needed: string | null;
  current_players: number | null;
  max_players: number | null;
  member_count: number;
  sport: {
    id: string;
    name: string;
    slug: string;
  } | null;
  captain: {
    full_name: string;
    first_name: string | null;
  } | null;
}

function TeamsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [userRole, setUserRole] = React.useState<"PLAYER" | "ORGANIZER" | null>(null);
  const [teams, setTeams] = React.useState<TeamCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [sportFilter, setSportFilter] = React.useState(searchParams.get("sport")?.toLowerCase() || "");
  const [cityFilter, setCityFilter] = React.useState(searchParams.get("city") || "");
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get("search") || searchParams.get("target") || "");
  const [searched, setSearched] = React.useState(false);

  // Check role: hosts are strictly for tournament creation and managing, not teams
  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = (profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase() as "PLAYER" | "ORGANIZER";
        setUserRole(role);
        if (role === "ORGANIZER") {
          router.replace("/organizer");
        }
      }
    });
  }, [supabase, router]);

  const fetchTeams = React.useCallback(async (overrideSport?: string, overrideCity?: string, overrideSearch?: string) => {
    const s = overrideSport !== undefined ? overrideSport : sportFilter;
    const c = overrideCity !== undefined ? overrideCity : cityFilter;
    const q = overrideSearch !== undefined ? overrideSearch : searchTerm;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("sport", s);
      if (c.trim()) params.set("city", c.trim());
      if (q.trim()) params.set("search", q.trim());

      const res = await fetch(`/api/teams?${params.toString()}`);
      const data = await res.json();
      setTeams(data.teams || []);
      setSearched(true);
    } catch {
      setTeams([]);
      setSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, [sportFilter, cityFilter, searchTerm]);

  // React when URL searchParams change (e.g. navigation via Link)
  React.useEffect(() => {
    const s = (searchParams.get("sport") || "").toLowerCase().trim();
    const c = (searchParams.get("city") || "").trim();
    const q = (searchParams.get("search") || searchParams.get("target") || "").trim();
    setSportFilter(s);
    setCityFilter(c);
    setSearchTerm(q);
    fetchTeams(s, c, q);
  }, [searchParams]);

  const clearFilters = () => {
    setSportFilter("");
    setCityFilter("");
    setSearchTerm("");
    fetchTeams("", "", "");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const hasFilters = sportFilter || cityFilter || searchTerm;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-xs font-semibold tracking-wide text-foreground mb-3">
            <Users className="h-3 w-3 text-emerald-600" />
            <span>COMMUNITY CLUBS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#191314]">
            Find a Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Browse local registered squads, recruit players, or request to join a roster.
          </p>
        </div>
        {userRole !== "ORGANIZER" && (
          <Link href="/teams/new">
            <Button variant="default" className="gap-2 bg-[#191314] text-white hover:bg-black rounded-full px-5 h-11 text-xs font-bold shadow-sm">
              <PlusCircle className="h-4 w-4 text-[#ecf95a]" /> Create Team
            </Button>
          </Link>
        )}
      </div>

      {/* Filters Bento Card */}
      <div className="bg-white border border-[#191314]/[0.08] rounded-[28px] p-6 space-y-4 shadow-[0_4px_24px_rgba(25,19,20,0.03)]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filter Squads
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sport Filter */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sport</label>
            <select
              value={sportFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSportFilter(val);
                fetchTeams(val, cityFilter, searchTerm);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  if (val) url.searchParams.set("sport", val);
                  else url.searchParams.delete("sport");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className="w-full bg-[#f4f4f4] border border-[#191314]/10 rounded-full px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#191314] text-[#191314]"
            >
              <option value="">All Sports</option>
              {SUPPORTED_SPORTS.map((sport) => (
                <option key={sport.slug} value={sport.slug}>
                  {sport.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Location / City</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="e.g. Mumbai, Delhi..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="pl-10 rounded-full bg-[#f4f4f4] border-[#191314]/10 text-sm h-11 text-[#191314]"
                onKeyDown={(e) => e.key === "Enter" && fetchTeams()}
              />
            </div>
          </div>

          {/* Search by name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Team Name</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full bg-[#f4f4f4] border-[#191314]/10 text-sm h-11 text-[#191314]"
                onKeyDown={(e) => e.key === "Enter" && fetchTeams()}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <Button onClick={() => fetchTeams()} variant="default" size="sm" className="gap-2 bg-[#191314] text-white hover:bg-black rounded-full px-5 h-9 font-bold text-xs">
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
          {hasFilters && (
            <Button onClick={clearFilters} variant="outline" size="sm" className="gap-2 rounded-full border-[#191314]/10 text-xs font-semibold h-9">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#191314] border-t-transparent" />
        </div>
      ) : teams.length === 0 && searched ? (
        <div className="text-center py-16 space-y-3 bg-white border border-dashed border-[#191314]/15 rounded-[28px] p-8">
          <div className="text-5xl">🏆</div>
          <p className="text-lg font-bold text-[#191314]">No teams found</p>
          <p className="text-sm text-muted-foreground font-medium">
            {hasFilters ? "Try adjusting your search criteria or city filters." : "Be the first to create a team!"}
          </p>
          {userRole !== "ORGANIZER" && (
            <Link href="/teams/new">
              <Button variant="default" className="gap-2 mt-2 bg-[#191314] text-white hover:bg-black rounded-full font-bold text-xs px-5">
                <PlusCircle className="h-4 w-4 text-[#ecf95a]" /> Create a Team
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {searched && (
            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                {sportFilter ? (
                  <>
                    <span>Showing</span>
                    <span className="font-bold text-foreground bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full capitalize">
                      {getSportEmoji(sportFilter)} {sportFilter}
                    </span>
                    <span>squads ({teams.length} found)</span>
                  </>
                ) : (
                  `${teams.length} team${teams.length !== 1 ? "s" : ""} registered in community`
                )}
              </p>
              {sportFilter && (
                <button
                  onClick={() => {
                    setSportFilter("");
                    fetchTeams("", cityFilter, searchTerm);
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href);
                      url.searchParams.delete("sport");
                      window.history.replaceState({}, "", url.toString());
                    }
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View all sports
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {teams.map((team) => {
              const sportSlug = team.sport?.slug || "";
              const memberCount = team.member_count ?? team.current_players ?? 0;
              const maxPlayers = team.max_players || 15;

              return (
                <div
                  key={team.id}
                  className="bg-white border border-[#191314]/[0.08] hover:border-[#191314]/20 hover:shadow-[0_8px_30px_rgba(25,19,20,0.06)] rounded-[28px] p-6 flex flex-col justify-between transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-[#f4f4f4] flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-[#191314]/10 shadow-sm">
                      {team.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        getSportEmoji(sportSlug)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-base text-[#191314] leading-tight truncate">{team.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        {team.city || "Location not set"}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {team.sport && (
                          <span className="text-[10px] bg-black/5 text-[#191314] px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                            {getSportEmoji(sportSlug)} {team.sport.name.toUpperCase()}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground bg-[#f4f4f4] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          <Users className="h-2.5 w-2.5" />
                          {memberCount}/{maxPlayers} roster
                        </span>
                      </div>
                    </div>
                  </div>

                  {team.bio && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed font-medium">
                      {team.bio}
                    </p>
                  )}

                  {team.positions_needed && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold w-fit">
                      <span>Recruiting:</span>
                      <span className="font-normal">{team.positions_needed}</span>
                    </div>
                  )}

                  {/* Target / Next Tournament Badge */}
                  {team.target_tournament && (
                    <div className="mt-3 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Trophy className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Target Tournament</p>
                        <p className="text-xs font-bold text-[#191314] dark:text-foreground truncate">{team.target_tournament}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 mt-4 border-t border-[#191314]/5 flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground font-medium">
                      {team.captain?.first_name || team.captain?.full_name
                        ? `Captain: ${team.captain.first_name || team.captain.full_name.split(" ")[0]}`
                        : ""}
                    </div>
                    <Link href={`/teams/${team.id}`}>
                      <Button variant="outline" size="sm" className="text-xs font-bold gap-1 rounded-full border-[#191314]/10 hover:bg-[#191314] hover:text-white transition-colors">
                        View Team <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <React.Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-16 text-center text-muted-foreground text-sm">Loading teams directory...</div>}>
      <TeamsContent />
    </React.Suspense>
  );
}
