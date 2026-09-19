"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Layers,
  Activity,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Trash2,
  Eye,
  Phone,
  Mail,
  X,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSportEmoji } from "@/lib/sports-config";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getEffectiveTournamentStatus } from "@/lib/tournament-status";

interface TournamentDetail {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  description: string;
  banner_url: string | null;
  format: string;
  status: string;
  tournament_start_date: string;
  tournament_end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  max_teams: number;
  min_players_per_team: number;
  max_players_per_team: number;
  entry_fee: number;
  currency: string;
  prize_pool: string | null;
  rules_text: string | null;
  sport: {
    id: string;
    name: string;
    slug: string;
    icon_name: string;
  } | null;
  tournament_teams: Array<{
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    registered_at: string;
    team: {
      id: string;
      name: string;
      slug: string;
      city: string | null;
      logo_url: string | null;
      bio: string | null;
      stats: { matches: number; won: number; lost: number; draw: number };
      captain: {
        id: string;
        full_name: string;
        first_name: string | null;
        email: string;
        phone: string | null;
      } | null;
    } | null;
  }>;
}

export default function OrganizerTournamentManagementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [tournament, setTournament] = React.useState<TournamentDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"overview" | "registrations" | "teams" | "matches">("overview");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editVenue, setEditVenue] = React.useState("");
  const [editCity, setEditCity] = React.useState("");
  const [editStatus, setEditStatus] = React.useState("");
  const [editEntryFee, setEditEntryFee] = React.useState<string | number>("");
  const [editPrizePool, setEditPrizePool] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Delete tournament state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const loadTournamentData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/organizer/tournaments/${id}`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          router.replace("/organizer");
          return;
        }
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setTournament(data.tournament);

      // Populate edit fields
      if (data.tournament) {
        setEditTitle(data.tournament.title);
        setEditVenue(data.tournament.venue_name);
        setEditCity(data.tournament.venue_city);
        setEditStatus(data.tournament.status);
        setEditEntryFee(data.tournament.entry_fee !== undefined ? data.tournament.entry_fee : "");
        setEditPrizePool(data.tournament.prize_pool || "");
        setEditDescription(data.tournament.description || "");
      }
    } catch (err) {
      console.error("Failed to load tournament:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  React.useEffect(() => {
    loadTournamentData();
  }, [loadTournamentData]);

  // Handle registration status change (Approve / Reject)
  const handleUpdateRegistration = async (registrationId: string, newStatus: "APPROVED" | "REJECTED") => {
    setIsUpdatingStatus(registrationId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/organizer/tournaments/${id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          status: newStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionMessage({ type: "error", text: data.error || "Failed to update registration status." });
      } else {
        setActionMessage({
          type: "success",
          text: `Registration marked as ${newStatus}.`,
        });
        await loadTournamentData();
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Team Details Modal State
  const [selectedRegDetails, setSelectedRegDetails] = React.useState<TournamentDetail["tournament_teams"][0] | null>(null);
  const [teamMembers, setTeamMembers] = React.useState<Array<{
    id: string;
    role_in_team: string;
    user: { full_name: string; avatar_url: string | null } | null;
  }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);

  // Delete registration state
  const [deleteRegTarget, setDeleteRegTarget] = React.useState<{ id: string; teamName: string } | null>(null);
  const [isDeletingReg, setIsDeletingReg] = React.useState(false);

  const openTeamDetails = async (reg: TournamentDetail["tournament_teams"][0]) => {
    setSelectedRegDetails(reg);
    setTeamMembers([]);
    if (!reg.team?.id) return;

    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/teams/${reg.team.id}`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.team?.team_members || []);
      }
    } catch (err) {
      console.error("Failed to load team members:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleConfirmDeleteRegistration = async () => {
    if (!deleteRegTarget) return;
    setIsDeletingReg(true);

    try {
      const res = await fetch(`/api/organizer/tournaments/${id}/registrations?id=${deleteRegTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove team registration.");
      }

      setActionMessage({ type: "success", text: `"${deleteRegTarget.teamName}" removed from this tournament.` });
      setDeleteRegTarget(null);
      if (selectedRegDetails?.id === deleteRegTarget.id) {
        setSelectedRegDetails(null);
      }
      await loadTournamentData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error removing team";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsDeletingReg(false);
    }
  };


  // Handle saving tournament details
  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/organizer/tournaments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          venue_name: editVenue,
          venue_city: editCity,
          status: editStatus,
          entry_fee: editEntryFee,
          prize_pool: editPrizePool,
          description: editDescription,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionMessage({ type: "error", text: data.error || "Failed to update tournament." });
      } else {
        setActionMessage({ type: "success", text: "Tournament details updated successfully!" });
        setIsEditing(false);
        await loadTournamentData();
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting the tournament
  const handleDeleteTournament = async () => {
    setIsDeleting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/organizer/tournaments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: "error", text: data.error || "Failed to delete tournament." });
        setShowDeleteConfirm(false);
      } else {
        router.replace("/organizer");
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error occurred." });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

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
        <h1 className="text-xl font-bold">Tournament Not Found</h1>
        <p className="text-sm text-muted-foreground">You may not have permission to manage this tournament.</p>
        <Link href="/organizer">
          <Button variant="outline">← Back to Organizer Hub</Button>
        </Link>
      </div>
    );
  }

  const sportSlug = tournament.sport?.slug || "";
  const registrations = tournament.tournament_teams || [];
  const approvedTeams = registrations.filter((r) => r.status === "APPROVED");
  const pendingRegistrations = registrations.filter((r) => r.status === "PENDING");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Organizer Hub
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/tournaments/${tournament.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> Public Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <div>{actionMessage.text}</div>
        </div>
      )}

      {/* Tournament Header Card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl shrink-0">
              {getSportEmoji(sportSlug)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {tournament.sport?.name || "Sport"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {tournament.format.replace(/_/g, " ")}
                </Badge>
                {(() => {
                  const effStatus = getEffectiveTournamentStatus(tournament);
                  if (effStatus === "REGISTRATION_CLOSED") {
                    return <Badge variant="warning" className="text-xs">Registration Closed</Badge>;
                  }
                  if (effStatus === "REGISTRATION_OPEN") {
                    return <Badge variant="success" className="text-xs">Registration Open</Badge>;
                  }
                  if (effStatus === "ONGOING") {
                    return <Badge variant="default" className="text-xs bg-purple-600 text-white hover:bg-purple-700">Ongoing</Badge>;
                  }
                  return <Badge variant="outline" className="text-xs">{effStatus.replace(/_/g, " ")}</Badge>;
                })()}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">{tournament.title}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-blue-500" />
                {tournament.venue_name}, {tournament.venue_city}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-1.5 text-xs font-semibold shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? "Cancel Edit" : "Edit Tournament"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5 text-xs font-semibold shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Capacity</span>
            <span className="font-bold text-foreground font-mono">
              {approvedTeams.length} / {tournament.max_teams} Teams Approved
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Pending Requests</span>
            <span className="font-bold text-amber-600 font-mono">{pendingRegistrations.length} Requests</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Entry Fee</span>
            <span className="font-bold text-foreground font-mono">
              {formatCurrency(tournament.entry_fee, tournament.currency || "INR")}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Schedule</span>
            <span className="font-bold text-foreground">
              {formatDate(tournament.tournament_start_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Form Modal/Drawer if in Editing mode */}
      {isEditing && (
        <form onSubmit={handleSaveTournament} className="bg-card border border-primary/40 rounded-2xl p-6 space-y-4 shadow-md">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary" /> Edit Tournament Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Title *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full mt-1 bg-background border border-input rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="REGISTRATION_OPEN">Registration Open</option>
                <option value="ONGOING">Live / Ongoing</option>
                <option value="REGISTRATION_CLOSED">Registration Closed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Venue Name *</label>
              <Input
                value={editVenue}
                onChange={(e) => setEditVenue(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">City *</label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Entry Fee (₹ INR)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={editEntryFee}
                onChange={(e) => setEditEntryFee(e.target.value)}
                className="mt-1"
                placeholder="0 for Free Entry (or e.g. 1500)"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Prize Pool & Awards</label>
              <textarea
                rows={3}
                value={editPrizePool}
                onChange={(e) => setEditPrizePool(e.target.value)}
                className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary whitespace-pre-line leading-relaxed"
                placeholder="1st: ₹50,000 + Trophy&#10;2nd: ₹25,000&#10;3rd: ₹10,000"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="sports" disabled={isSaving}>
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-base">Delete Tournament?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{tournament.title}</strong>? All registrations, team entries, and match data will be removed from the database.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteTournament}
                disabled={isDeleting}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Deleting..." : "Yes, Delete Tournament"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab("registrations")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "registrations"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Registrations
          {pendingRegistrations.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {pendingRegistrations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "teams"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Teams ({approvedTeams.length})
        </button>

        <button
          onClick={() => setActiveTab("matches")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "matches"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Matches & Referee
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-base">Tournament Overview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tournament.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" /> Venue & Location
              </h4>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p><strong className="text-foreground">Venue:</strong> {tournament.venue_name}</p>
                <p><strong className="text-foreground">Address:</strong> {tournament.venue_address || tournament.venue_name}</p>
                <p><strong className="text-foreground">City:</strong> {tournament.venue_city}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Rules & Prizes
              </h4>
              <div className="text-xs space-y-2 text-muted-foreground">
                <div><strong className="text-foreground block mb-0.5">Prize Pool:</strong> <span className="whitespace-pre-line leading-relaxed">{tournament.prize_pool || "Custom trophies & medals"}</span></div>
                <div><strong className="text-foreground block mb-0.5">Rules:</strong> <span className="whitespace-pre-line leading-relaxed">{tournament.rules_text || "Standard official tournament rules apply."}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTRATIONS */}
      {activeTab === "registrations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">
              Team Registrations ({registrations.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              {approvedTeams.length} Approved • {pendingRegistrations.length} Pending
            </span>
          </div>

          {registrations.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center space-y-3">
              <div className="text-4xl">👥</div>
              <p className="font-semibold text-foreground">No Registrations Yet</p>
              <p className="text-xs text-muted-foreground">
                Teams who register for your tournament will appear here for your review and approval.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => {
                const team = reg.team;
                const isPending = reg.status === "PENDING";
                const isApproved = reg.status === "APPROVED";
                const isUpdating = isUpdatingStatus === reg.id;

                return (
                  <div
                    key={reg.id}
                    className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        {team?.name ? team.name.substring(0, 1) : "T"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base">{team?.name || "Team"}</h4>
                          {isApproved ? (
                            <Badge variant="success" className="text-[10px]">APPROVED</Badge>
                          ) : isPending ? (
                            <Badge variant="live" className="text-[10px]">PENDING REVIEW</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">REJECTED</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Captain: {team?.captain?.full_name || "Captain"} • {team?.city || "Local"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Registered on {formatDate(reg.registered_at)}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTeamDetails(reg)}
                        className="gap-1.5 text-xs font-medium"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-500" /> Details
                      </Button>

                      {isPending && (
                        <>
                          <Button
                            variant="sports"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleUpdateRegistration(reg.id, "APPROVED")}
                            className="gap-1 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleUpdateRegistration(reg.id, "REJECTED")}
                            className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}

                      {reg.status !== "REJECTED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteRegTarget({ id: reg.id, teamName: team?.name || "Team" })}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          title="Remove registration"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEAMS */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          <h3 className="font-bold text-base">
            Approved Teams ({approvedTeams.length} / {tournament.max_teams})
          </h3>

          {approvedTeams.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center space-y-3">
              <div className="text-4xl">⚽</div>
              <p className="font-semibold text-foreground">No Teams Approved Yet</p>
              <p className="text-xs text-muted-foreground">
                Approve team registrations in the Registrations tab to confirm their bracket placement.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedTeams.map((reg) => {
                const team = reg.team;
                return (
                  <div key={reg.id} className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {team?.name ? team.name.substring(0, 1) : "T"}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{team?.name}</h4>
                        <p className="text-xs text-muted-foreground">{team?.city} • Captain: {team?.captain?.full_name}</p>
                      </div>
                    </div>
                    {team?.id && (
                      <Link href={`/teams/${team.id}`} target="_blank">
                        <Button variant="outline" size="sm" className="text-xs">
                          View Team
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MATCHES & REFEREE CONSOLE */}
      {activeTab === "matches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">Match Fixtures & Scorekeeping</h3>
            <Link href={`/organizer/tournaments/${tournament.id}/scorekeeper/match-5`}>
              <Button variant="sports" size="sm" className="gap-1.5 text-xs font-semibold">
                <Activity className="h-3.5 w-3.5" /> Scorekeeper Console
              </Button>
            </Link>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
            <Activity className="h-8 w-8 text-primary mx-auto" />
            <h4 className="font-bold text-base">Interactive Referee & Scorer Console</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Track live scores, match quarters/halves, match events, goals, and penalty shootouts directly from the scoring pad.
            </p>
            <Link href={`/organizer/tournaments/${tournament.id}/scorekeeper/match-5`}>
              <Button variant="sports" className="gap-2">
                Open Scorekeeper Console
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* TEAM DETAILS MODAL */}
      {selectedRegDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-muted/30">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                  {selectedRegDetails.team?.name ? selectedRegDetails.team.name.substring(0, 2).toUpperCase() : "TM"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold leading-tight">{selectedRegDetails.team?.name || "Team Details"}</h3>
                    {selectedRegDetails.status === "APPROVED" ? (
                      <Badge variant="success" className="text-[10px]">APPROVED</Badge>
                    ) : selectedRegDetails.status === "PENDING" ? (
                      <Badge variant="live" className="text-[10px]">PENDING</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">REJECTED</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedRegDetails.team?.city || "Local Team"}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRegDetails(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Captain contact */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Captain</h4>
                <div className="bg-muted/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold">{selectedRegDetails.team?.captain?.full_name || "Captain"}</p>
                    <p className="text-muted-foreground text-[11px]">{selectedRegDetails.team?.captain?.email || "No email"}</p>
                  </div>
                  {selectedRegDetails.team?.captain?.phone && (
                    <a
                      href={`tel:${selectedRegDetails.team.captain.phone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-medium hover:bg-emerald-500/20"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selectedRegDetails.team.captain.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Track Record</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-muted/40 p-2.5 rounded-xl">
                    <span className="font-mono font-bold text-sm">{selectedRegDetails.team?.stats?.matches || 0}</span>
                    <span className="block text-[10px] text-muted-foreground">Played</span>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-600 p-2.5 rounded-xl">
                    <span className="font-mono font-bold text-sm">{selectedRegDetails.team?.stats?.won || 0}</span>
                    <span className="block text-[10px]">Won</span>
                  </div>
                  <div className="bg-red-500/10 text-destructive p-2.5 rounded-xl">
                    <span className="font-mono font-bold text-sm">{selectedRegDetails.team?.stats?.lost || 0}</span>
                    <span className="block text-[10px]">Lost</span>
                  </div>
                  <div className="bg-amber-500/10 text-amber-600 p-2.5 rounded-xl">
                    <span className="font-mono font-bold text-sm">{selectedRegDetails.team?.stats?.draw || 0}</span>
                    <span className="block text-[10px]">Drawn</span>
                  </div>
                </div>
              </div>

              {/* Squad members */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Squad Players ({teamMembers.length})</span>
                  {isLoadingMembers && <span className="text-[10px] font-normal text-muted-foreground">Loading...</span>}
                </h4>
                {isLoadingMembers ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-primary" /> Loading roster...
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-3 bg-muted/30 rounded-xl text-center text-xs text-muted-foreground">
                    No roster details available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {teamMembers.map((m) => (
                      <div key={m.id} className="p-2 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[9px] text-primary">
                          {m.user?.full_name ? m.user.full_name[0].toUpperCase() : "P"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{m.user?.full_name || "Player"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{m.role_in_team || "Player"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
              {selectedRegDetails.team?.id && (
                <Link
                  href={`/teams/${selectedRegDetails.team.id}`}
                  target="_blank"
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Full Team Profile
                </Link>
              )}
              {selectedRegDetails.status !== "REJECTED" && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteRegTarget({
                        id: selectedRegDetails.id,
                        teamName: selectedRegDetails.team?.name || "Team",
                      });
                    }}
                    className="text-xs text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove from Tournament
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REMOVE REGISTRATION CONFIRMATION DIALOG */}
      {deleteRegTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-destructive/40 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-lg">Remove Team from Tournament?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to remove <strong className="text-foreground">{deleteRegTarget.teamName}</strong> from this tournament?
              </p>
              <p className="text-[11px] text-muted-foreground">
                This will cancel their registration and remove them from the tournament roster.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                disabled={isDeletingReg}
                onClick={() => setDeleteRegTarget(null)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                disabled={isDeletingReg}
                onClick={handleConfirmDeleteRegistration}
                className="rounded-xl text-xs font-semibold gap-1.5"
              >
                {isDeletingReg ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" /> Remove Team
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
