"use client";

import * as React from "react";
import { Match, Team, MatchEvent } from "@/types/database.types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  Minus, 
  Flag, 
  ShieldAlert,
  Send,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScorekeeperPadProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  sportSlug?: string;
  onSaveScore?: (homeScore: string, awayScore: string, status: Match['status'], winnerId: string | null) => void;
}

export function ScorekeeperPad({
  match,
  homeTeam,
  awayTeam,
  sportSlug = "football",
  onSaveScore,
}: ScorekeeperPadProps) {
  const [homeScore, setHomeScore] = React.useState<number>(parseInt(match.home_score, 10) || 0);
  const [awayScore, setAwayScore] = React.useState<number>(parseInt(match.away_score, 10) || 0);
  const [status, setStatus] = React.useState<Match['status']>(match.status);
  const [events, setEvents] = React.useState<string[]>([
    "Match kickoff initialized",
    "First half in progress",
  ]);
  const [eventInput, setEventInput] = React.useState("");
  const [isSaved, setIsSaved] = React.useState(false);

  const handleScoreChange = (team: "home" | "away", delta: number) => {
    if (team === "home") {
      setHomeScore((prev) => {
        const next = Math.max(0, prev + delta);
        if (delta > 0) {
          logEvent(`Goal / Score for ${homeTeam.name}! (${next}-${awayScore})`);
        }
        return next;
      });
    } else {
      setAwayScore((prev) => {
        const next = Math.max(0, prev + delta);
        if (delta > 0) {
          logEvent(`Goal / Score for ${awayTeam.name}! (${homeScore}-${next})`);
        }
        return next;
      });
    }
  };

  const logEvent = (desc: string) => {
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setEvents((prev) => [`[${timeString}] ${desc}`, ...prev]);
  };

  const handleCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventInput.trim()) return;
    logEvent(eventInput.trim());
    setEventInput("");
  };

  const handleSave = () => {
    let winnerId: string | null = null;
    if (status === "COMPLETED") {
      if (homeScore > awayScore) winnerId = homeTeam.id;
      else if (awayScore > homeScore) winnerId = awayTeam.id;
    }
    onSaveScore?.(homeScore.toString(), awayScore.toString(), status, winnerId);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Status Controller */}
      <div className="bg-card border border-border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Match Status:</span>
            {status === "IN_PROGRESS" && (
              <Badge variant="live" className="gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE
              </Badge>
            )}
            {status === "SCHEDULED" && <Badge variant="outline">Scheduled</Badge>}
            {status === "COMPLETED" && <Badge variant="success">Final Whistle / Completed</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "SCHEDULED" && (
            <Button
              variant="sports"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setStatus("IN_PROGRESS");
                logEvent("Match started by referee");
              }}
            >
              <Play className="h-3.5 w-3.5" /> Start Match
            </Button>
          )}

          {status === "IN_PROGRESS" && (
            <Button
              variant="success"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setStatus("COMPLETED");
                logEvent("Match completed / Final score confirmed");
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Finish Match
            </Button>
          )}

          {status === "COMPLETED" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                setStatus("IN_PROGRESS");
                logEvent("Match status reopened");
              }}
            >
              <RotateCcw className="h-3 w-3" /> Reopen Match
            </Button>
          )}
        </div>
      </div>

      {/* Main Scoreboard Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* HOME TEAM PAD */}
        <div className="bg-card border-2 border-primary/30 p-6 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="flex flex-col items-center gap-2">
            {homeTeam.logo_url ? (
              <img src={homeTeam.logo_url} alt="" className="w-12 h-12 rounded-full object-cover shadow" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg">
                {homeTeam.name.substring(0, 1)}
              </div>
            )}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Home Squad</span>
              <h3 className="text-xl font-bold">{homeTeam.name}</h3>
            </div>
          </div>

          <div className="text-7xl font-extrabold font-mono text-primary py-2 select-none">
            {homeScore}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl text-lg font-bold border-border hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleScoreChange("home", -1)}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              variant="sports"
              className="h-12 px-6 rounded-xl text-base font-bold gap-2"
              onClick={() => handleScoreChange("home", 1)}
            >
              <Plus className="h-5 w-5" /> +1 Point / Goal
            </Button>
          </div>
        </div>

        {/* AWAY TEAM PAD */}
        <div className="bg-card border-2 border-indigo-500/30 p-6 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="flex flex-col items-center gap-2">
            {awayTeam.logo_url ? (
              <img src={awayTeam.logo_url} alt="" className="w-12 h-12 rounded-full object-cover shadow" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-lg">
                {awayTeam.name.substring(0, 1)}
              </div>
            )}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Away Squad</span>
              <h3 className="text-xl font-bold">{awayTeam.name}</h3>
            </div>
          </div>

          <div className="text-7xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 py-2 select-none">
            {awayScore}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl text-lg font-bold border-border hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleScoreChange("away", -1)}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              variant="sports"
              className="h-12 px-6 rounded-xl text-base font-bold gap-2 from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              onClick={() => handleScoreChange("away", 1)}
            >
              <Plus className="h-5 w-5" /> +1 Point / Goal
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Incident / Event Logger */}
      <div className="bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" /> Live Match Events Log
        </h4>

        <form onSubmit={handleCustomEvent} className="flex gap-2">
          <input
            type="text"
            placeholder="Add match event (e.g. Yellow card #7, 30-yard free kick goal, substitution...)"
            value={eventInput}
            onChange={(e) => setEventInput(e.target.value)}
            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" size="sm" variant="secondary" className="gap-1">
            <Send className="h-3.5 w-3.5" /> Log
          </Button>
        </form>

        <div className="bg-muted/40 rounded-xl p-3 max-h-44 overflow-y-auto space-y-1.5 text-xs font-mono">
          {events.map((ev, idx) => (
            <div key={idx} className="text-muted-foreground">
              {ev}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Save & Publish Button */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-2xl">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>Saving updates public bracket standings automatically.</span>
        </div>

        <Button variant="sports" size="lg" onClick={handleSave} className="gap-2 font-bold">
          <CheckCircle2 className="h-5 w-5" />
          {isSaved ? "Saved & Published!" : "Save & Publish Result"}
        </Button>
      </div>
    </div>
  );
}
