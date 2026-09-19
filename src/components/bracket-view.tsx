"use client";

import * as React from "react";
import Link from "next/link";
import { Match, Team } from "@/types/database.types";
import { Badge } from "./ui/badge";
import { formatDateTime, cn } from "@/lib/utils";
import { Trophy, Clock, ChevronRight, Activity } from "lucide-react";

interface BracketViewProps {
  matches: Match[];
  teams?: Team[];
}

export function BracketView({ matches, teams = [] }: BracketViewProps) {
  // Group matches by round number
  const roundsMap = React.useMemo(() => {
    const map: Record<number, Match[]> = {};
    matches.forEach((m) => {
      if (!map[m.round_number]) {
        map[m.round_number] = [];
      }
      map[m.round_number].push(m);
    });
    return map;
  }, [matches]);

  const roundNumbers = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b);

  const getRoundTitle = (round: number, totalRounds: number) => {
    const diff = totalRounds - round;
    if (diff === 0) return "Grand Final 🏆";
    if (diff === 1) return "Semi-Finals";
    if (diff === 2) return "Quarter-Finals";
    if (diff === 3) return "Round of 16";
    return `Round ${round}`;
  };

  const getTeam = (teamId?: string | null) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId) || null;
  };

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-card">
        <Trophy className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <h4 className="text-base font-semibold">Brackets not yet generated</h4>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          The tournament organizer will generate the match brackets once team registrations close.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-6 pt-2">
      <div className="flex items-stretch gap-8 min-w-[750px] px-2">
        {roundNumbers.map((round) => {
          const roundMatches = roundsMap[round];
          const isFinal = round === roundNumbers.length;

          return (
            <div key={round} className="flex-1 min-w-[280px] max-w-[340px] flex flex-col">
              {/* Round Header */}
              <div className="sticky top-0 z-10 mb-4 bg-background/90 backdrop-blur py-2 border-b border-border text-center">
                <h4 className="font-bold text-sm text-foreground flex items-center justify-center gap-2">
                  {getRoundTitle(round, roundNumbers.length)}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {roundMatches.length} {roundMatches.length === 1 ? "Match" : "Matches"}
                </p>
              </div>

              {/* Match Cards List */}
              <div className="flex flex-col justify-around flex-grow gap-6">
                {roundMatches.map((match) => {
                  const homeTeam = match.home_team || getTeam(match.home_team_id);
                  const awayTeam = match.away_team || getTeam(match.away_team_id);
                  const isLive = match.status === "IN_PROGRESS";
                  const isCompleted = match.status === "COMPLETED";

                  const homeIsWinner = match.winner_team_id && match.winner_team_id === match.home_team_id;
                  const awayIsWinner = match.winner_team_id && match.winner_team_id === match.away_team_id;

                  return (
                    <div
                      key={match.id}
                      className={cn(
                        "rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md relative overflow-hidden",
                        isLive ? "border-red-500/80 ring-1 ring-red-500/40" : "border-border"
                      )}
                    >
                      {/* Match Header Info */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 pb-1.5 border-b border-border/50">
                        <span className="font-medium">Match #{match.match_number}</span>
                        {isLive ? (
                          <Badge variant="live" className="text-[10px] px-2 py-0">
                            LIVE
                          </Badge>
                        ) : isCompleted ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Final
                          </Badge>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {match.start_time ? formatDateTime(match.start_time) : "TBD"}
                          </span>
                        )}
                      </div>

                      {/* Home Team */}
                      <div
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          homeIsWinner ? "bg-emerald-500/10 font-bold text-foreground" : "hover:bg-muted/50",
                          !homeTeam && "text-muted-foreground italic text-xs"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {homeTeam?.logo_url ? (
                            <img src={homeTeam.logo_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {homeTeam?.name?.substring(0, 1) || "?"}
                            </div>
                          )}
                          <span className="truncate text-sm">
                            {homeTeam?.name || "TBD (Waiting)"}
                          </span>
                        </div>
                        <span className={cn(
                          "text-sm font-mono px-2 py-0.5 rounded",
                          homeIsWinner ? "bg-emerald-600 text-white font-bold" : "bg-muted text-foreground"
                        )}>
                          {match.home_score}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors mt-1",
                          awayIsWinner ? "bg-emerald-500/10 font-bold text-foreground" : "hover:bg-muted/50",
                          !awayTeam && "text-muted-foreground italic text-xs"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {awayTeam?.logo_url ? (
                            <img src={awayTeam.logo_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {awayTeam?.name?.substring(0, 1) || "?"}
                            </div>
                          )}
                          <span className="truncate text-sm">
                            {awayTeam?.name || "TBD (Waiting)"}
                          </span>
                        </div>
                        <span className={cn(
                          "text-sm font-mono px-2 py-0.5 rounded",
                          awayIsWinner ? "bg-emerald-600 text-white font-bold" : "bg-muted text-foreground"
                        )}>
                          {match.away_score}
                        </span>
                      </div>

                      {/* Pitch / Location footer */}
                      {match.court_or_pitch && (
                        <div className="mt-2 pt-1 text-[11px] text-muted-foreground text-center bg-muted/30 rounded py-0.5">
                          📍 {match.court_or_pitch}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
