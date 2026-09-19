import Link from "next/link";
import Image from "next/image";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  DollarSign, 
  ArrowRight,
  Zap
} from "lucide-react";
import { Tournament } from "@/types/database.types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getEffectiveTournamentStatus, isTournamentRegistrationOpen } from "@/lib/tournament-status";

interface TournamentCardProps {
  tournament: Tournament;
  viewMode?: "grid" | "list";
}

export function TournamentCard({ tournament, viewMode = "grid" }: TournamentCardProps) {
  const effectiveStatus = getEffectiveTournamentStatus(tournament);
  const isOngoing = effectiveStatus === "ONGOING";
  const isOpen = isTournamentRegistrationOpen(tournament);
  const spotsLeft = tournament.max_teams - (tournament.registered_count ?? 0);

  const getStatusBadge = () => {
    switch (effectiveStatus) {
      case "ONGOING":
        return <Badge variant="live" className="gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE NOW</Badge>;
      case "REGISTRATION_OPEN":
        return <Badge variant="success">Registration Open</Badge>;
      case "REGISTRATION_CLOSED":
        return <Badge variant="warning">Registration Closed</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{effectiveStatus.replace(/_/g, " ")}</Badge>;
    }
  };

  const getFormatLabel = () => {
    switch (tournament.format) {
      case "SINGLE_ELIMINATION":
        return "Single Knockout";
      case "DOUBLE_ELIMINATION":
        return "Double Knockout";
      case "ROUND_ROBIN":
        return "Round Robin League";
      case "GROUP_PLUS_KNOCKOUT":
        return "Groups + Knockout";
      default:
        return tournament.format;
    }
  };

  return (
    <div className="group relative rounded-[28px] border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1a1d20] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.08)] transition-all hover:border-black/20 flex flex-col justify-between">
      {/* Banner / Header */}
      <div>
        <div className="relative h-44 w-full bg-muted overflow-hidden">
          {tournament.banner_url ? (
            <img
              src={tournament.banner_url}
              alt={tournament.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#191314] text-white">
              <Trophy className="h-12 w-12 text-[#ecf95a]/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {getStatusBadge()}
              <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10">
                {getFormatLabel()}
              </span>
            </div>
            <div className="bg-[#ecf95a] text-[#191314] font-extrabold text-xs px-3 py-1 rounded-full shadow-xs">
              {formatCurrency(tournament.entry_fee, tournament.currency)}
            </div>
          </div>

          {/* Bottom Title Info */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-lg font-bold text-white leading-tight line-clamp-1 group-hover:text-blue-300 transition-colors">
              {tournament.title}
            </h3>
            <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="truncate">{tournament.venue_name}, {tournament.venue_city}</span>
            </p>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {tournament.description}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{formatDate(tournament.tournament_start_date)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {tournament.registered_count ?? 0}/{tournament.max_teams} Teams
                {isOpen && spotsLeft > 0 && spotsLeft <= 3 && (
                  <span className="ml-1 text-amber-600 font-semibold">({spotsLeft} left!)</span>
                )}
              </span>
            </div>
          </div>

          {tournament.prize_pool && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 rounded-lg font-medium">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{tournament.prize_pool}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pt-0">
        <Link href={`/tournaments/${tournament.slug}`}>
          <Button size="sm" className="w-full justify-between rounded-full bg-[#191314] text-white hover:bg-black text-xs font-semibold px-4 py-2.5 group/btn">
            <span>View Tournament & Brackets</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform text-[#ecf95a]" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
