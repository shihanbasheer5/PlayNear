"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown, Users, MapPin, Plus, ChevronRight, Loader2,
  UserX, Eye, X, Trophy, Shield, User, ArrowLeft,
  CheckCircle2, AlertCircle, UserCheck, Search, LogOut, Clock,
  Inbox, Phone, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSportEmoji } from "@/lib/sports-config";
import { EditTeamModal, EditTeamFormData } from "@/components/edit-team-modal";

// ── Types ──────────────────────────────────────────────────────────────────
interface MemberProfile {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  primary_sport: string | null;
  playing_position: string | null;
  bio: string | null;
  phone: string | null;
  gender: string | null;
}

interface TeamMember {
  id: string;
  role_in_team: string;
  status: string;
  joined_at: string | null;
  user: MemberProfile | null;
}

interface JoinRequestRow {
  id: string;
  message: string | null;
  position_applying_for: string | null;
  status: string;
  created_at: string;
  user: MemberProfile | null;
}

interface MyTeam {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  bio: string | null;
  logo_url: string | null;
  target_tournament?: string | null;
  positions_needed?: string | null;
  max_players: number;
  current_players: number;
  captain_id: string;
  stats?: { matches: number; won: number; lost: number; draw: number } | null;
  sport: { id: string; name: string; slug: string } | null;
  team_members: TeamMember[];
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ profile, size = "md" }: { profile: MemberProfile | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  const name = profile?.first_name || profile?.full_name || "?";
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden border-2 border-white/20`}>
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
      ) : (
        name[0]?.toUpperCase() ?? <User className="h-4 w-4" />
      )}
    </div>
  );
}

// ── Player Profile Modal ───────────────────────────────────────────────────
// ── Player Profile Modal ───────────────────────────────────────────────────
function PlayerProfileModal({
  member,
  teamName,
  isCaptain,
  isCurrentViewer,
  hasPendingLeaveRequest,
  onClose,
  onRemove,
  onRequestLeave,
  onCancelLeaveRequest,
  isRemoving,
  isLeaving,
}: {
  member: TeamMember;
  teamName: string;
  isCaptain: boolean;
  isCurrentViewer: boolean;
  hasPendingLeaveRequest: boolean;
  onClose: () => void;
  onRemove: (memberId: string) => void;
  onRequestLeave: (reason: string) => Promise<void>;
  onCancelLeaveRequest: () => Promise<void>;
  isRemoving: boolean;
  isLeaving: boolean;
}) {
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  const [leaveReason, setLeaveReason] = React.useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);

  const p = member.user;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isCaptainMember = member.role_in_team === "CAPTAIN";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[min(90vh,680px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient banner (fixed) */}
        <div className="relative h-20 sm:h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shrink-0">
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 h-8 w-8 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-6 pt-0 pb-4">
          <div className="-mt-8 sm:-mt-9 mb-3 flex items-end justify-between">
            <div className="relative">
              <Avatar profile={p} size="lg" />
              {hasPendingLeaveRequest && (
                <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow" title="Leave request pending">
                  <Clock className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                isCaptainMember
                  ? "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                  : "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
              }`}>
                {isCaptainMember ? "👑 Captain" : "⚽ Player"}
              </span>
              {isCurrentViewer && (
                <span className="text-[10px] bg-muted font-medium text-muted-foreground px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            {p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : p?.full_name || "Unknown Player"}
          </h2>
          {p?.username && <p className="text-xs sm:text-sm text-primary font-mono font-medium">@{p.username}</p>}

          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:gap-2.5">
            {p?.city && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">City</p>
                <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate">{p.city}</span>
                </p>
              </div>
            )}
            {p?.playing_position && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Position</p>
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{p.playing_position}</p>
              </div>
            )}
            {p?.primary_sport && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Sport</p>
                <p className="text-xs sm:text-sm font-medium text-foreground capitalize truncate">{getSportEmoji(p.primary_sport)} {p.primary_sport}</p>
              </div>
            )}
            {p?.gender && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Gender</p>
                <p className="text-xs sm:text-sm font-medium text-foreground capitalize">{p.gender}</p>
              </div>
            )}
          </div>

          {p?.bio && (
            <div className="mt-2.5 bg-muted/40 rounded-xl p-2.5 sm:p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">About</p>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">{p.bio}</p>
            </div>
          )}

          <p className="mt-3 text-[11px] sm:text-xs text-muted-foreground">
            Joined <span className="font-medium text-foreground">{teamName}</span> on{" "}
            {member.joined_at ? new Date(member.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </p>
        </div>

        {/* Modal Docked Footer - role-based actions */}
        <div className="border-t border-border bg-card/95 backdrop-blur px-5 sm:px-6 py-3.5 shrink-0">
          {/* 1. Captain viewing a squad member: Remove option */}
          {isCaptain && !isCaptainMember && !isCurrentViewer && (
            <div>
              {showRemoveConfirm ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Remove <strong className="text-foreground">{p?.first_name || p?.full_name || "player"}</strong> from {teamName}?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowRemoveConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRemove(member.id)}
                      disabled={isRemoving}
                      className="gap-1.5"
                    >
                      {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                      Confirm Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full gap-2 text-sm shadow-sm"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={isRemoving}
                >
                  <UserX className="h-4 w-4" />
                  Remove from Team
                </Button>
              )}
            </div>
          )}

          {/* 2. Player viewing self: Leave Team Option */}
          {!isCaptain && isCurrentViewer && (
            <div>
              {hasPendingLeaveRequest ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-medium">Leave request pending captain approval</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelLeaveRequest}
                    disabled={isLeaving}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isLeaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Cancel Leave Request
                  </Button>
                </div>
              ) : showLeaveConfirm ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground">
                    Request to leave <strong className="text-foreground">{teamName}</strong>? The captain will review and approve.
                  </p>
                  <textarea
                    placeholder="Reason for leaving (optional)..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-16"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowLeaveConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRequestLeave(leaveReason)}
                      disabled={isLeaving}
                      className="gap-1.5"
                    >
                      {isLeaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                      Submit Request
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-sm text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  <LogOut className="h-4 w-4" />
                  Leave Team
                </Button>
              )}
            </div>
          )}

          {/* 3. Captain viewing self */}
          {isCaptain && isCurrentViewer && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-500" />
              You are the Captain of this team
            </div>
          )}

          {/* 4. Teammate viewing another teammate */}
          {!isCaptain && !isCurrentViewer && (
            <div className="text-center py-1">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Shield className="h-3.5 w-3.5 text-primary" /> Teammate in {teamName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Applicant Profile Modal (for inspecting Join Request) ───────────────────
function ApplicantProfileModal({
  request,
  teamName,
  onClose,
  onApprove,
  onReject,
  isProcessing,
}: {
  request: JoinRequestRow;
  teamName: string;
  onClose: () => void;
  onApprove: (reqId: string) => void;
  onReject: (reqId: string) => void;
  isProcessing: boolean;
}) {
  const p = request.user;
  const displayName = p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : p?.full_name || "Player";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[min(90vh,680px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-20 sm:h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shrink-0">
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 h-8 w-8 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-6 pt-0 pb-4">
          <div className="-mt-8 sm:-mt-10 mb-3 flex items-end justify-between">
            <Avatar profile={p} size="lg" />
            {request.position_applying_for && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                Applying: {request.position_applying_for}
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-foreground">{displayName}</h2>
          {p?.username && <p className="text-xs sm:text-sm text-primary font-mono font-medium">@{p.username}</p>}

          {request.message && (
            <div className="mt-3.5 p-3 rounded-xl bg-muted/50 border border-border text-xs sm:text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Message from Player</p>
              <p className="text-foreground italic leading-relaxed">"{request.message}"</p>
            </div>
          )}

          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:gap-2.5">
            {p?.city && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Location</p>
                <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate">{p.city}</span>
                </p>
              </div>
            )}
            {p?.primary_sport && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Primary Sport</p>
                <p className="text-xs sm:text-sm font-medium text-foreground capitalize flex items-center gap-1 truncate">
                  {getSportEmoji(p.primary_sport)} {p.primary_sport}
                </p>
              </div>
            )}
            {p?.playing_position && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Playing Position</p>
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{p.playing_position}</p>
              </div>
            )}
            {p?.gender && (
              <div className="bg-muted/40 rounded-xl p-2.5 sm:p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Gender</p>
                <p className="text-xs sm:text-sm font-medium text-foreground capitalize">{p.gender}</p>
              </div>
            )}
          </div>

          {p?.bio && (
            <div className="mt-2.5 bg-muted/40 rounded-xl p-2.5 sm:p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">About</p>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">{p.bio}</p>
            </div>
          )}

          {p?.phone && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span>Contact: {p.phone}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card/95 backdrop-blur px-5 sm:px-6 py-3.5 shrink-0 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={isProcessing}
            onClick={() => onReject(request.id)}
            className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <UserX className="h-3.5 w-3.5" />
            Reject Request
          </Button>
          <Button
            size="sm"
            disabled={isProcessing}
            onClick={() => onApprove(request.id)}
            className="gap-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {isProcessing ? "Adding..." : "Approve Player"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Team Requests Modal (Tabs for Join Requests & Leave Requests) ────────────
function TeamRequestsModal({
  teamName,
  activeTab,
  setActiveTab,
  joinRequests,
  leaveRequests,
  onClose,
  onJoinAction,
  onLeaveAction,
  onInspectJoinRequest,
  isProcessingJoinId,
  isProcessingLeaveId,
}: {
  teamName: string;
  activeTab: "join" | "leave";
  setActiveTab: (tab: "join" | "leave") => void;
  joinRequests: JoinRequestRow[];
  leaveRequests: any[];
  onClose: () => void;
  onJoinAction: (reqId: string, action: "approve" | "reject") => void;
  onLeaveAction: (reqId: string, action: "approve" | "reject") => void;
  onInspectJoinRequest: (req: JoinRequestRow) => void;
  isProcessingJoinId: string | null;
  isProcessingLeaveId: string | null;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Team Requests
            </h3>
            <p className="text-xs text-muted-foreground">{teamName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 sm:p-4 border-b border-border bg-card shrink-0">
          <div className="grid grid-cols-2 p-1 bg-muted rounded-xl gap-1">
            <button
              onClick={() => setActiveTab("join")}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "join"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Join Requests</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "join" ? "bg-blue-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
              }`}>
                {joinRequests.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("leave")}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "leave"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Requests</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                leaveRequests.length > 0 ? "bg-amber-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
              }`}>
                {leaveRequests.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 sm:p-5 space-y-3">
          {activeTab === "join" && (
            <>
              {joinRequests.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center mb-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">No Pending Join Requests</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    When players request to join {teamName}, their applications will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((req) => {
                    const reqName = req.user?.first_name && req.user?.last_name
                      ? `${req.user.first_name} ${req.user.last_name}`
                      : req.user?.full_name || "Applicant";
                    const isProcessing = isProcessingJoinId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-card border border-border hover:border-blue-500/30 transition-all space-y-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar profile={req.user} size="md" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{reqName}</p>
                              {req.user?.username && (
                                <p className="text-xs text-primary font-mono truncate">@{req.user.username}</p>
                              )}
                              {req.position_applying_for && (
                                <span className="inline-block mt-0.5 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  Position: {req.position_applying_for}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onInspectJoinRequest(req)}
                            className="text-xs h-8 px-2.5 text-primary hover:bg-primary/10 shrink-0 gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Profile</span>
                          </Button>
                        </div>

                        {req.message && (
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground italic">
                            "{req.message}"
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => onJoinAction(req.id, "reject")}
                            className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => onJoinAction(req.id, "approve")}
                            className="h-8 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                          >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                            Approve
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "leave" && (
            <>
              {leaveRequests.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center mb-3">
                    <LogOut className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">No Pending Leave Requests</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    When squad members request to leave {teamName}, their requests will show here for your approval.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((req) => {
                    const reqName = req.user?.first_name && req.user?.last_name
                      ? `${req.user.first_name} ${req.user.last_name}`
                      : req.user?.full_name || "Squad Member";
                    const isProcessing = isProcessingLeaveId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-card border border-amber-500/30 bg-amber-500/5 space-y-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar profile={req.user} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-foreground truncate">{reqName}</p>
                              {req.user?.username && (
                                <span className="text-xs text-muted-foreground font-mono">@{req.user.username}</span>
                              )}
                            </div>
                            {req.reason ? (
                              <p className="text-xs text-muted-foreground italic mt-0.5">"{req.reason}"</p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">Requested to leave the team</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => onLeaveAction(req.id, "reject")}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isProcessing}
                            onClick={() => onLeaveAction(req.id, "approve")}
                            className="h-8 text-xs gap-1 shadow-sm"
                          >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                            Approve Leave
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/10 shrink-0 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Team Confirmation Modal ──────────────────────────────────────────
function DeleteTeamModal({
  teamName,
  onClose,
  onConfirm,
  isDeleting,
  errorMessage,
}: {
  teamName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  errorMessage?: string | null;
}) {
  const [confirmText, setConfirmText] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isMatched = confirmText.trim().toLowerCase() === teamName.trim().toLowerCase() || confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-destructive/30 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-destructive">Delete Team</h3>
                <p className="text-[11px] text-muted-foreground">Permanent action</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed space-y-1">
            <p className="font-semibold">⚠️ Warning: This cannot be undone!</p>
            <p className="text-[11px] text-foreground/80">
              Deleting <strong className="text-destructive font-bold">{teamName}</strong> will permanently remove it from the entire platform and database, including:
            </p>
            <ul className="list-disc list-inside text-[11px] text-foreground/80 space-y-0.5 pt-1">
              <li>All squad memberships & captain ownership</li>
              <li>Pending join and leave requests</li>
              <li>Tournament registrations & team match statistics</li>
            </ul>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 leading-relaxed font-medium">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              To confirm deletion, type <span className="font-bold text-destructive font-mono">{teamName}</span> or <span className="font-bold text-destructive font-mono">DELETE</span>:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type "${teamName}" or "DELETE"`}
              className="text-xs font-mono border-destructive/40 focus:ring-destructive"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={!isMatched || isDeleting}
              className="gap-1.5 font-bold"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MyTeamsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [myTeams, setMyTeams] = React.useState<MyTeam[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const [viewingMember, setViewingMember] = React.useState<TeamMember | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Captain Edit Team Modal state
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [isSavingEdits, setIsSavingEdits] = React.useState(false);

  // Requests state
  const [leaveRequests, setLeaveRequests] = React.useState<any[]>([]);
  const [joinRequests, setJoinRequests] = React.useState<JoinRequestRow[]>([]);
  const [showRequestsModal, setShowRequestsModal] = React.useState(false);
  const [requestsTab, setRequestsTab] = React.useState<"join" | "leave">("join");
  const [processingLeaveId, setProcessingLeaveId] = React.useState<string | null>(null);
  const [processingJoinId, setProcessingJoinId] = React.useState<string | null>(null);
  const [inspectingJoinRequest, setInspectingJoinRequest] = React.useState<JoinRequestRow | null>(null);
  const [userLeaveRequest, setUserLeaveRequest] = React.useState<{ id: string; status: string } | null>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveTeamEdits = async (data: EditTeamFormData) => {
    if (!selectedTeam) return;
    setIsSavingEdits(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || "Failed to update team details.", "error");
        return;
      }

      setShowEditModal(false);
      showToast("Team details updated successfully!", "success");

      setMyTeams((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTeam.id) return t;
          return {
            ...t,
            name: data.name,
            city: data.city || null,
            bio: data.bio || null,
            target_tournament: data.target_tournament || null,
            logo_url: data.logo_url || null,
            max_players: data.max_players,
            positions_needed: data.positions_needed || null,
            stats: data.stats,
          };
        })
      );
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsSavingEdits(false);
    }
  };

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      // 1. Fetch current user profile for captain card fallback
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender")
        .eq("id", user.id)
        .maybeSingle();

      const defaultCaptainProfile: MemberProfile = userProfile || {
        id: user.id,
        full_name: user.user_metadata?.full_name || "Captain",
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
        username: user.user_metadata?.username || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        city: user.user_metadata?.city || null,
        primary_sport: "cricket",
        playing_position: null,
        bio: null,
        phone: null,
        gender: null,
      };

      // 2. Fetch teams captained by user — using explicit relation key to avoid PGRST201 ambiguity
      let loadedTeams: MyTeam[] = [];

      const { data: primaryData, error: primaryError } = await supabase
        .from("teams")
        .select(`
          *,
          sport:sports(id, name, slug),
          team_members(
            id, role_in_team, status, joined_at,
            user:profiles!team_members_user_id_fkey(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender)
          )
        `)
        .eq("captain_id", user.id)
        .order("created_at", { ascending: false });

      if (!primaryError && primaryData) {
        loadedTeams = primaryData as unknown as MyTeam[];
      } else {
        // Fallback: fetch teams directly without nested embedding if PostgREST relation throws
        console.warn("Primary teams query notice, using resilient fallback:", primaryError?.message);
        const { data: simpleTeams } = await supabase
          .from("teams")
          .select(`
            id, name, slug, city, bio, logo_url, max_players, current_players, captain_id,
            target_tournament, description, positions_needed, stats,
            sport:sports(id, name, slug)
          `)
          .eq("captain_id", user.id)
          .order("created_at", { ascending: false });

        if (simpleTeams && simpleTeams.length > 0) {
          const teamIds = simpleTeams.map(t => t.id);
          const { data: memberRows } = await supabase
            .from("team_members")
            .select(`
              id, team_id, role_in_team, status, joined_at,
              user:profiles!team_members_user_id_fkey(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender)
            `)
            .in("team_id", teamIds);

          const membersByTeam: Record<string, TeamMember[]> = {};
          (memberRows || []).forEach((row: any) => {
            if (!membersByTeam[row.team_id]) membersByTeam[row.team_id] = [];
            membersByTeam[row.team_id].push({
              id: row.id,
              role_in_team: row.role_in_team,
              status: row.status,
              joined_at: row.joined_at,
              user: row.user,
            });
          });

          loadedTeams = simpleTeams.map(t => ({
            ...t,
            team_members: membersByTeam[t.id] || [],
          })) as unknown as MyTeam[];
        }
      }

      // 2b. Also fetch teams where user is an approved squad member
      const { data: memberTeamsData } = await supabase
        .from("team_members")
        .select(`
          team:teams(
            id, name, slug, city, bio, logo_url, max_players, current_players, captain_id,
            target_tournament, description, positions_needed, stats,
            sport:sports(id, name, slug),
            team_members(
              id, role_in_team, status, joined_at,
              user:profiles!team_members_user_id_fkey(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender)
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      const memberTeams = (memberTeamsData || [])
        .map((r: any) => r.team)
        .filter(Boolean) as MyTeam[];

      const captainTeamIds = new Set(loadedTeams.map(t => t.id));
      const extraMemberTeams = memberTeams.filter(t => !captainTeamIds.has(t.id));
      loadedTeams = [...loadedTeams, ...extraMemberTeams];

      // 3. Ensure captain is always present in squad roster and auto-sync if missing in database
      const healedTeams = loadedTeams.map(team => {
        const members = Array.isArray(team.team_members) ? [...team.team_members] : [];
        const hasCaptain = members.some(
          m => m.user?.id === user.id || m.role_in_team?.toUpperCase() === "CAPTAIN"
        );

        if (!hasCaptain) {
          // Synthesize captain membership card
          const captainEntry: TeamMember = {
            id: `captain-${team.id}`,
            role_in_team: "CAPTAIN",
            status: "ACTIVE",
            joined_at: null,
            user: defaultCaptainProfile,
          };
          members.unshift(captainEntry);

          // Auto-heal in background: add captain row to team_members
          supabase.from("team_members").insert({
            team_id: team.id,
            user_id: user.id,
            player_id: user.id,
            role_in_team: "CAPTAIN",
            status: "ACTIVE",
            joined_at: new Date().toISOString(),
          }).then(({ error: bgErr }) => {
            if (bgErr) {
              supabase.from("team_members").insert({
                team_id: team.id,
                user_id: user.id,
                role_in_team: "CAPTAIN",
                status: "ACTIVE",
                joined_at: new Date().toISOString(),
              });
            }
          });
        }

        return {
          ...team,
          team_members: members,
          current_players: Math.max(team.current_players || 1, members.length),
        };
      });

      setMyTeams(healedTeams);
      if (healedTeams.length > 0) setSelectedTeamId(healedTeams[0].id);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch leave requests and join requests when selected team changes
  React.useEffect(() => {
    if (!selectedTeamId) return;
    async function fetchRequestsData() {
      try {
        const leaveRes = await fetch(`/api/teams/${selectedTeamId}/leave`);
        if (leaveRes.ok) {
          const data = await leaveRes.json();
          if (data.isCaptain) {
            setLeaveRequests(data.requests || []);
            setUserLeaveRequest(null);
          } else {
            setUserLeaveRequest(data.userRequest || null);
            setLeaveRequests([]);
          }
        }

        const joinRes = await fetch(`/api/teams/${selectedTeamId}/join`);
        if (joinRes.ok) {
          const joinData = await joinRes.json();
          setJoinRequests(joinData.requests || []);
        } else {
          setJoinRequests([]);
        }
      } catch (e) {
        console.error("Failed to load requests data:", e);
      }
    }
    fetchRequestsData();
  }, [selectedTeamId]);

  const selectedTeam = myTeams.find(t => t.id === selectedTeamId) ?? null;
  const isCaptainOfSelected = !!(selectedTeam && currentUserId && selectedTeam.captain_id === currentUserId);
  const activeMembers = (selectedTeam?.team_members ?? []).filter(
    m => m.status === "ACTIVE" || m.status === "active" || m.status === "LEAVE_REQUESTED"
  );
  const filteredMembers = searchQuery.trim()
    ? activeMembers.filter(m => {
        const name = `${m.user?.first_name ?? ""} ${m.user?.last_name ?? ""} ${m.user?.full_name ?? ""} ${m.user?.username ?? ""}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      })
    : activeMembers;

  const handleRemoveMember = async (membershipId: string) => {
    if (!selectedTeam) return;
    setRemovingId(membershipId);
    try {
      // Try API first, fallback to direct supabase
      const res = await fetch(`/api/teams/${selectedTeam.id}/members/${membershipId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await supabase.from("team_members").delete().eq("id", membershipId);
        if (error) throw new Error(error.message);
      }
      setMyTeams(prev => prev.map(t =>
        t.id === selectedTeamId
          ? { ...t, team_members: t.team_members.filter(m => m.id !== membershipId), current_players: Math.max(0, t.current_players - 1) }
          : t
      ));
      setViewingMember(null);
      showToast("Player removed from team.", "success");
    } catch (err: unknown) {
      showToast((err as Error).message || "Failed to remove player.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    setIsDeletingTeam(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete team.");
        showToast(data.error || "Failed to delete team.", "error");
        setIsDeletingTeam(false);
        return;
      }

      showToast(`Team "${selectedTeam.name}" has been permanently deleted.`, "success");
      setShowDeleteModal(false);
      setDeleteError(null);
      setMyTeams((prev) => {
        const next = prev.filter((t) => t.id !== selectedTeam.id);
        setSelectedTeamId(next.length > 0 ? next[0].id : null);
        return next;
      });
    } catch {
      setDeleteError("Network error. Please try again.");
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsDeletingTeam(false);
    }
  };

  const handleLeaveAction = async (requestId: string, action: "approve" | "reject") => {
    if (!selectedTeam) return;
    setProcessingLeaveId(requestId);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/leave/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} leave request.`);

      setLeaveRequests(prev => prev.filter(r => r.id !== requestId));
      showToast(data.message || (action === "approve" ? "Player removed from squad." : "Leave request rejected."), "success");

      if (action === "approve") {
        setMyTeams(prev => prev.map(t => {
          if (t.id !== selectedTeamId) return t;
          return {
            ...t,
            team_members: t.team_members.filter(m => m.id !== requestId && m.user?.id !== data.userId),
            current_players: Math.max(1, t.current_players - 1),
          };
        }));
      } else {
        // Restore status to ACTIVE
        setMyTeams(prev => prev.map(t => {
          if (t.id !== selectedTeamId) return t;
          return {
            ...t,
            team_members: t.team_members.map(m => m.id === requestId ? { ...m, status: "ACTIVE" } : m),
          };
        }));
      }
    } catch (err) {
      showToast((err as Error).message || "Failed to process leave request.", "error");
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleJoinAction = async (requestId: string, action: "approve" | "reject") => {
    if (!selectedTeam) return;
    setProcessingJoinId(requestId);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/join/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} join request.`);

      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      setInspectingJoinRequest(null);
      showToast(action === "approve" ? "Player accepted into squad!" : "Join request rejected.", "success");

      // Reload team to reflect updated squad members
      const refreshRes = await fetch(`/api/teams/${selectedTeam.id}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const updated = refreshData.team;
        if (updated?.team_members) {
          setMyTeams(prev => prev.map(t => t.id === selectedTeam.id ? {
            ...t,
            team_members: updated.team_members,
            current_players: updated.current_players || updated.team_members.length,
          } : t));
        }
      }
    } catch (err) {
      showToast((err as Error).message || "Failed to process request.", "error");
    } finally {
      setProcessingJoinId(null);
    }
  };

  const handleRequestLeave = async (reason: string) => {
    if (!selectedTeam) return;
    setIsSubmittingLeave(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit leave request.");

      setUserLeaveRequest({ id: data.requestId || "pending", status: "PENDING" });
      setMyTeams(prev => prev.map(t => {
        if (t.id !== selectedTeamId) return t;
        return {
          ...t,
          team_members: t.team_members.map(m => m.user?.id === currentUserId ? { ...m, status: "LEAVE_REQUESTED" } : m),
        };
      }));
      showToast("Leave request sent to captain.", "success");
    } catch (err) {
      showToast((err as Error).message || "Failed to submit leave request.", "error");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleCancelLeaveRequest = async () => {
    if (!selectedTeam) return;
    setIsSubmittingLeave(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/leave`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel leave request.");

      setUserLeaveRequest(null);
      setMyTeams(prev => prev.map(t => {
        if (t.id !== selectedTeamId) return t;
        return {
          ...t,
          team_members: t.team_members.map(m => m.user?.id === currentUserId ? { ...m, status: "ACTIVE" } : m),
        };
      }));
      showToast("Leave request withdrawn.", "success");
    } catch (err) {
      showToast((err as Error).message || "Failed to cancel leave request.", "error");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Loading your teams…</p>
        </div>
      </div>
    );
  }

  // ── No teams ──
  if (myTeams.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mb-6">
          <Crown className="h-9 w-9 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">No Teams Yet</h1>
        <p className="text-muted-foreground max-w-sm mb-8">You haven't created any teams. Start by creating one and build your squad!</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/teams/new">
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25">
              <Plus className="h-4 w-4" /> Create a Team
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-3 ${
          toast.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Player Profile Modal */}
      {viewingMember && selectedTeam && (
        <PlayerProfileModal
          member={viewingMember}
          teamName={selectedTeam.name}
          isCaptain={isCaptainOfSelected}
          isCurrentViewer={currentUserId === viewingMember.user?.id}
          hasPendingLeaveRequest={
            (currentUserId === viewingMember.user?.id && !!userLeaveRequest) ||
            leaveRequests.some(r => r.user?.id === viewingMember.user?.id || r.membershipId === viewingMember.id) ||
            viewingMember.status === "LEAVE_REQUESTED"
          }
          onClose={() => setViewingMember(null)}
          onRemove={handleRemoveMember}
          onRequestLeave={handleRequestLeave}
          onCancelLeaveRequest={handleCancelLeaveRequest}
          isRemoving={removingId === viewingMember.id}
          isLeaving={isSubmittingLeave}
        />
      )}

      {/* Team Requests Modal (Join & Leave) */}
      {showRequestsModal && selectedTeam && isCaptainOfSelected && (
        <TeamRequestsModal
          teamName={selectedTeam.name}
          activeTab={requestsTab}
          setActiveTab={setRequestsTab}
          joinRequests={joinRequests}
          leaveRequests={leaveRequests}
          onClose={() => setShowRequestsModal(false)}
          onJoinAction={handleJoinAction}
          onLeaveAction={handleLeaveAction}
          onInspectJoinRequest={(req) => setInspectingJoinRequest(req)}
          isProcessingJoinId={processingJoinId}
          isProcessingLeaveId={processingLeaveId}
        />
      )}

      {/* Applicant Full Profile Modal */}
      {inspectingJoinRequest && selectedTeam && (
        <ApplicantProfileModal
          request={inspectingJoinRequest}
          teamName={selectedTeam.name}
          onClose={() => setInspectingJoinRequest(null)}
          onApprove={(reqId) => handleJoinAction(reqId, "approve")}
          onReject={(reqId) => handleJoinAction(reqId, "reject")}
          isProcessing={processingJoinId === inspectingJoinRequest.id}
        />
      )}

      {/* Sticky page header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">My Teams</h1>
              <p className="text-xs text-muted-foreground">Teams you captain &amp; manage</p>
            </div>
          </div>
          <Link href="/teams/new">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <Plus className="h-4 w-4" /> New Team
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-5">
        {/* ── Left sidebar / horizontal strip on mobile: team list ── */}
        <div className="lg:w-72 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2.5">
            {myTeams.length} {myTeams.length === 1 ? "Team" : "Teams"}
          </p>
          <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
            {myTeams.map(team => {
              const emoji = getSportEmoji(team.sport?.slug ?? "");
              const isSelected = team.id === selectedTeamId;
              const memberCount = team.team_members.filter(m => m.status === "ACTIVE" || m.status === "active").length;
              return (
                <button
                  key={team.id}
                  onClick={() => { setSelectedTeamId(team.id); setSearchQuery(""); }}
                  className={`min-w-[240px] sm:min-w-[260px] lg:min-w-0 lg:w-full shrink-0 lg:shrink text-left rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 group ${
                    isSelected
                      ? "bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border-blue-500/40 shadow-md shadow-blue-500/10"
                      : "bg-card border-border hover:border-blue-400/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0 overflow-hidden border border-border/60 bg-white dark:bg-slate-900 ${isSelected ? "ring-2 ring-blue-500/40" : ""}`}>
                      {team.logo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain p-0.5" />
                        : emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                        {team.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />{memberCount} / {team.max_players} players
                        {team.city && <><MapPin className="h-3 w-3 ml-1 shrink-0" /><span className="truncate">{team.city}</span></>}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform hidden lg:block ${isSelected ? "text-blue-500 rotate-90" : "text-muted-foreground group-hover:text-foreground"}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: roster management ── */}
        {selectedTeam && (
          <div className="flex-1 min-w-0">
            {/* Team card */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden mb-5 shadow-sm">
              <div className="h-28 sm:h-36 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "20px 20px" }} />
                
                {/* Desktop top-right actions inside banner */}
                <div className="absolute top-3.5 right-4 hidden sm:flex items-center gap-2">
                  <Link href={`/teams/${selectedTeam.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-card/90 hover:bg-card border-white/20 text-foreground backdrop-blur shadow-sm">
                      <Eye className="h-3.5 w-3.5" /> Public View
                    </Button>
                  </Link>
                  {isCaptainOfSelected && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setShowEditModal(true)}
                        className="gap-1.5 text-xs bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit Team</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => { setRequestsTab("join"); setShowRequestsModal(true); }}
                        className="gap-1.5 text-xs bg-white text-blue-700 hover:bg-white/90 font-semibold shadow-md"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Requests</span>
                        {(joinRequests.length > 0 || leaveRequests.length > 0) && (
                          <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-black font-bold rounded-full text-[10px]">
                            {joinRequests.length + leaveRequests.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowDeleteModal(true)}
                        className="gap-1.5 text-xs shadow-md"
                        title="Permanently delete team from database"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Team</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="px-4 sm:px-6 pb-5">
                {/* Avatar and mobile action row */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 -mt-9 sm:-mt-11 mb-3">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-card bg-white dark:bg-slate-900 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shrink-0 overflow-hidden relative z-10">
                    {selectedTeam.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedTeam.logo_url} alt={selectedTeam.name} className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl sm:text-4xl text-white">
                        {getSportEmoji(selectedTeam.sport?.slug ?? "")}
                      </div>
                    )}
                  </div>

                  {/* Mobile action buttons displayed cleanly below banner */}
                  <div className="flex sm:hidden items-center gap-2 w-full pt-1 flex-wrap">
                    <Link href={`/teams/${selectedTeam.id}`} className="flex-1 min-w-[110px]">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Eye className="h-3.5 w-3.5" /> Public View
                      </Button>
                    </Link>
                    {isCaptainOfSelected && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setShowEditModal(true)}
                          className="flex-1 min-w-[110px] gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-sm"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit Team</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setRequestsTab("join"); setShowRequestsModal(true); }}
                          className="flex-1 min-w-[110px] gap-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Requests</span>
                          {(joinRequests.length > 0 || leaveRequests.length > 0) && (
                            <span className="ml-0.5 px-1.5 py-0.2 bg-amber-400 text-black font-bold rounded-full text-[10px]">
                              {joinRequests.length + leaveRequests.length}
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowDeleteModal(true)}
                          className="gap-1.5 text-xs shadow-sm px-2.5"
                          title="Permanently delete team from database"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{selectedTeam.name}</h2>
                <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                  {selectedTeam.sport && (
                    <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full capitalize">
                      {getSportEmoji(selectedTeam.sport.slug)} {selectedTeam.sport.name}
                    </span>
                  )}
                  {selectedTeam.city && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />{selectedTeam.city}
                    </span>
                  )}
                  <span className="text-xs flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {isCaptainOfSelected ? "You are Captain" : "You are Squad Member"}
                    </span>
                  </span>
                </div>

                {/* Target / Next Tournament Interested */}
                {selectedTeam.target_tournament && (
                  <div className="mt-3.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Targeting Tournament</p>
                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">{selectedTeam.target_tournament}</p>
                      </div>
                    </div>
                    {isCaptainOfSelected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowEditModal(true)}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 font-semibold h-8 px-2.5 shrink-0"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit Target
                      </Button>
                    )}
                  </div>
                )}

                {selectedTeam.bio && (
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
                    {selectedTeam.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Captain: Pending Leave Requests */}
            {isCaptainOfSelected && leaveRequests.length > 0 && (
              <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        Player Leave Requests ({leaveRequests.length})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">Players requesting to leave the squad</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                    Action Required
                  </span>
                </div>
                <div className="space-y-2">
                  {leaveRequests.map(req => {
                    const reqName = req.user?.first_name && req.user?.last_name
                      ? `${req.user.first_name} ${req.user.last_name}`
                      : req.user?.full_name || "Player";
                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-3">
                          <Avatar profile={req.user} size="sm" />
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {reqName}
                              {req.user?.username && <span className="text-muted-foreground font-normal ml-1">@{req.user.username}</span>}
                            </p>
                            {req.reason ? (
                              <p className="text-[11px] text-muted-foreground italic mt-0.5">"{req.reason}"</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground mt-0.5">Requested to leave the team</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLeaveAction(req.id, "reject")}
                            disabled={processingLeaveId === req.id}
                            className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleLeaveAction(req.id, "approve")}
                            disabled={processingLeaveId === req.id}
                            className="h-7 text-xs px-2.5 gap-1 shadow-sm"
                          >
                            {processingLeaveId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                            Approve Leave
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member: Pending Leave Request Status Banner */}
            {!isCaptainOfSelected && userLeaveRequest && (
              <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Leave Request Pending</p>
                    <p className="text-xs text-muted-foreground">Your request to leave this team has been submitted to the captain.</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelLeaveRequest}
                  disabled={isSubmittingLeave}
                  className="text-xs shrink-0"
                >
                  {isSubmittingLeave ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Cancel Request
                </Button>
              </div>
            )}

            {/* Roster header + search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Squad Roster
                  <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                    {activeMembers.length} / {selectedTeam.max_players}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCaptainOfSelected ? "Click any player to view profile or manage" : "Click any player to view profile"}
                </p>
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search players…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Player cards grid */}
            {filteredMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-14 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchQuery ? "No players match your search." : "No active players yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredMembers.map(member => {
                  const p = member.user;
                  const displayName = p?.first_name && p?.last_name
                    ? `${p.first_name} ${p.last_name}`
                    : p?.full_name || "Unknown";
                  const isCaptainMember = member.role_in_team === "CAPTAIN";
                  const isLeavingPlayer = leaveRequests.some(r => r.user?.id === member.user?.id || r.membershipId === member.id) || member.status === "LEAVE_REQUESTED" || (currentUserId === member.user?.id && !!userLeaveRequest);

                  return (
                    <div
                      key={member.id}
                      onClick={() => setViewingMember(member)}
                      className="group rounded-2xl border border-border bg-card hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 p-4 cursor-pointer transition-all duration-200 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-200 rounded-2xl" />
                      <div className="relative flex items-center gap-3">
                        <Avatar profile={p} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                            {isCaptainMember && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            {isLeavingPlayer && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 font-medium px-1.5 py-0.2 rounded-full flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" /> Leaving
                              </span>
                            )}
                          </div>
                          {p?.username && <p className="text-xs text-primary font-mono font-medium truncate">@{p.username}</p>}
                          {p?.playing_position && <p className="text-xs text-muted-foreground mt-0.5 capitalize">{p.playing_position}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-3 w-3" /> View
                          </span>
                          {isCaptainOfSelected && !isCaptainMember && (
                            <button
                              onClick={e => { e.stopPropagation(); handleRemoveMember(member.id); }}
                              disabled={removingId === member.id}
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center"
                              title="Remove player"
                            >
                              {removingId === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                      {p?.city && (
                        <p className="relative mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{p.city}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* View Join / Leave Requests CTA (Captain only) */}
            {isCaptainOfSelected && (
              <div className="mt-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-indigo-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      View Join / Leave Requests
                      {(joinRequests.length > 0 || leaveRequests.length > 0) && (
                        <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                          {joinRequests.length + leaveRequests.length} pending
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Review join requests from new applicants and manage squad departure requests.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRequestsTab("join"); setShowRequestsModal(true); }}
                    className="gap-1.5 text-xs font-semibold w-full sm:w-auto justify-center"
                  >
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    Join Requests ({joinRequests.length})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setRequestsTab("leave"); setShowRequestsModal(true); }}
                    className="gap-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white w-full sm:w-auto justify-center shadow-sm"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Leave Requests ({leaveRequests.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Captain Edit Team Details Modal */}
      {showEditModal && selectedTeam && isCaptainOfSelected && (
        <EditTeamModal
          team={selectedTeam}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveTeamEdits}
          isSaving={isSavingEdits}
          onOpenDeleteModal={() => setShowDeleteModal(true)}
        />
      )}

      {/* Captain Delete Team Modal */}
      {showDeleteModal && selectedTeam && (
        <DeleteTeamModal
          teamName={selectedTeam.name}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteTeam}
          isDeleting={isDeletingTeam}
          errorMessage={deleteError}
        />
      )}
    </div>
  );
}
