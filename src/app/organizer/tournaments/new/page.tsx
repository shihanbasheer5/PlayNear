"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Trophy, 
  ChevronLeft, 
  ArrowRight, 
  Check, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Layers,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_SPORTS, SupportedSportSlug, getSportEmoji } from "@/lib/sports-config";
import { createClient } from "@/lib/supabase/client";

export default function NewTournamentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = React.useState<number>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Form State
  const [sportSlug, setSportSlug] = React.useState<SupportedSportSlug>(SUPPORTED_SPORTS[0].slug);
  const [title, setTitle] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [bannerUrl, setBannerUrl] = React.useState<string>("");
  const [format, setFormat] = React.useState<string>("SINGLE_ELIMINATION");
  const [maxTeams, setMaxTeams] = React.useState<number>(8);
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = React.useState<number>(11);

  // Venue & Dates
  const [venueName, setVenueName] = React.useState<string>("");
  const [venueAddress, setVenueAddress] = React.useState<string>("");
  const [venueCity, setVenueCity] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [entryFee, setEntryFee] = React.useState<string>("");
  const [prizePool, setPrizePool] = React.useState<string>("");
  const [rulesText, setRulesText] = React.useState<string>("");

  React.useEffect(() => {
    // Check authentication and role
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

      const dbRole = (profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase();
      if (dbRole !== "ORGANIZER" && dbRole !== "ADMIN") {
        router.replace("/dashboard");
      }
    });
  }, [supabase, router]);

  const handleNext = () => {
    setErrorMessage(null);
    if (currentStep === 1 && !title.trim()) {
      setErrorMessage("Please enter a tournament title.");
      return;
    }
    if (currentStep === 3 && (!venueName.trim() || !venueCity.trim())) {
      setErrorMessage("Please provide venue name and city.");
      return;
    }
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/organizer/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sport_slug: sportSlug,
          description: description.trim(),
          banner_url: bannerUrl.trim(),
          format,
          max_teams: maxTeams,
          max_players_per_team: maxPlayersPerTeam,
          venue_name: venueName.trim(),
          venue_address: venueAddress.trim() || venueName.trim(),
          venue_city: venueCity.trim(),
          tournament_start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          tournament_end_date: endDate ? new Date(endDate).toISOString() : new Date().toISOString(),
          entry_fee: entryFee.trim(),
          prize_pool: prizePool.trim(),
          rules_text: rulesText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create tournament.");
        setIsSubmitting(false);
        return;
      }

      if (data.tournament?.id) {
        router.push(`/organizer/tournaments/${data.tournament.id}`);
        router.refresh();
      } else {
        router.push("/organizer");
        router.refresh();
      }
    } catch {
      setErrorMessage("Network connection error. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Organizer Hub
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Create a New Tournament
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up tournament details, bracket format, venue, and registration rules.
        </p>
      </div>

      {/* Stepper Progress Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        {[
          { step: 1, label: "Basic Info" },
          { step: 2, label: "Format & Squad" },
          { step: 3, label: "Venue & Location" },
          { step: 4, label: "Rules & Fees" },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                currentStep === s.step
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : currentStep > s.step
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > s.step ? <Check className="h-3.5 w-3.5" /> : s.step}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                currentStep === s.step ? "text-foreground font-bold" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: SPORT & BASIC INFO */}
        {currentStep === 1 && (
          <div className="bg-card border border-border p-6 rounded-2xl space-y-5 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Select Sport Category
            </h3>

            {/* ONLY the 4 supported sports */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUPPORTED_SPORTS.map((s) => {
                const isSelected = sportSlug === s.slug;
                return (
                  <div
                    key={s.slug}
                    onClick={() => setSportSlug(s.slug)}
                    className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 font-bold"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-3xl mb-1">{s.emoji}</div>
                    <div className="text-sm font-semibold">{s.name}</div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-foreground">Tournament Title *</label>
                <Input
                  placeholder="e.g. Bay Area Summer Champions Cup 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Description & Overview</label>
                <textarea
                  placeholder="Describe your tournament, skill levels, eligibility, and match atmosphere..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Banner Image URL</label>
                <Input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="Paste image URL here (Google images, Unsplash, Imgur, or any platform)..."
                  className="mt-1 text-xs"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave empty to automatically use a default high-quality sports cover.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FORMAT & CAPACITY */}
        {currentStep === 2 && (
          <div className="bg-card border border-border p-6 rounded-2xl space-y-5 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Tournament Format & Squad Limits
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: "SINGLE_ELIMINATION", title: "Single Knockout", desc: "Classic binary elimination bracket. Losers exit directly." },
                { id: "DOUBLE_ELIMINATION", title: "Double Knockout", desc: "Winners & Losers brackets. Eliminated only after 2 losses." },
                { id: "ROUND_ROBIN", title: "Round Robin League", desc: "Every team plays every other team with auto-updated standings." },
                { id: "GROUP_PLUS_KNOCKOUT", title: "Groups + Knockout", desc: "Group stage matches followed by Quarter/Semi finals." },
              ].map((fmt) => (
                <div
                  key={fmt.id}
                  onClick={() => setFormat(fmt.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    format === fmt.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <h4 className="font-bold text-sm">{fmt.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{fmt.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-foreground">Max Team Capacity</label>
                <select
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(Number(e.target.value))}
                  className="w-full mt-1 bg-background border border-input rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={4}>4 Teams</option>
                  <option value={8}>8 Teams</option>
                  <option value={12}>12 Teams</option>
                  <option value={16}>16 Teams</option>
                  <option value={32}>32 Teams</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Max Players Per Team</label>
                <Input
                  type="number"
                  value={maxPlayersPerTeam}
                  onChange={(e) => setMaxPlayersPerTeam(Number(e.target.value))}
                  className="mt-1"
                  min={1}
                  max={30}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VENUE & LOCATION */}
        {currentStep === 3 && (
          <div className="bg-card border border-border p-6 rounded-2xl space-y-5 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Venue & Location Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Venue / Sports Ground Name *</label>
                <Input
                  placeholder="e.g. Central Sports Complex"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Street Address / Landmark</label>
                <Input
                  placeholder="e.g. 100 Stadium Road"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">City / Region *</label>
                <Input
                  placeholder="e.g. Mumbai, San Francisco, Delhi..."
                  value={venueCity}
                  onChange={(e) => setVenueCity(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SCHEDULE, PRIZES & RULES */}
        {currentStep === 4 && (
          <div className="bg-card border border-border p-6 rounded-2xl space-y-5 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Dates, Entry Fees & Rules
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Tournament Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Tournament End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="space-y-4 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-foreground">Team Entry Fee (₹ INR)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="mt-1"
                  placeholder="0 for Free Entry (or write amount e.g. 1500)"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Type your team entry fee directly. Leave empty or 0 for free entry.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Prize Pool & Awards Description</label>
                <textarea
                  rows={4}
                  placeholder={`1st Place: ₹50,000 + Championship Trophy\n2nd Place: ₹25,000 + Runner-up Medals\n3rd Place: ₹10,000\nPlayer of the Tournament: Special Award`}
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Press Enter to write on next lines without congestion.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Match Rules & Guidelines</label>
                <textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  rows={3}
                  placeholder="Official tournament guidelines, duration, and tie-breaker policies..."
                  className="w-full mt-1 bg-background border border-input rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {currentStep > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button type="button" variant="sports" onClick={handleNext} className="gap-2">
              Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="sports"
              size="lg"
              disabled={isSubmitting}
              className="font-bold shadow-lg shadow-blue-500/25"
            >
              {isSubmitting ? "Publishing Tournament..." : "Publish Tournament Live"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
