"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { 
  Trophy, 
  Search, 
  Filter, 
  Map, 
  Grid, 
  X,
  MapPin,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { Button } from "@/components/ui/button";
import { SUPPORTED_SPORTS, getSportEmoji } from "@/lib/sports-config";
import { Tournament } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { getEffectiveTournamentStatus, isTournamentOver } from "@/lib/tournament-status";
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/components/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] sm:h-[600px] lg:h-[680px] rounded-3xl border border-border bg-card flex flex-col items-center justify-center gap-3 shadow-sm">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Map className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading interactive venues map…</p>
      </div>
    ),
  }
);

function TournamentsContent() {
  const searchParams = useSearchParams();
  const initialSport = searchParams.get("sport") || "all";
  const initialCity = searchParams.get("city") || "all";
  const initialQuery = searchParams.get("search") || "";

  const supabase = createClient();
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchQuery, setSearchQuery] = React.useState(initialQuery);
  const [selectedSport, setSelectedSport] = React.useState<string>(initialSport);
  const [selectedCity, setSelectedCity] = React.useState<string>(initialCity);
  const [selectedFormat, setSelectedFormat] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "map">("grid");

  // Keep state synced if URL params change
  React.useEffect(() => {
    if (searchParams.get("sport")) setSelectedSport(searchParams.get("sport")!);
    if (searchParams.get("city")) setSelectedCity(searchParams.get("city")!);
    if (searchParams.get("search")) setSearchQuery(searchParams.get("search")!);
  }, [searchParams]);

  const loadTournaments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournaments")
        .select(`
          *,
          sport:sports(id, name, slug, icon_name),
          organizer:profiles(id, full_name, first_name),
          tournament_teams(id, status)
        `)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data.map((t: Record<string, unknown>) => {
          const teamRows = (t.tournament_teams as Array<{ id: string; status: string }> | null) || [];
          const approvedCount = teamRows.filter((tt) => tt.status === "APPROVED").length;
          const displayTitle = (t.title || t.name || "Tournament") as string;
          const displayCity = (t.venue_city || t.city || "") as string;
          const displayAddress = (t.venue_address || t.address || displayCity || "Local Venue") as string;
          
          const rawTourney = {
            ...t,
            title: displayTitle,
            name: displayTitle,
            venue_city: displayCity,
            venue_address: displayAddress,
            registered_count: approvedCount,
            tournament_teams: undefined,
          } as unknown as Tournament;

          const effectiveStatus = getEffectiveTournamentStatus(rawTourney);

          return {
            ...rawTourney,
            status: effectiveStatus,
          };
        });
        setTournaments(mapped);
      } else {
        setTournaments(
          MOCK_TOURNAMENTS.map((m) => ({
            ...m,
            status: getEffectiveTournamentStatus(m),
          }))
        );
      }
    } catch (err) {
      console.error("Error loading tournaments from database:", err);
      setTournaments(
        MOCK_TOURNAMENTS.map((m) => ({
          ...m,
          status: getEffectiveTournamentStatus(m),
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  // Extract distinct cities from active tournaments
  const availableCities = React.useMemo(() => {
    const cities = new Set<string>();
    tournaments.forEach((t) => {
      // Exclude over tournaments from city filters unless explicitly viewing completed
      if (selectedStatus === "all" && (isTournamentOver(t) || t.status === "COMPLETED")) {
        return;
      }
      const c = t.venue_city?.trim();
      if (c) cities.add(c);
    });
    return Array.from(cities).sort();
  }, [tournaments, selectedStatus]);

  const filteredTournaments = React.useMemo(() => {
    return tournaments.filter((t) => {
      const titleStr = (t.title || "").toLowerCase();
      const venueStr = (t.venue_name || "").toLowerCase();
      const cityStr = (t.venue_city || "").toLowerCase();
      const queryStr = searchQuery.trim().toLowerCase();

      // Search match
      const matchSearch =
        queryStr === "" ||
        titleStr.includes(queryStr) ||
        venueStr.includes(queryStr) ||
        cityStr.includes(queryStr);

      // Sport match — check slug or sport_id
      const sportSlug = t.sport?.slug || "";
      const matchSport =
        selectedSport === "all" ||
        sportSlug === selectedSport ||
        t.sport_id === selectedSport;

      // City match
      const matchCity =
        selectedCity === "all" ||
        cityStr === selectedCity.toLowerCase() ||
        cityStr.includes(selectedCity.toLowerCase());

      // Format match
      const matchFormat =
        selectedFormat === "all" || t.format === selectedFormat;

      // Status match:
      // When "all": automatically hide any tournament whose date is over!
      const isOver = isTournamentOver(t) || t.status === "COMPLETED";
      let matchStatus = false;

      if (selectedStatus === "all") {
        matchStatus = !isOver;
      } else if (selectedStatus === "COMPLETED") {
        matchStatus = isOver;
      } else {
        matchStatus = !isOver && t.status === selectedStatus;
      }

      return matchSearch && matchSport && matchCity && matchFormat && matchStatus;
    });
  }, [tournaments, searchQuery, selectedSport, selectedCity, selectedFormat, selectedStatus]);

  const overCount = React.useMemo(() => {
    return tournaments.filter((t) => isTournamentOver(t) || t.status === "COMPLETED").length;
  }, [tournaments]);

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedSport !== "all" ||
    selectedCity !== "all" ||
    selectedFormat !== "all" ||
    selectedStatus !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSport("all");
    setSelectedCity("all");
    setSelectedFormat("all");
    setSelectedStatus("all");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-xs font-semibold tracking-wide text-foreground mb-3">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>COMMUNITY MATCHES</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#191314]">
            Discover Tournaments
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">
            Browse verified local tournaments, view brackets, and register your team.
          </p>
        </div>

        {/* Controls: Refresh & View Mode Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 text-xs font-semibold rounded-full border-[#191314]/10 hover:bg-[#f4f4f4]"
            onClick={loadTournaments}
            disabled={isLoading}
            title="Refresh tournaments list and clear concluded events"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="flex items-center bg-[#f4f4f4] p-1 rounded-full border border-[#191314]/5 shrink-0 w-fit">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className={`gap-2 h-8 text-xs font-semibold rounded-full ${
                viewMode === "grid" ? "bg-[#191314] text-white shadow-sm hover:bg-black" : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-3.5 w-3.5" />
              Grid View
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              className={`gap-2 h-8 text-xs font-semibold rounded-full ${
                viewMode === "map" ? "bg-[#191314] text-white shadow-sm hover:bg-black" : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("map")}
            >
              <Map className="h-3.5 w-3.5" />
              Map View
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar (Zen Bento Card) */}
      <div className="bg-white border border-[#191314]/[0.08] p-5 sm:p-6 rounded-[28px] space-y-4 shadow-[0_4px_24px_rgba(25,19,20,0.03)]">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by tournament title, venue ground, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[#f4f4f4] border border-[#191314]/10 rounded-full text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#191314] transition-all text-[#191314]"
          />
        </div>

        {/* Sport filters pills — ONLY 4 supported sports */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-muted-foreground font-semibold shrink-0 pr-1">Sport:</span>
          <button
            onClick={() => setSelectedSport("all")}
            className={`px-4 py-1.5 rounded-full shrink-0 font-semibold transition-all ${
              selectedSport === "all"
                ? "bg-[#191314] text-white shadow-sm"
                : "bg-[#f4f4f4] hover:bg-stone-200/80 text-muted-foreground"
            }`}
          >
            All Sports
          </button>
          {SUPPORTED_SPORTS.map((s) => (
            <button
              key={s.slug}
              onClick={() => setSelectedSport(s.slug)}
              className={`px-4 py-1.5 rounded-full shrink-0 font-semibold transition-all ${
                selectedSport === s.slug
                  ? "bg-[#191314] text-white shadow-sm"
                  : "bg-[#f4f4f4] hover:bg-stone-200/80 text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* City Filter Pills (if available from database) */}
        {availableCities.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground font-semibold shrink-0 flex items-center gap-1 pr-1">
              <MapPin className="h-3 w-3 text-emerald-600" /> City:
            </span>
            <button
              onClick={() => setSelectedCity("all")}
              className={`px-3.5 py-1.5 rounded-full shrink-0 font-semibold transition-all ${
                selectedCity === "all"
                  ? "bg-[#ecf95a] text-[#191314] shadow-sm font-bold"
                  : "bg-[#f4f4f4] hover:bg-stone-200/80 text-muted-foreground"
              }`}
            >
              All Cities
            </button>
            {availableCities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3.5 py-1.5 rounded-full shrink-0 font-semibold transition-all ${
                  selectedCity.toLowerCase() === city.toLowerCase()
                    ? "bg-[#ecf95a] text-[#191314] shadow-sm font-bold"
                    : "bg-[#f4f4f4] hover:bg-stone-200/80 text-muted-foreground"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Secondary filters (City Dropdown, Format & Status) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#191314]/5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-[#f4f4f4] border border-[#191314]/10 rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#191314] text-[#191314]"
              >
                <option value="all">All Cities</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#f4f4f4] border border-[#191314]/10 rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#191314] text-[#191314]"
              >
                <option value="all">Active Tournaments</option>
                <option value="REGISTRATION_OPEN">Registration Open</option>
                <option value="ONGOING">Live / Ongoing</option>
                <option value="COMPLETED">
                  Past / Concluded {overCount > 0 ? `(${overCount})` : ""}
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Format:</span>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="bg-[#f4f4f4] border border-[#191314]/10 rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#191314] text-[#191314]"
              >
                <option value="all">All Formats</option>
                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="GROUP_PLUS_KNOCKOUT">Group + Knockout</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedStatus === "all" && overCount > 0 && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline font-medium">
                ({overCount} concluded tournament{overCount > 1 ? "s" : ""} hidden)
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid View or Map View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent" />
        </div>
      ) : viewMode === "map" ? (
        <div className="space-y-4">
          <MapView tournaments={filteredTournaments} />
          <p className="text-xs text-muted-foreground text-center font-medium">
            Click any pin on the map to see venue directions and tournament details.
          </p>
        </div>
      ) : (
        <div>
          {filteredTournaments.length === 0 ? (
            <div className="p-16 text-center border border-dashed border-black/15 rounded-[28px] bg-white space-y-3">
              <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-lg font-bold text-[#191314]">No Tournaments Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">
                {hasActiveFilters 
                  ? `No tournaments match your current filters (Sport: ${selectedSport}, City: ${selectedCity}). Try resetting filters.` 
                  : "No tournaments created yet in the database. When an organizer publishes a tournament, it will immediately appear here."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-full font-semibold">
                  Reset Search Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <TournamentsContent />
    </React.Suspense>
  );
}
