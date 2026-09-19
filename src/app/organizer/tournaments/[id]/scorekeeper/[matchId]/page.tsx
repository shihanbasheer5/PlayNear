"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Trophy, 
  Activity, 
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { MOCK_MATCHES, MOCK_TEAMS, MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { ScorekeeperPad } from "@/components/scorekeeper-pad";
import { Button } from "@/components/ui/button";

export default function ScorekeeperPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.matchId as string;
  const tourneyId = params?.id as string;

  const match = MOCK_MATCHES.find((m) => m.id === matchId) || MOCK_MATCHES[4]; // Match 5 is Semi-Final
  const tournament = MOCK_TOURNAMENTS.find((t) => t.id === tourneyId) || MOCK_TOURNAMENTS[0];

  const homeTeam = MOCK_TEAMS.find((t) => t.id === match.home_team_id) || MOCK_TEAMS[0];
  const awayTeam = MOCK_TEAMS.find((t) => t.id === match.away_team_id) || MOCK_TEAMS[3];

  const handleScoreSaved = (
    homeScore: string,
    awayScore: string,
    status: string,
    winnerId: string | null
  ) => {
    // In production with Supabase, this invokes a Server Action updating public.matches
    console.log("Score update dispatched to Supabase:", {
      matchId: match.id,
      homeScore,
      awayScore,
      status,
      winnerId,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to {tournament.title}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-red-500" /> Referee & Scorer Live Console
          </h1>
          <p className="text-xs text-muted-foreground">
            Match #{match.match_number} • Round {match.round_number} (Semi-Final) • {match.court_or_pitch || "Main Pitch"}
          </p>
        </div>

        <Link href={`/tournaments/${tournament.slug}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" /> View Public Bracket
          </Button>
        </Link>
      </div>

      {/* Main Scorekeeper Interactive Pad */}
      <ScorekeeperPad
        match={match}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        sportSlug="football"
        onSaveScore={handleScoreSaved}
      />
    </div>
  );
}
