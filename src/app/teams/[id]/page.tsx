"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  Users,
  ChevronLeft,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Crown,
  User,
  Send,
  UserCheck,
  UserX,
  Clock,
  Eye,
  X,
  Phone,
  LogOut,
  Loader2,
  Pencil,
  UserMinus,
  Upload,
  Link2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSportEmoji, getSportPositions } from "@/lib/sports-config";

interface TeamMemberRow {
  id: string;
  role_in_team: string;
  status: string;
  user: {
    id: string;
    full_name: string;
    first_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface JoinRequestRow {
  id: string;
  message: string | null;
  position_applying_for: string | null;
  status: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    first_name: string | null;
    last_name?: string | null;
    username?: string | null;
    avatar_url: string | null;
    city?: string | null;
    primary_sport?: string | null;
    playing_position?: string | null;
    bio?: string | null;
    phone?: string | null;
    gender?: string | null;
    experience_achievements?: string | null;
  } | null;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  bio: string | null;
  logo_url?: string | null;
  captain_id: string;
  positions_needed: string | null;
  target_tournament?: string | null;
  max_players: number | null;
  current_players: number | null;
  stats: { matches: number; won: number; lost: number; draw: number };
  sport: { id: string; name: string; slug: string } | null;
  captain: { id: string; full_name: string; first_name: string | null; avatar_url: string | null; city: string | null } | null;
  team_members: TeamMemberRow[];
}

function normalizeTeamData(rawTeam: TeamDetail): TeamDetail {
  const members = Array.isArray(rawTeam.team_members) ? [...rawTeam.team_members] : [];
  const hasCaptain = members.some(
    (m) => m.user?.id === rawTeam.captain_id || m.role_in_team?.toUpperCase() === "CAPTAIN"
  );
  if (!hasCaptain && rawTeam.captain) {
    members.unshift({
      id: `captain-${rawTeam.id}`,
      role_in_team: "Captain",
      status: "ACTIVE",
      user: {
        id: rawTeam.captain.id,
        full_name: rawTeam.captain.full_name,
        first_name: rawTeam.captain.first_name,
        avatar_url: rawTeam.captain.avatar_url,
      },
    });
  }
  return {
    ...rawTeam,
    team_members: members,
  };
}

// ── Applicant Profile Modal ────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
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
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl sm:text-2xl shrink-0 overflow-hidden border-4 border-card shadow-lg">
              {p?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                displayName[0]?.toUpperCase() ?? <User className="h-7 w-7" />
              )}
            </div>
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

          {p?.experience_achievements && (
            <div className="mt-2.5 bg-muted/40 rounded-xl p-2.5 sm:p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Experience & Achievements</p>
              <p className="text-xs text-foreground leading-relaxed">{p.experience_achievements}</p>
            </div>
          )}

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
            variant="sports"
            disabled={isProcessing}
            onClick={() => onApprove(request.id)}
            className="gap-1.5 text-xs"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {isProcessing ? "Adding..." : "Approve Player"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Captain Edit Team Modal ──────────────────────────────────────────────────
function EditTeamModal({
  team,
  onClose,
  onSave,
  isSaving,
  onOpenDeleteModal,
}: {
  team: TeamDetail;
  onClose: () => void;
  onSave: (data: {
    name: string;
    logo_url: string | null;
    bio: string;
    city: string;
    target_tournament: string | null;
    positions_needed: string;
    max_players: number;
    stats: { matches: number; won: number; lost: number; draw: number };
  }) => Promise<void>;
  isSaving: boolean;
  onOpenDeleteModal: () => void;
}) {
  const [name, setName] = React.useState(team.name || "");
  const [bio, setBio] = React.useState(team.bio || "");
  const [city, setCity] = React.useState(team.city || "");
  const [targetTournament, setTargetTournament] = React.useState(team.target_tournament || "");
  const [upcomingTournaments, setUpcomingTournaments] = React.useState<Array<{ id: string; title: string; sport?: { name?: string; slug?: string } | null }>>([]);
  const [positionsNeeded, setPositionsNeeded] = React.useState(team.positions_needed || "");
  const [maxPlayers, setMaxPlayers] = React.useState(String(team.max_players || 15));

  // Stats: W, D, L, Played
  const [won, setWon] = React.useState(String(team.stats?.won ?? 0));
  const [draw, setDraw] = React.useState(String(team.stats?.draw ?? 0));
  const [lost, setLost] = React.useState(String(team.stats?.lost ?? 0));
  const [matches, setMatches] = React.useState(String(team.stats?.matches ?? 0));
  const [autoMatches, setAutoMatches] = React.useState(true);

  // Logo: Upload or URL
  const [logoMode, setLogoMode] = React.useState<"upload" | "url">("upload");
  const [logoUrl, setLogoUrl] = React.useState(team.logo_url || "");
  const [urlInput, setUrlInput] = React.useState(team.logo_url?.startsWith("http") ? team.logo_url : "");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadTournaments() {
      try {
        const res = await fetch("/api/tournaments?limit=25");
        if (res.ok) {
          const data = await res.json();
          if (data.tournaments) {
            setUpcomingTournaments(
              data.tournaments.map((t: any) => ({
                id: t.id,
                title: t.title || t.name,
                sport: t.sport,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load upcoming tournaments:", err);
      }
    }
    loadTournaments();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleWonChange = (val: string) => {
    setWon(val);
    if (autoMatches) {
      const w = parseInt(val) || 0;
      const d = parseInt(draw) || 0;
      const l = parseInt(lost) || 0;
      setMatches(String(w + d + l));
    }
  };

  const handleDrawChange = (val: string) => {
    setDraw(val);
    if (autoMatches) {
      const w = parseInt(won) || 0;
      const d = parseInt(val) || 0;
      const l = parseInt(lost) || 0;
      setMatches(String(w + d + l));
    }
  };

  const handleLostChange = (val: string) => {
    setLost(val);
    if (autoMatches) {
      const w = parseInt(won) || 0;
      const d = parseInt(draw) || 0;
      const l = parseInt(val) || 0;
      setMatches(String(w + d + l));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file (PNG, JPG, WEBP, etc.).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Logo file must be smaller than 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
        setFormError(null);
      }
    };
    reader.onerror = () => {
      setFormError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setLogoUrl("");
    setUrlInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Team name cannot be empty.");
      return;
    }

    const wonNum = Math.max(0, parseInt(won) || 0);
    const drawNum = Math.max(0, parseInt(draw) || 0);
    const lostNum = Math.max(0, parseInt(lost) || 0);
    const matchesNum = Math.max(0, parseInt(matches) || (wonNum + drawNum + lostNum));

    await onSave({
      name: name.trim(),
      logo_url: logoUrl.trim() || null,
      bio: bio.trim(),
      city: city.trim(),
      target_tournament: targetTournament.trim() || null,
      positions_needed: positionsNeeded.trim(),
      max_players: parseInt(maxPlayers) || 15,
      stats: {
        matches: matchesNum,
        won: wonNum,
        draw: drawNum,
        lost: lostNum,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[min(92vh,780px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Edit Team Details</h2>
              <p className="text-xs text-muted-foreground">Captain Control Panel</p>
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

        {/* Form Body */}
        <form id="edit-team-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{formError}</div>
            </div>
          )}

          {/* Team Name */}
          <div>
            <label className="text-xs font-semibold text-foreground">Team Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name"
              className="mt-1 text-sm font-medium"
              required
            />
          </div>

          {/* Team Logo */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Team Logo</label>
              <span className="text-[11px] text-muted-foreground">Upload file or paste image URL</span>
            </div>

            {logoUrl ? (
              <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border bg-muted/40">
                <div className="h-16 w-16 rounded-xl border-2 border-primary/40 overflow-hidden bg-background shrink-0 flex items-center justify-center shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="h-full w-full object-cover"
                    onError={() => setFormError("Could not load image from provided URL. Please verify link.")}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Current Logo</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                    {logoUrl.startsWith("data:") ? "Uploaded image file" : logoUrl}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearLogo}
                    className="h-7 px-2 mt-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <X className="h-3 w-3" /> Remove Logo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setLogoMode("upload")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      logoMode === "upload"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoMode("url")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      logoMode === "url"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Google / Web URL</span>
                  </button>
                </div>

                {logoMode === "upload" ? (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="edit-team-logo-input"
                    />
                    <label
                      htmlFor="edit-team-logo-input"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-3.5 cursor-pointer bg-background/50 hover:bg-muted/30 transition-all text-center group"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary mb-1 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Click to upload new logo</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, WEBP (Max 3MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste Google image URL or web image link..."
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          setLogoUrl(e.target.value.trim());
                        }}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (urlInput.trim()) setLogoUrl(urlInput.trim());
                        }}
                        className="text-xs shrink-0"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bio / Description */}
          <div>
            <label className="text-xs font-semibold text-foreground">Team Description</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about your team, philosophy, practice timings..."
              rows={3}
              className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Record / Stats: W, D, L, Played */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                Team Match Record (Stats)
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMatches}
                  onChange={(e) => setAutoMatches(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Auto-calc Played (W+D+L)
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-emerald-600 block mb-1">Won (W)</label>
                <Input
                  type="number"
                  min="0"
                  value={won}
                  onChange={(e) => handleWonChange(e.target.value)}
                  className="text-center text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Draw (D)</label>
                <Input
                  type="number"
                  min="0"
                  value={draw}
                  onChange={(e) => handleDrawChange(e.target.value)}
                  className="text-center text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-red-500 block mb-1">Lost (L)</label>
                <Input
                  type="number"
                  min="0"
                  value={lost}
                  onChange={(e) => handleLostChange(e.target.value)}
                  className="text-center text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">Played</label>
                <Input
                  type="number"
                  min="0"
                  value={matches}
                  onChange={(e) => {
                    setAutoMatches(false);
                    setMatches(e.target.value);
                  }}
                  className="text-center text-sm font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Directly edit your team's match record (e.g. 10W 2D 3L 15 played).
            </p>
          </div>

          {/* Target / Next Tournament Interested */}
          <div className="space-y-1.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <label className="text-xs font-bold text-foreground">Target / Upcoming Tournament</label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Declare what tournament your squad intends to compete in, or update it after a tournament finishes.
            </p>
            {upcomingTournaments.length > 0 ? (
              <div className="space-y-2 pt-1">
                <select
                  value={
                    upcomingTournaments.some((t) => t.title.toLowerCase() === targetTournament.toLowerCase())
                      ? targetTournament
                      : targetTournament
                      ? "__custom__"
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      // Keep typed text
                    } else {
                      setTargetTournament(e.target.value);
                    }
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- No target tournament / Open --</option>
                  {upcomingTournaments.map((tourney) => (
                    <option key={tourney.id} value={tourney.title}>
                      🏆 {tourney.title} {tourney.sport?.name ? `(${tourney.sport.name})` : ""}
                    </option>
                  ))}
                  <option value="__custom__">✏️ Custom / Other Tournament</option>
                </select>
                <Input
                  placeholder="Or type custom tournament name (e.g. State Championship 2026)..."
                  value={targetTournament}
                  onChange={(e) => setTargetTournament(e.target.value)}
                  className="text-xs"
                />
              </div>
            ) : (
              <Input
                placeholder="e.g. Mumbai Summer Cup, Local League 2026..."
                value={targetTournament}
                onChange={(e) => setTargetTournament(e.target.value)}
                className="mt-1 text-xs"
              />
            )}
          </div>

          {/* City and Max Players */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">City / Location</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Max Squad Capacity</label>
              <Input
                type="number"
                min="2"
                max="50"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Positions Needed */}
          <div>
            <label className="text-xs font-semibold text-foreground">Positions Needed</label>
            <Input
              value={positionsNeeded}
              onChange={(e) => setPositionsNeeded(e.target.value)}
              placeholder="e.g. Midfielder, Bowler, Defender..."
              className="mt-1 text-xs sm:text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Roles you are looking to recruit for this squad.
            </p>
          </div>

          {/* Danger Zone: Delete Team */}
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Team
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Permanently delete this team, disband the squad roster, and erase all team records from the database.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenDeleteModal();
                }}
                className="gap-1.5 text-xs font-bold shrink-0 self-start sm:self-auto shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Team
              </Button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-border bg-muted/20 px-6 py-3.5 shrink-0 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-team-form"
            variant="sports"
            size="sm"
            disabled={isSaving}
            className="gap-1.5 font-bold"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Captain Remove Player Modal ──────────────────────────────────────────────
function RemoveMemberModal({
  member,
  teamName,
  onClose,
  onConfirm,
  isRemoving,
}: {
  member: TeamMemberRow;
  teamName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isRemoving: boolean;
}) {
  const displayName = member.user?.first_name || member.user?.full_name || "this player";

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <UserMinus className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-foreground">Remove Player</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-border">
              {member.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">Role: {member.role_in_team}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to remove <strong className="text-foreground">{displayName}</strong> from <strong className="text-foreground">{teamName}</strong>? They will be removed from the squad immediately and will need to request to join again to rejoin.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isRemoving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={isRemoving}
              className="gap-1.5"
            >
              {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
              {isRemoving ? "Removing..." : "Remove Player"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Captain Delete Team Modal ────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={onClose}>
      <div
        className="bg-card border border-destructive/30 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 className="h-4 w-4" />
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

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [team, setTeam] = React.useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isCaptain, setIsCaptain] = React.useState(false);
  const [isMember, setIsMember] = React.useState(false);
  const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
  const [joinRequests, setJoinRequests] = React.useState<JoinRequestRow[]>([]);
  const [processingRequestId, setProcessingRequestId] = React.useState<string | null>(null);
  const [inspectingRequest, setInspectingRequest] = React.useState<JoinRequestRow | null>(null);
  const [requestsTab, setRequestsTab] = React.useState<"join" | "leave">("join");
  const [leaveRequests, setLeaveRequests] = React.useState<any[]>([]);
  const [userLeaveRequest, setUserLeaveRequest] = React.useState<{ id: string; status: string } | null>(null);
  const [processingLeaveId, setProcessingLeaveId] = React.useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [leaveReason, setLeaveReason] = React.useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = React.useState(false);

  const [joinMessage, setJoinMessage] = React.useState("");
  const [joinPosition, setJoinPosition] = React.useState("");
  const [isJoining, setIsJoining] = React.useState(false);
  const [joinSuccess, setJoinSuccess] = React.useState<string | null>(null);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Captain team editing, player removal, and team deletion states
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [isSavingEdits, setIsSavingEdits] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<TeamMemberRow | null>(null);
  const [isRemovingMember, setIsRemovingMember] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = React.useState(false);

  React.useEffect(() => {
    async function loadTeam() {
      const res = await fetch(`/api/teams/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setTeam(normalizeTeamData(data.team as TeamDetail));

      // Check current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const captainFlag = data.team.captain_id === user.id;
        setIsCaptain(captainFlag);

        const memberMatch = (data.team.team_members as TeamMemberRow[]).find(
          (m) => m.user?.id === user.id
        );
        setIsMember(!!memberMatch);

        // Check for pending join request
        const { data: existingReq } = await supabase
          .from("team_join_requests")
          .select("id, status")
          .eq("team_id", id)
          .eq("user_id", user.id)
          .eq("status", "PENDING")
          .single();

        setHasPendingRequest(!!existingReq);

        // Captain: load pending join requests and leave requests
        if (captainFlag) {
          const reqRes = await fetch(`/api/teams/${id}/join`);
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            setJoinRequests(reqData.requests || []);
          }

          const leaveRes = await fetch(`/api/teams/${id}/leave`);
          if (leaveRes.ok) {
            const leaveData = await leaveRes.json();
            setLeaveRequests(leaveData.requests || []);
          }
        } else if (memberMatch) {
          // Member: load user leave request status
          const leaveRes = await fetch(`/api/teams/${id}/leave`);
          if (leaveRes.ok) {
            const leaveData = await leaveRes.json();
            setUserLeaveRequest(leaveData.userRequest || null);
          }
        }
      }

      setIsLoading(false);
    }

    loadTeam();
  }, [id, supabase]);

  const handleLeaveAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingLeaveId(requestId);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}/leave/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || `Failed to ${action} leave request.`);
        return;
      }

      setLeaveRequests((prev) => prev.filter((r) => r.id !== requestId));
      setActionSuccess(action === "approve" ? "Player leave request approved and removed from squad." : "Leave request rejected.");
      setTimeout(() => setActionSuccess(null), 4000);

      // Reload team
      const teamRes = await fetch(`/api/teams/${id}`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(normalizeTeamData(teamData.team as TeamDetail));
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRequestLeave = async () => {
    if (!currentUserId) return;
    setIsSubmittingLeave(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: leaveReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to submit leave request.");
      } else {
        setUserLeaveRequest({ id: data.requestId || "pending", status: "PENDING" });
        setShowLeaveModal(false);
        setLeaveReason("");
        setActionSuccess("Leave request submitted. Awaiting captain approval.");
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleCancelLeaveRequest = async () => {
    if (!currentUserId) return;
    setIsSubmittingLeave(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}/leave`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to cancel leave request.");
      } else {
        setUserLeaveRequest(null);
        setActionSuccess("Leave request withdrawn.");
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleJoinRequest = async () => {
    setJoinError(null);
    setJoinSuccess(null);

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch(`/api/teams/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: joinMessage,
          position_applying_for: joinPosition,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Failed to send join request.");
      } else {
        setJoinSuccess(data.message || "Join request sent!");
        setHasPendingRequest(true);
      }
    } catch {
      setJoinError("Network error. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingRequestId(requestId);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}/join/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || `Failed to ${action} request.`);
        return;
      }

      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      setInspectingRequest(null);
      setActionSuccess(action === "approve" ? "Player approved and added to squad!" : "Join request rejected.");
      setTimeout(() => setActionSuccess(null), 4000);

      // Reload team to update member list + count
      const teamRes = await fetch(`/api/teams/${id}`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(normalizeTeamData(teamData.team as TeamDetail));
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleSaveTeamEdits = async (data: {
    name: string;
    logo_url: string | null;
    bio: string;
    city: string;
    target_tournament: string | null;
    positions_needed: string;
    max_players: number;
    stats: { matches: number; won: number; lost: number; draw: number };
  }) => {
    if (!team) return;
    setIsSavingEdits(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionError(resData.error || "Failed to update team details.");
        return;
      }

      setShowEditModal(false);
      setActionSuccess("Team details updated successfully!");
      setTimeout(() => setActionSuccess(null), 4000);

      // Refresh team data
      if (resData.team) {
        setTeam((prev) => {
          if (!prev) return prev;
          return normalizeTeamData({
            ...prev,
            ...resData.team,
            team_members: prev.team_members,
          });
        });
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !team) return;
    setIsRemovingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${id}/members/${memberToRemove.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to remove player.");
        return;
      }

      const playerName = memberToRemove.user?.first_name || memberToRemove.user?.full_name || "Player";
      setActionSuccess(`${playerName} has been removed from the squad.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setMemberToRemove(null);

      // Update team member state
      setTeam((prev) => {
        if (!prev) return prev;
        const updatedMembers = prev.team_members.filter((m) => m.id !== memberToRemove.id);
        return {
          ...prev,
          team_members: updatedMembers,
          current_players: Math.max(1, (prev.current_players || 1) - 1),
        };
      });
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    setIsDeletingTeam(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to delete team.");
        setIsDeletingTeam(false);
        return;
      }

      setShowDeleteModal(false);
      setActionSuccess(`Team "${team.name}" has been permanently deleted.`);
      setTimeout(() => {
        router.push("/teams");
      }, 1200);
    } catch {
      setActionError("Network error. Please try again.");
      setIsDeletingTeam(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-5xl">🏆</div>
        <h1 className="text-xl font-bold">Team not found</h1>
        <Link href="/teams">
          <Button variant="outline">← Back to Teams</Button>
        </Link>
      </div>
    );
  }

  const sportSlug = team.sport?.slug || "";
  const sportPositions = getSportPositions(sportSlug);
  const activeMemberList = team.team_members?.filter(m => m.status === "ACTIVE") || [];
  const memberCount = Math.max(team.current_players || 1, activeMemberList.length);
  const captainDisplayName = team.captain?.first_name || team.captain?.full_name?.split(" ")[0] || "Captain";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast notifications */}
      {actionSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 animate-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 animate-in slide-in-from-top-3">
          <AlertCircle className="h-4 w-4 text-red-500" />
          {actionError}
        </div>
      )}

      {/* Applicant Profile Modal */}
      {inspectingRequest && (
        <ApplicantProfileModal
          request={inspectingRequest}
          teamName={team.name}
          onClose={() => setInspectingRequest(null)}
          onApprove={(reqId) => handleRequestAction(reqId, "approve")}
          onReject={(reqId) => handleRequestAction(reqId, "reject")}
          isProcessing={processingRequestId === inspectingRequest.id}
        />
      )}

      {/* Back */}
      <Link href="/teams" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Teams
      </Link>

      {/* Team Header Card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl shrink-0 border border-border overflow-hidden relative shadow-sm">
              {team.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                getSportEmoji(sportSlug)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">{team.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {team.sport && (
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                    {getSportEmoji(sportSlug)} {team.sport.name}
                  </span>
                )}
                {team.city && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    {team.city}
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {memberCount} / {team.max_players || 15} players
                </span>
              </div>

              {/* Target / Next Tournament Badge */}
              {team.target_tournament && (
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 text-xs font-semibold">
                  <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Targeting Tournament:</span>
                  <span className="font-extrabold text-foreground">{team.target_tournament}</span>
                </div>
              )}
            </div>
          </div>

          {/* Captain Edit & Delete Team Buttons */}
          {isCaptain && (
            <div className="flex items-center gap-2 shrink-0 self-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="gap-1.5 text-xs font-semibold shadow-sm border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                <Pencil className="h-3.5 w-3.5 text-primary" />
                <span>Edit Team</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="gap-1.5 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shadow-sm"
                title="Permanently delete team from database"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          )}
        </div>

        {team.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
            {team.bio}
          </p>
        )}
      </div>

      {/* Team Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Captain */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Captain
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <Crown className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">{captainDisplayName}</p>
              {team.captain?.city && (
                <p className="text-xs text-muted-foreground">{team.captain.city}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              Record
            </div>
            {isCaptain && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                title="Edit team match record"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm font-mono">
            <span><strong className="text-emerald-600 font-bold">{team.stats?.won ?? 0}</strong> W</span>
            <span><strong className="text-red-500 font-bold">{team.stats?.lost ?? 0}</strong> L</span>
            <span><strong className="text-muted-foreground font-bold">{team.stats?.draw ?? 0}</strong> D</span>
            <span className="text-xs text-muted-foreground">{team.stats?.matches ?? 0} played</span>
          </div>
        </div>
      </div>

      {/* Positions Needed */}
      {team.positions_needed && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">
            Looking for
          </p>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">{team.positions_needed}</p>
        </div>
      )}

      {/* Players / Roster */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          Players ({memberCount})
        </h2>
        {team.team_members?.filter(m => m.status === "ACTIVE").length === 0 ? (
          <p className="text-sm text-muted-foreground">No active players listed yet.</p>
        ) : (
          <div className="space-y-2">
            {team.team_members
              ?.filter(m => m.status === "ACTIVE")
              .map((member) => {
                const displayName = member.user?.first_name && (member.user as any)?.last_name
                  ? `${member.user.first_name} ${(member.user as any).last_name}`
                  : member.user?.full_name || member.user?.first_name || "Player";
                const isCaptainRow = team.captain_id === member.user?.id || member.role_in_team?.toUpperCase() === "CAPTAIN";
                return (
                  <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                        {member.user?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {displayName}
                        {isCaptainRow && " 👑"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                        {member.role_in_team}
                      </span>
                      {/* Captain remove player button */}
                      {isCaptain && !isCaptainRow && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 rounded-lg"
                          title="Remove player from squad"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Request to Join */}
      {!isCaptain && !isMember && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Request to Join
          </h2>

          {joinSuccess ? (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
              <div>{joinSuccess}</div>
            </div>
          ) : hasPendingRequest ? (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <div>You already have a pending join request for this team.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {joinError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{joinError}</div>
                </div>
              )}

              {/* Position */}
              {sportPositions.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Position / Role Applying For
                  </label>
                  <select
                    value={joinPosition}
                    onChange={(e) => setJoinPosition(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a position...</option>
                    {sportPositions.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                    <option value="Any">Any position</option>
                  </select>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Message to Captain (optional)
                </label>
                <Input
                  placeholder="Tell the captain a bit about yourself..."
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                />
              </div>

              <Button
                variant="sports"
                onClick={handleJoinRequest}
                disabled={isJoining}
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                {isJoining ? "Sending Request..." : "Request to Join"}
              </Button>

              {!currentUserId && (
                <p className="text-xs text-center text-muted-foreground">
                  You need to{" "}
                  <Link href="/login" className="text-primary font-semibold hover:underline">
                    sign in
                  </Link>{" "}
                  to request to join.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Already a member */}
      {isMember && !isCaptain && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <div className="font-semibold">You are a member of this team.</div>
              {userLeaveRequest && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-normal mt-0.5">
                  Leave request pending captain approval.
                </p>
              )}
            </div>
          </div>
          {userLeaveRequest ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelLeaveRequest}
              disabled={isSubmittingLeave}
              className="text-xs self-start sm:self-auto text-muted-foreground hover:text-foreground"
            >
              {isSubmittingLeave ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Cancel Leave Request
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLeaveModal(true)}
              className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive self-start sm:self-auto gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave Team
            </Button>
          )}
        </div>
      )}

      {/* Captain view */}
      {isCaptain && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
          <Crown className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="font-medium">You are the captain of this team.</div>
        </div>
      )}

      {/* Captain: Unified Team Requests (Join & Leave tabs) */}
      {isCaptain && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Team Requests
                {(joinRequests.length > 0 || leaveRequests.length > 0) && (
                  <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                    {joinRequests.length + leaveRequests.length} pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage incoming player applications and squad departure requests
              </p>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRequestsTab("join")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  requestsTab === "join"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Join ({joinRequests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRequestsTab("leave")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  requestsTab === "leave"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Leave ({leaveRequests.length})</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Join Requests */}
          {requestsTab === "join" && (
            <div>
              {joinRequests.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  No pending join requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((req) => {
                    const displayName = req.user?.first_name && req.user?.last_name
                      ? `${req.user.first_name} ${req.user.last_name}`
                      : req.user?.full_name || "Player";
                    const isProcessing = processingRequestId === req.id;
                    return (
                      <div key={req.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:border-primary/40 transition-colors">
                        <div
                          onClick={() => setInspectingRequest(req)}
                          className="flex items-center gap-3 min-w-0 cursor-pointer group/applicant flex-1"
                          title="Click to view full player profile"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-border group-hover/applicant:border-primary overflow-hidden transition-colors">
                            {req.user?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={req.user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm group-hover/applicant:text-primary transition-colors">{displayName}</p>
                              <span className="text-[10px] text-primary bg-primary/10 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Eye className="h-2.5 w-2.5" /> View Profile
                              </span>
                            </div>
                            {req.position_applying_for && (
                              <p className="text-xs text-muted-foreground truncate">Position: {req.position_applying_for}</p>
                            )}
                            {req.message && (
                              <p className="text-xs text-muted-foreground italic truncate">"{req.message}"</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleRequestAction(req.id, "reject")}
                            className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            variant="sports"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleRequestAction(req.id, "approve")}
                            className="gap-1.5 text-xs"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {isProcessing ? "Adding..." : "Approve"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Leave Requests */}
          {requestsTab === "leave" && (
            <div>
              {leaveRequests.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <LogOut className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  No pending leave requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((req) => {
                    const displayName = req.user?.first_name && req.user?.last_name
                      ? `${req.user.first_name} ${req.user.last_name}`
                      : req.user?.full_name || "Player";
                    const isProcessing = processingLeaveId === req.id;
                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:border-amber-500/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-border overflow-hidden">
                            {req.user?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={req.user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{displayName}</p>
                              {req.user?.username && <span className="text-xs text-primary font-mono">@{req.user.username}</span>}
                            </div>
                            {req.reason ? (
                              <p className="text-xs text-muted-foreground italic mt-0.5">"{req.reason}"</p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">Requested to leave the team</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleLeaveAction(req.id, "reject")}
                            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Reject
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleLeaveAction(req.id, "approve")}
                            className="gap-1.5 text-xs shadow-sm"
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
            </div>
          )}
        </div>
      )}

      {/* Player Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200" onClick={() => setShowLeaveModal(false)}>
          <div
            className="bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Leave {team.name}</h3>
                </div>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  aria-label="Close"
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to request to leave <strong className="text-foreground">{team.name}</strong>? Your request will be sent to the captain for approval.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-foreground mb-1 block">
                  Reason for leaving (optional)
                </label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Relocating, schedule conflict..."
                  className="w-full text-xs p-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setShowLeaveModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRequestLeave}
                  disabled={isSubmittingLeave}
                  className="gap-1.5"
                >
                  {isSubmittingLeave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Submit Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captain Edit Team Modal */}
      {showEditModal && team && (
        <EditTeamModal
          team={team}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveTeamEdits}
          isSaving={isSavingEdits}
          onOpenDeleteModal={() => setShowDeleteModal(true)}
        />
      )}

      {/* Captain Remove Member Modal */}
      {memberToRemove && team && (
        <RemoveMemberModal
          member={memberToRemove}
          teamName={team.name}
          onClose={() => setMemberToRemove(null)}
          onConfirm={handleRemoveMember}
          isRemoving={isRemovingMember}
        />
      )}

      {/* Captain Delete Team Modal */}
      {showDeleteModal && team && (
        <DeleteTeamModal
          teamName={team.name}
          onClose={() => {
            setShowDeleteModal(false);
            setActionError(null);
          }}
          onConfirm={handleDeleteTeam}
          isDeleting={isDeletingTeam}
          errorMessage={actionError}
        />
      )}
    </div>
  );
}
