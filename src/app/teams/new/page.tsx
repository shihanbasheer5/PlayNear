"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  Users,
  Upload,
  Link2,
  Image as ImageIcon,
  X,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_SPORTS } from "@/lib/sports-config";
import { createClient } from "@/lib/supabase/client";

export default function NewTeamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = React.useState("");
  const [sportSlug, setSportSlug] = React.useState(SUPPORTED_SPORTS[0].slug);
  const [city, setCity] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [targetTournament, setTargetTournament] = React.useState("");
  const [upcomingTournaments, setUpcomingTournaments] = React.useState<Array<{ id: string; title: string; sport?: { name?: string; slug?: string } | null }>>([]);
  const [maxPlayers, setMaxPlayers] = React.useState("15");
  const [currentPlayers, setCurrentPlayers] = React.useState("1");
  const [positionsNeeded, setPositionsNeeded] = React.useState("");

  // Team logo state (Upload or Google / Image URL)
  const [logoMode, setLogoMode] = React.useState<"upload" | "url">("upload");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [urlInput, setUrlInput] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [createdTeam, setCreatedTeam] = React.useState<{ id: string; name: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WEBP, etc.).");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMessage("Image is too large. Please select a file under 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
        setErrorMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setLogoUrl(urlInput.trim());
    setErrorMessage(null);
  };

  const handleClearLogo = () => {
    setLogoUrl("");
    setUrlInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  React.useEffect(() => {
    // Ensure user is logged in and not an organizer
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase();
      if (role === "ORGANIZER") {
        router.replace("/organizer");
      }
    });

    // Check prefilled URL query parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const prefillTournament = params.get("target_tournament") || params.get("tournament");
      if (prefillTournament) {
        setTargetTournament(prefillTournament);
      }
      const prefillSport = params.get("sport");
      if (prefillSport && SUPPORTED_SPORTS.some((s) => s.slug === prefillSport)) {
        setSportSlug(prefillSport as any);
      }
    }

    // Load upcoming tournaments for quick selection
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
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please enter a team name.");
      return;
    }
    if (!city.trim()) {
      setErrorMessage("Please enter a city / location.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sport_slug: sportSlug,
          city: city.trim(),
          bio: bio.trim(),
          target_tournament: targetTournament.trim() || null,
          logo_url: logoUrl.trim() || null,
          max_players: parseInt(maxPlayers) || 15,
          current_players: parseInt(currentPlayers) || 1,
          positions_needed: positionsNeeded.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create team.");
        setIsSubmitting(false);
        return;
      }

      setCreatedTeam({ id: data.team.id, name: data.team.name });
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (createdTeam) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-extrabold">Team Created!</h1>
        <p className="text-muted-foreground text-sm">
          <strong>{createdTeam.name}</strong> has been successfully created and saved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={`/teams/${createdTeam.id}`}>
            <Button variant="sports" className="gap-2 w-full sm:w-auto">
              View Team
            </Button>
          </Link>
          <Link href="/teams">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Search className="h-4 w-4" /> Find Players
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Users className="h-4 w-4" /> My Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back */}
      <Link href="/teams" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Teams
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">➕ Create a Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build your squad — find other players and compete in local tournaments.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          {/* Team Name */}
          <div>
            <label className="text-xs font-semibold text-foreground">Team Name *</label>
            <Input
              placeholder="e.g. Mumbai Warriors, Delhi Kings..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {/* Team Logo (Upload or Google URL) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Team Logo (Optional)
              </label>
              <span className="text-[11px] text-muted-foreground">Upload file or paste image URL</span>
            </div>

            {logoUrl ? (
              <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border bg-muted/40">
                <div className="h-16 w-16 rounded-xl border-2 border-primary/40 overflow-hidden bg-background shrink-0 flex items-center justify-center shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Team Logo Preview"
                    className="h-full w-full object-cover"
                    onError={() => setErrorMessage("Could not load image from provided URL. Please check the link.")}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Logo Selected</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                    {logoUrl.startsWith("data:") ? "Image file uploaded" : logoUrl}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearLogo}
                    className="h-7 px-2 mt-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
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
                      id="team-logo-file-input"
                    />
                    <label
                      htmlFor="team-logo-file-input"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-4 cursor-pointer bg-background/50 hover:bg-muted/30 transition-all text-center group"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary mb-1.5 transition-colors">
                        <Upload className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Click to upload team logo</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WEBP or GIF (Max 3MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Paste Google image URL or web image link..."
                          value={urlInput}
                          onChange={(e) => {
                            setUrlInput(e.target.value);
                            setLogoUrl(e.target.value.trim());
                          }}
                          className="text-xs"
                        />
                      </div>
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
                    <p className="text-[11px] text-muted-foreground">
                      Tip: Right-click any image on Google Images and choose "Copy image address".
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sport — only 4 supported */}
          <div>
            <label className="text-xs font-semibold text-foreground">Sport *</label>
            <select
              value={sportSlug}
              onChange={(e) => setSportSlug(e.target.value as import("@/lib/sports-config").SupportedSportSlug)}
              className="w-full mt-1 bg-background border border-input rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {SUPPORTED_SPORTS.map((sport) => (
                <option key={sport.slug} value={sport.slug}>
                  {sport.label}
                </option>
              ))}
            </select>
          </div>

          {/* City / Location */}
          <div>
            <label className="text-xs font-semibold text-foreground">City / Location *</label>
            <Input
              placeholder="e.g. Mumbai, Delhi, Bangalore..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {/* Target / Next Tournament Interested */}
          <div className="space-y-1.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <label className="text-xs font-bold text-foreground">Target / Upcoming Tournament (Optional)</label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Show prospective players and free agents which tournament your squad plans to register for.
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
                      // Keep whatever is currently typed in input
                    } else {
                      setTargetTournament(e.target.value);
                    }
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Select an upcoming tournament or enter custom --</option>
                  {upcomingTournaments.map((tourney) => (
                    <option key={tourney.id} value={tourney.title}>
                      🏆 {tourney.title} {tourney.sport?.name ? `(${tourney.sport.name})` : ""}
                    </option>
                  ))}
                  <option value="__custom__">✏️ Custom / Other Tournament</option>
                </select>
                <Input
                  placeholder="Or type custom tournament name (e.g. Mumbai Monsoon Trophy 2026)..."
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

          {/* Team Description */}
          <div>
            <label className="text-xs font-semibold text-foreground">Team Description</label>
            <textarea
              placeholder="Tell other players about your team, playing style, and goals..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Player count row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Current Players</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={currentPlayers}
                onChange={(e) => setCurrentPlayers(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Max Players Needed</label>
              <Input
                type="number"
                min="2"
                max="50"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Positions Needed */}
          <div>
            <label className="text-xs font-semibold text-foreground">Positions / Roles Needed</label>
            <Input
              placeholder="e.g. Midfielder, Bowler, Raider... (comma separated)"
              value={positionsNeeded}
              onChange={(e) => setPositionsNeeded(e.target.value)}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              List what positions you are actively recruiting for.
            </p>
          </div>
        </div>

        <Button
          type="submit"
          variant="sports"
          size="lg"
          disabled={isSubmitting}
          className="w-full font-bold shadow-lg gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {isSubmitting ? "Creating Team..." : "Create Team"}
        </Button>
      </form>
    </div>
  );
}
