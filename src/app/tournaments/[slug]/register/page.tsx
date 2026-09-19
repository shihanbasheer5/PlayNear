"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ChevronLeft,
  Users,
  CheckCircle2,
  ShieldCheck,
  Shield,
  ShieldAlert,
  CreditCard,
  AlertCircle,
  PlusCircle,
  Search,
  UserPlus,
  Clock,
  Lock,
  ClipboardList,
} from "lucide-react";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isTournamentRegistrationOpen } from "@/lib/tournament-status";
import { getSportEmoji } from "@/lib/sports-config";
import { createClient } from "@/lib/supabase/client";
import { Tournament } from "@/types/database.types";

interface UserTeamItem {
  id: string;
  name: string;
  city: string | null;
  role_in_team: string;
  is_captain: boolean;
  sport?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

// ─── Helper: Dynamically Load Razorpay Checkout Script ────────────────────────
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Main Registration Page ──────────────────────────────────────────────────
export default function TournamentRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const supabase = createClient();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [registeredCount, setRegisteredCount] = React.useState(0);
  const [userTeams, setUserTeams] = React.useState<UserTeamItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = React.useState<string>("");
  const [registrationMode, setRegistrationMode] = React.useState<"choose" | "find" | "register">("choose");
  const [agreedToRules, setAgreedToRules] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [paidPaymentId, setPaidPaymentId] = React.useState<string>("");
  const [paidAmount, setPaidAmount] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace(`/login?redirect=/tournaments/${slug}/register`);
          return;
        }

        // Check if user is a tournament host/organizer
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = (profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase();
        if (role === "ORGANIZER") {
          router.replace(`/tournaments/${slug}`);
          return;
        }

        setCurrentUser(user);

        // 1. Fetch tournament by slug
        const { data: tourneyData } = await supabase
          .from("tournaments")
          .select(`
            *,
            sport:sports(id, name, slug, icon_name),
            organizer:profiles(id, full_name, first_name)
          `)
          .eq("slug", slug)
          .single();

        if (tourneyData) {
          setTournament({
            ...tourneyData,
            title: tourneyData.title || tourneyData.name || "Tournament",
          } as unknown as Tournament);

          // Fetch current registration count
          const { count } = await supabase
            .from("tournament_teams")
            .select("id", { count: "exact" })
            .eq("tournament_id", tourneyData.id);
          setRegisteredCount(count ?? 0);
        } else {
          const fallback = MOCK_TOURNAMENTS.find((t) => t.slug === slug);
          if (fallback) setTournament(fallback);
        }

        // 2. Fetch user's team memberships
        const { data: memberships } = await supabase
          .from("team_members")
          .select(`
            id,
            role_in_team,
            team:teams(
              id,
              name,
              city,
              captain_id,
              sport:sports(id, name, slug)
            )
          `)
          .eq("user_id", user.id)
          .eq("status", "ACTIVE");

        // Fetch teams where user is captain
        const { data: captainTeams } = await supabase
          .from("teams")
          .select(`
            id,
            name,
            city,
            captain_id,
            sport:sports(id, name, slug)
          `)
          .eq("captain_id", user.id);

        const memberTeamsList: UserTeamItem[] = (memberships || [])
          .filter((m) => m.team)
          .map((m: any) => {
            const isCap = m.team.captain_id === user.id || m.role_in_team?.toUpperCase() === "CAPTAIN";
            return {
              id: m.team.id,
              name: m.team.name,
              city: m.team.city,
              role_in_team: isCap ? "CAPTAIN" : (m.role_in_team || "MEMBER"),
              is_captain: isCap,
              sport: m.team.sport,
            };
          });

        const existingTeamIds = new Set(memberTeamsList.map((t) => t.id));
        const extraCaptainTeams: UserTeamItem[] = (captainTeams || [])
          .filter((t) => !existingTeamIds.has(t.id))
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            city: t.city,
            role_in_team: "CAPTAIN",
            is_captain: true,
            sport: t.sport,
          }));

        // Captain teams first, then other teams
        const combinedList = [...memberTeamsList, ...extraCaptainTeams].sort((a, b) => {
          if (a.is_captain && !b.is_captain) return -1;
          if (!a.is_captain && b.is_captain) return 1;
          return a.name.localeCompare(b.name);
        });

        setUserTeams(combinedList);

        // Preselect ONLY the first team where user is captain!
        const firstCaptainTeam = combinedList.find((t) => t.is_captain);
        if (firstCaptainTeam) {
          setSelectedTeamId(firstCaptainTeam.id);
        } else {
          setSelectedTeamId("");
        }
      } catch (err) {
        console.error("Failed to load registration data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const isFull =
    tournament?.max_teams != null && registeredCount >= tournament.max_teams;

  // ─── Registration & Payment Submission ──────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!agreedToRules) {
      setErrorMessage("Please agree to the tournament rules and waiver.");
      return;
    }
    if (registrationMode === "choose") {
      setErrorMessage("Please select an option: Find a Team or Register a Team.");
      return;
    }
    if (!selectedTeamId) {
      setErrorMessage("Please select a team to register with.");
      return;
    }
    const chosenTeam = userTeams.find((t) => t.id === selectedTeamId);
    if (!chosenTeam) {
      setErrorMessage("Please select a valid team to register with.");
      return;
    }
    if (!chosenTeam.is_captain) {
      setErrorMessage(`Permission denied: Only the captain of "${chosenTeam.name}" is authorized to register this squad for tournaments.`);
      return;
    }
    if (isFull) {
      setErrorMessage("This tournament is full. No more registrations are being accepted.");
      return;
    }
    if (!tournament) return;

    const entryFee = tournament.entry_fee ?? 0;

    // Free tournament: direct submission
    if (entryFee <= 0) {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: selectedTeamId,
            payment_method: "FREE",
            payment_ref: "FREE_REGISTRATION",
            payment_amount: 0,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Failed to submit tournament registration.");
        } else {
          setPaidPaymentId("FREE_REGISTRATION");
          setPaidAmount(0);
          setIsSuccess(true);
        }
      } catch {
        setErrorMessage("Network error. Please check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Paid tournament: Razorpay Checkout
    setIsSubmitting(true);
    try {
      // 1. Create Razorpay order on server
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: tournament.id,
          team_id: selectedTeamId,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setErrorMessage(orderData.error || "Failed to initialize payment. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // If Razorpay keys are not yet provided in .env.local (simulated test mode)
      if (orderData.isMock) {
        const testPaymentId = `pay_test_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        // Verify test payment
        await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: orderData.order_id,
            razorpay_payment_id: testPaymentId,
            is_mock: true,
          }),
        });

        // Register team in database
        const regRes = await fetch(`/api/tournaments/${tournament.id}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: selectedTeamId,
            payment_method: "RAZORPAY",
            payment_ref: testPaymentId,
            payment_order_id: orderData.order_id,
            payment_amount: entryFee,
          }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          setErrorMessage(regData.error || "Failed to complete tournament registration.");
        } else {
          setPaidPaymentId(testPaymentId);
          setPaidAmount(entryFee);
          setIsSuccess(true);
        }
        setIsSubmitting(false);
        return;
      }

      // 2. Real Razorpay Checkout flow
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !(window as any).Razorpay) {
        setErrorMessage("Razorpay Checkout could not be loaded. Please check your internet connection.");
        setIsSubmitting(false);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "PlayNear",
        image: "/logo.png",
        description: `Registration for ${tournament.title}`,
        order_id: orderData.order_id,
        prefill: {
          name: currentUser?.user_metadata?.full_name || currentUser?.email || "",
          email: currentUser?.email || "",
          contact: currentUser?.user_metadata?.phone || "",
        },
        notes: {
          tournament_id: tournament.id,
          team_id: selectedTeamId,
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
          },
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // Verify payment signature
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              setErrorMessage(verifyData.error || "Payment verification failed.");
              setIsSubmitting(false);
              return;
            }

            // Complete team registration
            const regRes = await fetch(`/api/tournaments/${tournament.id}/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                team_id: selectedTeamId,
                payment_method: "RAZORPAY",
                payment_ref: response.razorpay_payment_id,
                payment_order_id: response.razorpay_order_id,
                payment_amount: entryFee,
              }),
            });

            const regData = await regRes.json();
            if (!regRes.ok) {
              setErrorMessage(
                regData.error ||
                `Payment received (${response.razorpay_payment_id}), but saving registration failed. Please contact the tournament organizer.`
              );
            } else {
              setPaidPaymentId(response.razorpay_payment_id);
              setPaidAmount(entryFee);
              setIsSuccess(true);
            }
          } catch {
            setErrorMessage("An unexpected error occurred while finalizing your registration.");
          } finally {
            setIsSubmitting(false);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", function (failResponse: any) {
        setErrorMessage(failResponse.error?.description || "Payment failed. Please try again.");
        setIsSubmitting(false);
      });
      razorpayInstance.open();
    } catch (err) {
      console.error("Razorpay initiation error:", err);
      setErrorMessage("Could not initiate payment. Please try again.");
      setIsSubmitting(false);
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
        <h1 className="text-2xl font-bold">Tournament Not Found</h1>
        <Link href="/tournaments">
          <Button variant="sports">← Back to Tournaments</Button>
        </Link>
      </div>
    );
  }

  const selectedTeamObj = userTeams.find((t) => t.id === selectedTeamId);
  const selectedTeamName = selectedTeamObj?.name || "Your Squad";
  const isSelectedTeamCaptain = !!selectedTeamObj?.is_captain;
  const captainTeamsCount = userTeams.filter((t) => t.is_captain).length;
  const entryFee = tournament.entry_fee ?? 0;
  const slotsLeft =
    tournament.max_teams != null ? tournament.max_teams - registeredCount : null;

  // ─── Registration Successful View ───────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            ✅ Registration Successful
          </h1>
          <p className="text-base text-muted-foreground">
            Your team <strong className="text-foreground">{selectedTeamName}</strong> has been registered for{" "}
            <strong className="text-foreground">{tournament.title}</strong>
          </p>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <Clock className="h-3.5 w-3.5" />
          Registration Status: Pending Approval
        </div>

        {/* Payment & Tournament Summary Card */}
        <div className="bg-card border border-border p-5 rounded-2xl text-sm text-left space-y-3 shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground text-xs">Payment ID:</span>
            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2.5 py-1 rounded-md">
              {paidPaymentId || "FREE_REGISTRATION"}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground text-xs">Amount Paid:</span>
            <span className="font-mono text-base font-extrabold text-emerald-600">
              {paidAmount === 0 ? "₹0 (Free)" : formatCurrency(paidAmount, tournament.currency || "INR")}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground text-xs">Tournament:</span>
            <span className="font-semibold text-xs text-foreground">{tournament.title}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-muted-foreground text-xs">Registered Team:</span>
            <span className="font-semibold text-xs text-foreground">{selectedTeamName}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs">Tournament Start:</span>
            <span className="text-xs text-foreground">{formatDate(tournament.tournament_start_date)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/registered-tournaments" className="w-full sm:w-auto">
            <Button variant="sports" size="lg" className="w-full sm:w-auto gap-2 font-bold">
              <ClipboardList className="h-4 w-4" />
              View Registration
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Registration Closed View ──────────────────────────────────────────────
  if (!isTournamentRegistrationOpen(tournament)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Lock className="h-10 w-10 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Registration Closed
          </h1>
          <p className="text-base text-muted-foreground">
            Registration for <strong className="text-foreground">{tournament.title}</strong> is closed because this tournament started on{" "}
            <strong className="text-foreground">{formatDate(tournament.tournament_start_date)}</strong>.
          </p>
        </div>

        <div className="pt-4">
          <Link href={`/tournaments/${tournament.slug}`}>
            <Button variant="sports" size="lg">
              View Tournament Details & Fixtures
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main Form View ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href={`/tournaments/${tournament.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Tournament Details
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Register Squad for Tournament
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete the steps below to secure your team's entry into{" "}
          <strong className="text-foreground">{tournament.title}</strong>.
        </p>
      </div>

      {/* Tournament summary banner */}
      <div className="bg-muted/40 border border-border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tournament.sport?.name || "Sport"}</Badge>
            <Badge variant="secondary">{tournament.format}</Badge>
            {isFull ? (
              <Badge variant="destructive">Registration Full</Badge>
            ) : slotsLeft != null ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} left
              </Badge>
            ) : null}
          </div>
          <p className="font-bold text-base">{tournament.title}</p>
          <p className="text-xs text-muted-foreground">
            {tournament.venue_name ? `${tournament.venue_name}, ` : ""}
            {tournament.venue_city || ""} · Starts {formatDate(tournament.tournament_start_date)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Entry Fee</p>
          <p className="text-2xl font-extrabold font-mono text-primary">
            {entryFee === 0 ? "FREE" : formatCurrency(entryFee, tournament.currency || "INR")}
          </p>
        </div>
      </div>

      {/* Capacity Warning */}
      {isFull && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Tournament Registration is Full</p>
            <p className="text-xs mt-0.5 text-destructive/90">
              All {tournament.max_teams} slots have been filled. You cannot register new teams at this time.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleRegisterSubmit} className="space-y-6">
        {/* Step 1: Participation Mode */}
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Step 1: How do you want to participate?
            </h2>
            <span className="text-xs text-muted-foreground font-mono">1 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option A: Register a Team */}
            <div
              onClick={() => setRegistrationMode("register")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                registrationMode === "register"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    registrationMode === "register"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm">Register a Team</p>
                  <p className="text-xs text-muted-foreground">
                    I am the captain/manager and want to register our existing squad.
                  </p>
                </div>
              </div>
            </div>

            {/* Option B: Find a Team (Free Agent) */}
            <div
              onClick={() => setRegistrationMode("find")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                registrationMode === "find"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    registrationMode === "find"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Search className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm">Find a Team (Free Agent)</p>
                  <p className="text-xs text-muted-foreground">
                    I am a solo player looking for an open squad to join.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* If Free Agent selected */}
          {registrationMode === "find" && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs space-y-2">
              <p className="font-bold text-sm">Looking for a Squad?</p>
              <p>
                You can browse participating teams and contact team captains directly, or create your own squad to compete together.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/teams?sport=${encodeURIComponent(tournament.sport?.slug || "")}`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    Browse Teams
                  </Button>
                </Link>
                <Link href={`/teams/new?sport=${tournament.sport?.slug || ""}&target_tournament=${encodeURIComponent(tournament.title)}`}>
                  <Button size="sm" variant="sports" className="text-xs">
                    Create Team for This Tournament
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Team Selection when Register a Team is active */}
          {registrationMode === "register" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Select Your Team
                </label>
                {captainTeamsCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {captainTeamsCount} eligible squad{captainTeamsCount !== 1 ? "s" : ""} (Captain)
                  </span>
                )}
              </div>

              {userTeams.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/40 border border-dashed border-border text-center space-y-2">
                  <Users className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-semibold">No teams found</p>
                  <p className="text-xs text-muted-foreground">
                    You need to create a team as captain before you can register for this tournament.
                  </p>
                  <Link href={`/teams/new?sport=${tournament.sport?.slug || ""}&target_tournament=${encodeURIComponent(tournament.title)}`}>
                    <Button size="sm" variant="sports" className="gap-1.5 mt-2">
                      <UserPlus className="h-4 w-4" /> Create a Team
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Warning banner if user has teams but is not a captain of any team */}
                  {captainTeamsCount === 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Captain Permissions Required</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        Only team captains have permission to register a squad for tournaments.
                        You are a player in the team(s) below, so registration is locked. You can create a new team to register as captain, or request your captain to register.
                      </p>
                      <Link href={`/teams/new?sport=${tournament.sport?.slug || ""}&target_tournament=${encodeURIComponent(tournament.title)}`}>
                        <Button size="sm" variant="sports" className="text-xs gap-1.5 mt-1 font-bold">
                          <UserPlus className="h-3.5 w-3.5" /> Create a Team as Captain
                        </Button>
                      </Link>
                    </div>
                  )}

                  <div className="space-y-2">
                    {userTeams.map((team) => {
                      const isEligible = team.is_captain;
                      const isSelected = selectedTeamId === team.id;

                      if (isEligible) {
                        return (
                          <label
                            key={team.id}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30 font-semibold shadow-xs"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="radio"
                                name="selectedTeam"
                                value={team.id}
                                checked={isSelected}
                                onChange={() => setSelectedTeamId(team.id)}
                                className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{team.name}</p>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  {team.sport && (
                                    <span className="capitalize">{getSportEmoji(team.sport.slug)} {team.sport.name}</span>
                                  )}
                                  {team.city && (
                                    <>
                                      <span>•</span>
                                      <span>{team.city}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge className="text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold gap-1 shrink-0">
                              <Shield className="h-3 w-3 text-amber-500" /> Captain (Eligible)
                            </Badge>
                          </label>
                        );
                      }

                      // Locked team: user is only a player/member
                      return (
                        <div
                          key={team.id}
                          title="Locked: Only the team captain can register this squad"
                          className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-border/80 bg-muted/20 opacity-60 cursor-not-allowed select-none transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center bg-muted/60 text-muted-foreground shrink-0">
                              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-muted-foreground truncate">{team.name}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Lock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                <span>Player only — Captain must register</span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[11px] text-muted-foreground border-border/80 gap-1 bg-muted/40 shrink-0">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Payment Details */}
        <div className="bg-card border border-border p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Step 2: Entry Fee & Payment
            </h2>
            <span className="text-xs text-muted-foreground font-mono">2 of 3</span>
          </div>

          <div className="bg-muted/30 p-4 rounded-xl space-y-2 border border-border/60">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tournament Entry Fee:</span>
              <span className="font-mono font-medium">
                {entryFee === 0 ? (
                  <span className="text-emerald-600 font-bold">FREE</span>
                ) : (
                  formatCurrency(entryFee, tournament.currency || "INR")
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Platform Processing:</span>
              <span className="text-emerald-600 font-semibold">₹0 (Free)</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-extrabold text-base">
              <span>Total Payable:</span>
              <span className="text-primary font-mono">
                {entryFee === 0 ? "FREE" : formatCurrency(entryFee, tournament.currency || "INR")}
              </span>
            </div>
          </div>

          {entryFee > 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 bg-blue-500/10 p-3 rounded-lg text-blue-700 dark:text-blue-300">
              <CreditCard className="h-4 w-4 shrink-0 text-blue-500" />
              <span>Payment will be securely processed via Razorpay Checkout (UPI, Credit/Debit Card, Netbanking).</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-2 bg-emerald-500/10 p-3 rounded-lg text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>This is a free tournament. No payment required.</span>
            </div>
          )}
        </div>

        {/* Step 3: Waiver Agreement */}
        <div className="bg-card border border-border p-6 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Step 3: Rules & Waiver Acknowledgment
            </h3>
            <span className="text-xs text-muted-foreground font-mono">3 of 3</span>
          </div>

          <label className="flex items-start gap-3 cursor-pointer text-xs text-muted-foreground leading-relaxed">
            <input
              type="checkbox"
              checked={agreedToRules}
              onChange={(e) => setAgreedToRules(e.target.checked)}
              className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4"
              required
            />
            <span>
              I confirm that all registered squad members agree to abide by the tournament rules, fair play code of conduct, and standard sports liability waiver.
            </span>
          </label>
        </div>

        {/* Submit */}
        <div className="space-y-2">
          {registrationMode === "register" && (!selectedTeamId || !isSelectedTeamCaptain) && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ You can only register a squad where you are Captain.
            </p>
          )}
          <Button
            type="submit"
            variant="sports"
            size="lg"
            disabled={
              !agreedToRules ||
              isSubmitting ||
              (registrationMode === "register" && (!selectedTeamId || !isSelectedTeamCaptain)) ||
              isFull
            }
            className="w-full font-bold shadow-lg"
          >
            {isFull
              ? "Registration Full"
              : isSubmitting
              ? "Processing Registration & Payment..."
              : registrationMode === "register" && !isSelectedTeamCaptain
              ? "Captain Role Required to Register"
              : entryFee > 0
              ? `Submit Registration & Pay for ${selectedTeamName}`
              : `Submit Registration for ${selectedTeamName}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
