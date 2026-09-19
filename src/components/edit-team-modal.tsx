"use client";

import * as React from "react";
import {
  Pencil,
  X,
  Upload,
  Link2,
  Trophy,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EditTeamFormData {
  name: string;
  logo_url: string | null;
  bio: string;
  city: string;
  target_tournament: string | null;
  positions_needed: string;
  max_players: number;
  stats: { matches: number; won: number; lost: number; draw: number };
}

export interface EditTeamModalTeam {
  id: string;
  name: string;
  city?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  target_tournament?: string | null;
  positions_needed?: string | null;
  max_players?: number | null;
  stats?: { matches: number; won: number; lost: number; draw: number } | null;
  sport?: { name?: string; slug?: string } | null;
}

interface EditTeamModalProps {
  team: EditTeamModalTeam;
  onClose: () => void;
  onSave: (data: EditTeamFormData) => Promise<void>;
  isSaving: boolean;
  onOpenDeleteModal?: () => void;
}

export function EditTeamModal({
  team,
  onClose,
  onSave,
  isSaving,
  onOpenDeleteModal,
}: EditTeamModalProps) {
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

  // Load active tournaments
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
      setFormError("Image is too large. Please choose an image under 3MB.");
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

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setLogoUrl(urlInput.trim());
    setFormError(null);
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
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                      setFormError("Unable to display image. Check the URL or upload a file.");
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-medium text-foreground truncate">Custom Team Crest Active</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearLogo}
                      className="text-xs h-7 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Remove Logo
                    </Button>
                  </div>
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
                    <span>Image URL</span>
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
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-4 cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all text-center group"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary mb-1.5 transition-colors">
                        <Upload className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Click to upload team crest</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WEBP or GIF (Max 3MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste Google or web image URL..."
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
                      onClick={handleApplyUrl}
                      className="text-xs shrink-0"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Target / Next Tournament Interested */}
          <div className="space-y-1.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <label className="text-xs font-bold text-foreground">Target / Upcoming Tournament</label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Declare what tournament your squad intends to compete in, or change/clear it after a tournament ends so players know your next goal.
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
          {onOpenDeleteModal && (
            <div className="pt-2 border-t border-destructive/20">
              <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <div>
                  <p className="text-xs font-bold text-destructive">Disband / Delete Team</p>
                  <p className="text-[11px] text-muted-foreground">Permanently remove squad, rosters, and match history.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenDeleteModal();
                  }}
                  className="text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Squad
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-team-form"
            size="sm"
            disabled={isSaving}
            className="gap-2 text-xs font-semibold min-w-[100px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
