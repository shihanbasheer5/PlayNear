"use client";

import * as React from "react";
import Link from "next/link";
import {
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Calendar,
  CreditCard,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Wallet,
  X,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isTournamentOver } from "@/lib/tournament-status";

interface Registration {
  id: string;
  tournament_id: string;
  team_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  registered_at: string;
  payment_status: string;
  payment_amount: number;
  payment_method: string | null;
  payment_ref: string | null;
  refund_status: string | null;
  dismissed_by_player?: boolean;
  team: {
    id: string;
    name: string;
    city: string | null;
    logo_url: string | null;
  } | null;
  tournament: {
    id: string;
    title: string;
    slug: string;
    venue_name: string | null;
    venue_city: string | null;
    tournament_start_date: string | null;
    tournament_end_date: string | null;
    entry_fee: number;
    currency: string;
    max_teams: number | null;
    format: string | null;
    status: string;
    sport: { id: string; name: string; slug: string; icon_name: string | null } | null;
    organizer: { id: string; full_name: string | null; first_name: string | null } | null;
  } | null;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending Approval",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  PAID: { label: "Paid", color: "text-emerald-600" },
  FREE: { label: "Free", color: "text-blue-600" },
  REFUNDED: { label: "Refunded", color: "text-amber-600" },
  PENDING: { label: "Pending", color: "text-muted-foreground" },
};

const SEEN_REJECTED_KEY = "playnear_seen_rejected_tournaments";
const LEGACY_SEEN_REJECTED_KEY = "localsports_seen_rejected_tournaments";

function getStoredSeenRejectedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_REJECTED_KEY) || localStorage.getItem(LEGACY_SEEN_REJECTED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addStoredSeenRejectedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredSeenRejectedIds();
    existing.add(id);
    localStorage.setItem(SEEN_REJECTED_KEY, JSON.stringify(Array.from(existing)));
  } catch {}
}

export default function RegisteredTournamentsPage() {
  const [registrations, setRegistrations] = React.useState<Registration[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = React.useState(false);
  const [feedbackNotice, setFeedbackNotice] = React.useState<string | null>(null);

  // Tracks if the page has already performed its initial mount fetch
  const isInitialMountRef = React.useRef(true);

  const loadRegistrations = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/player/tournaments");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load registrations.");
        return;
      }

      const allRegs: Registration[] = data.registrations || [];
      setRegistrations(allRegs);

      const storedSeen = getStoredSeenRejectedIds();
      const updatedDismissed = new Set(dismissedIds);

      allRegs.forEach((reg) => {
        if (reg.status === "REJECTED") {
          // If it was already dismissed in database OR already seen in previous session
          const wasPreviouslySeen = storedSeen.has(reg.id) || reg.dismissed_by_player;

          if (isInitialMountRef.current) {
            if (wasPreviouslySeen) {
              // It was seen in a prior visit/refresh -> hide it
              updatedDismissed.add(reg.id);
            } else {
              // Newly seen right now on first view: show it to user once,
              // but immediately record it so on next refresh/visit it will be gone!
              addStoredSeenRejectedId(reg.id);
              fetch("/api/player/tournaments", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ registration_id: reg.id, action: "mark_seen" }),
              }).catch(() => {});
            }
          } else {
            // User clicked Refresh or re-fetched: any rejected is now marked as dismissed
            updatedDismissed.add(reg.id);
            addStoredSeenRejectedId(reg.id);
          }
        }
      });

      setDismissedIds(updatedDismissed);
      isInitialMountRef.current = false;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const handleDismissRegistration = async (id: string) => {
    // Add to dismissed immediately
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    addStoredSeenRejectedId(id);

    setFeedbackNotice("Rejected registration removed from view.");
    setTimeout(() => setFeedbackNotice(null), 3000);

    try {
      await fetch("/api/player/tournaments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: id, action: "dismiss" }),
      });
    } catch {
      // client-side dismiss already applied
    }
  };

  const isRegOver = (reg: Registration) => {
    return isTournamentOver(reg.tournament);
  };

  // Visible registrations based on dismissal state and whether tournament date is over
  const visibleRegistrations = registrations.filter((r) => {
    if (showDismissed) return true;
    if (dismissedIds.has(r.id)) return false;
    if (isRegOver(r)) return false;
    return true;
  });

  const filtered =
    filter === "ALL"
      ? visibleRegistrations
      : visibleRegistrations.filter((r) => r.status === filter);

  const hiddenCount = registrations.filter((r) => dismissedIds.has(r.id) || isRegOver(r)).length;

  const counts = {
    ALL: visibleRegistrations.length,
    PENDING: visibleRegistrations.filter((r) => r.status === "PENDING").length,
    APPROVED: visibleRegistrations.filter((r) => r.status === "APPROVED").length,
    REJECTED: visibleRegistrations.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
            <Trophy className="h-4 w-4" /> My Registrations
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Registered Tournaments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All tournaments your teams are registered for
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadRegistrations();
            setFeedbackNotice("Refreshed! Old concluded & rejected registrations cleared.");
            setTimeout(() => setFeedbackNotice(null), 2500);
          }}
          className="gap-1.5 shrink-0"
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Notice / Feedback banner */}
      {feedbackNotice && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold animate-in fade-in-50 duration-200">
          <Check className="h-4 w-4" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Filter tabs & Dismissed toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {f === "ALL" ? "All" : STATUS_CONFIG[f].label}{" "}
              <span className="opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowDismissed((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium px-2.5 py-1 rounded-lg border border-dashed border-border transition-colors"
          >
            {showDismissed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showDismissed ? "Hide concluded / dismissed" : `Show concluded / dismissed (${hiddenCount})`}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-16 space-y-4 border border-dashed border-border rounded-2xl bg-card">
          <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-lg font-bold">
            {filter === "ALL" ? "No Registrations Yet" : `No ${STATUS_CONFIG[filter].label} Registrations`}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {filter === "ALL"
              ? "You have no active tournament registrations. Browse tournaments and register your team!"
              : `You have no active registrations with ${STATUS_CONFIG[filter].label} status.`}
          </p>
          {filter === "ALL" && (
            <Link href="/tournaments">
              <Button variant="sports" size="sm" className="gap-1.5 mt-2">
                <Trophy className="h-3.5 w-3.5" /> Browse Tournaments
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Registration Cards */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((reg) => {
            const tourney = reg.tournament;
            const team = reg.team;
            const statusCfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusCfg.icon;
            const payCfg = PAYMENT_CONFIG[reg.payment_status] || PAYMENT_CONFIG.PENDING;
            const isDismissed = dismissedIds.has(reg.id);
            const isOver = isRegOver(reg);
            const isHiddenState = isDismissed || isOver;

            return (
              <div
                key={reg.id}
                className={`bg-card border rounded-2xl p-5 shadow-sm transition-all space-y-4 ${
                  isHiddenState
                    ? "border-dashed border-border/80 opacity-60 hover:opacity-100"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {tourney?.sport && (
                        <span className="text-lg" title={tourney.sport.name}>
                          {tourney.sport.icon_name || "🏆"}
                        </span>
                      )}
                      <h3 className="font-extrabold text-base truncate">
                        {tourney?.title || "Unknown Tournament"}
                      </h3>
                      {isOver ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                          Concluded
                        </span>
                      ) : isDismissed ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                          Dismissed
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {tourney?.venue_city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {tourney.venue_city}
                        </span>
                      )}
                      {tourney?.tournament_start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(tourney.tournament_start_date)}
                        </span>
                      )}
                      {tourney?.format && (
                        <span className="capitalize">{tourney.format.toLowerCase().replace("_", " ")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap ${statusCfg.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusCfg.label}
                    </div>

                    {/* Instant Dismiss Button for Rejected Registrations */}
                    {reg.status === "REJECTED" && !isDismissed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissRegistration(reg.id)}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full gap-1 transition-colors"
                        title="Dismiss rejected registration from list"
                      >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Team</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {team?.name?.charAt(0) ?? "?"}
                      </div>
                      <p className="text-sm font-semibold truncate">{team?.name ?? "Unknown Team"}</p>
                    </div>
                    {team?.city && (
                      <p className="text-[11px] text-muted-foreground">{team.city}</p>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Entry Fee</p>
                    <p className="text-sm font-bold font-mono">
                      {(reg.payment_amount ?? 0) === 0
                        ? <span className="text-emerald-600">Free</span>
                        : formatCurrency(reg.payment_amount, tourney?.currency || "INR")}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Payment</p>
                    <div className="flex items-center gap-1.5">
                      <Wallet className={`h-3.5 w-3.5 ${payCfg.color}`} />
                      <p className={`text-sm font-semibold ${payCfg.color}`}>{payCfg.label}</p>
                    </div>
                    {reg.payment_method && (
                      <p className="text-[11px] text-muted-foreground">{reg.payment_method}</p>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Registered</p>
                    <p className="text-sm font-semibold">
                      {reg.registered_at ? formatDate(reg.registered_at) : "—"}
                    </p>
                  </div>
                </div>

                {/* Refund info if rejected */}
                {reg.status === "REJECTED" && (
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span>
                        {reg.refund_status === "REFUNDED"
                          ? "Refund has been marked by the organizer. Please contact them for details."
                          : "Registration was rejected. Contact the organizer regarding payment or refund."}
                      </span>
                    </div>
                    {!isDismissed && (
                      <button
                        onClick={() => handleDismissRegistration(reg.id)}
                        className="text-xs font-bold underline hover:opacity-80 shrink-0 ml-auto"
                      >
                        Dismiss this card
                      </button>
                    )}
                  </div>
                )}

                {/* View tournament link */}
                {tourney?.slug && (
                  <div className="pt-1">
                    <Link
                      href={`/tournaments/${tourney.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                    >
                      View Tournament Details <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

