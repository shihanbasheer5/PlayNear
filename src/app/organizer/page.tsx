"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Trophy,
  PlusCircle,
  Users,
  Calendar,
  Layers,
  MapPin,
  ClipboardList,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Search,
  Trash2,
  Eye,
  ExternalLink,
  Phone,
  Mail,
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSportEmoji } from "@/lib/sports-config";
import { formatDate } from "@/lib/utils";
import { getEffectiveTournamentStatus, isTournamentRegistrationOpen, isTournamentOver } from "@/lib/tournament-status";

interface OrganizerStats {
  totalTournaments: number;
  totalRegistrations: number;
  totalTeams: number;
  upcomingTournaments: number;
}

interface OrganizerTournament {
  id: string;
  title: string;
  slug: string;
  venue_name: string;
  venue_city: string;
  format: string;
  status: string;
  tournament_start_date: string;
  tournament_end_date: string;
  max_teams: number;
  entry_fee: number;
  registered_count: number;
  sport: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface OrganizerRegistration {
  id: string;
  tournament_id: string;
  team_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  registered_at: string;
  seed_number?: number | null;
  group_name?: string | null;
  roster_snapshot?: any;
  tournament: {
    id: string;
    title: string;
    slug: string;
    format: string;
    status: string;
    venue_city: string;
    max_teams: number;
    sport?: {
      id: string;
      name: string;
      slug: string;
      icon_name?: string;
    } | null;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    city?: string | null;
    bio?: string | null;
    logo_url?: string | null;
    stats?: { matches: number; won: number; lost: number; draw: number } | null;
    captain?: {
      id: string;
      full_name: string;
      first_name?: string | null;
      last_name?: string | null;
      email: string;
      phone?: string | null;
      avatar_url?: string | null;
    } | null;
  } | null;
}

interface TeamMemberDetail {
  id: string;
  role_in_team: string;
  status: string;
  joined_at: string;
  user: {
    id: string;
    full_name: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [organizerName, setOrganizerName] = React.useState<string>("Organizer");
  const [stats, setStats] = React.useState<OrganizerStats>({
    totalTournaments: 0,
    totalRegistrations: 0,
    totalTeams: 0,
    upcomingTournaments: 0,
  });
  const [tournaments, setTournaments] = React.useState<OrganizerTournament[]>([]);
  const [registrations, setRegistrations] = React.useState<OrganizerRegistration[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"dashboard" | "tournaments" | "registrations">("tournaments");

  // Inline expanded registrations under tournaments in "My Tournaments"
  const [expandedTournamentIds, setExpandedTournamentIds] = React.useState<Set<string>>(new Set());

  // Search and Filter states
  const [tournamentSearch, setTournamentSearch] = React.useState("");
  const [tournamentStatusFilter, setTournamentStatusFilter] = React.useState<string>("ALL");
  const [registrationTournamentFilter, setRegistrationTournamentFilter] = React.useState<string>("ALL");
  const [registrationStatusFilter, setRegistrationStatusFilter] = React.useState<string>("ALL");
  const [registrationSearch, setRegistrationSearch] = React.useState("");

  // Notification state
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status updating loading state
  const [updatingAction, setUpdatingAction] = React.useState<{ id: string; action: "APPROVE" | "REJECT" } | null>(null);

  // Team Details Modal State
  const [detailRegistration, setDetailRegistration] = React.useState<OrganizerRegistration | null>(null);
  const [teamMembers, setTeamMembers] = React.useState<TeamMemberDetail[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);

  // Delete / Remove Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = React.useState<{
    registrationId: string;
    teamName: string;
    tournamentTitle: string;
    tournamentId: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  React.useEffect(() => {
    async function loadOrganizerData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Check role strictly from database
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, first_name, role")
        .eq("id", user.id)
        .single();

      const dbRole = (profile?.role || user.user_metadata?.role || "PLAYER").toUpperCase();

      if (dbRole !== "ORGANIZER" && dbRole !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }

      const name = profile?.first_name || profile?.full_name?.split(" ")[0] || user.user_metadata?.first_name || "Organizer";
      setOrganizerName(name);

      // Fetch stats, tournaments, and registrations in parallel
      try {
        const [statsRes, tourneyRes, regRes] = await Promise.all([
          fetch("/api/organizer/stats"),
          fetch("/api/organizer/tournaments"),
          fetch("/api/organizer/registrations"),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats);
        }

        if (tourneyRes.ok) {
          const tourneyData = await tourneyRes.json();
          setTournaments(tourneyData.tournaments || []);
        }

        if (regRes.ok) {
          const regData = await regRes.json();
          setRegistrations(regData.registrations || []);
        }
      } catch (err) {
        console.error("Failed to load organizer dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrganizerData();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Toggle inline registrations view under tournament
  const toggleExpandTournament = (tourneyId: string) => {
    setExpandedTournamentIds((prev) => {
      const next = new Set(prev);
      if (next.has(tourneyId)) {
        next.delete(tourneyId);
      } else {
        next.add(tourneyId);
      }
      return next;
    });
  };

  // Open team details modal & fetch squad members
  const openTeamDetails = async (reg: OrganizerRegistration) => {
    setDetailRegistration(reg);
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
      console.error("Failed to fetch team members:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Handle Approve / Reject registration
  const handleUpdateStatus = async (registrationId: string, newStatus: "APPROVED" | "REJECTED" | "PENDING") => {
    if (updatingAction) return; // Prevent duplicate requests while updating
    const actionType = newStatus === "APPROVED" ? "APPROVE" : "REJECT";
    setUpdatingAction({ id: registrationId, action: actionType });

    try {
      const res = await fetch("/api/organizer/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            (newStatus === "APPROVED"
              ? "Failed to approve registration. Please try again."
              : "Failed to reject registration. Please try again.")
        );
      }

      // Update state locally
      setRegistrations((prev) =>
        prev.map((r) => (r.id === registrationId ? { ...r, status: newStatus } : r))
      );

      if (detailRegistration?.id === registrationId) {
        setDetailRegistration((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      showNotification(
        "success",
        data.message || (newStatus === "APPROVED" ? "Team approved successfully." : "Team rejected successfully.")
      );

      // Revalidate in background to keep stats and server counts strictly in sync
      fetch("/api/organizer/registrations")
        .then((r) => r.ok && r.json())
        .then((d) => d?.registrations && setRegistrations(d.registrations))
        .catch(() => {});
      fetch("/api/organizer/tournaments")
        .then((r) => r.ok && r.json())
        .then((d) => d?.tournaments && setTournaments(d.tournaments))
        .catch(() => {});
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : newStatus === "APPROVED"
          ? "Failed to approve registration. Please try again."
          : "Failed to reject registration. Please try again.";
      showNotification("error", msg);
    } finally {
      setUpdatingAction(null);
    }
  };

  // Confirm and Execute Registration Deletion
  const handleConfirmDeleteRegistration = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/organizer/registrations?id=${deleteTarget.registrationId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove team registration.");
      }

      // Remove from local registrations
      setRegistrations((prev) => prev.filter((r) => r.id !== deleteTarget.registrationId));

      // Decrement tournament registration count
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === deleteTarget.tournamentId
            ? { ...t, registered_count: Math.max(0, t.registered_count - 1) }
            : t
        )
      );

      // Decrement stats
      setStats((prev) => ({
        ...prev,
        totalRegistrations: Math.max(0, prev.totalRegistrations - 1),
      }));

      // Close details modal if open on this registration
      if (detailRegistration?.id === deleteTarget.registrationId) {
        setDetailRegistration(null);
      }

      showNotification("success", `"${deleteTarget.teamName}" removed from "${deleteTarget.tournamentTitle}".`);
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not remove team";
      showNotification("error", msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Tournaments — strictly exclude finished / completed / cancelled / deleted tournaments
  const filteredTournaments = tournaments.filter((t) => {
    // If finished, completed, cancelled, or over -> do not show
    const status = (t.status || "").toUpperCase();
    if (status === "COMPLETED" || status === "FINISHED" || status === "CANCELLED" || status === "DELETED") {
      return false;
    }
    if (isTournamentOver(t)) {
      return false;
    }

    const matchesSearch =
      tournamentSearch.trim() === "" ||
      t.title.toLowerCase().includes(tournamentSearch.toLowerCase()) ||
      t.venue_city.toLowerCase().includes(tournamentSearch.toLowerCase()) ||
      (t.sport?.name || "").toLowerCase().includes(tournamentSearch.toLowerCase());

    const matchesStatus =
      tournamentStatusFilter === "ALL" ||
      t.status.toUpperCase() === tournamentStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered Registrations — strictly exclude registrations where tournament is deleted,
  // or where a team is rejected and the tournament where team got rejected is over / completed
  const filteredRegistrations = registrations.filter((r) => {
    // Exclude registrations for deleted tournaments
    if (!r.tournament) return false;

    // Exclude rejected teams whose tournament is over / finished / completed
    const isRejected = r.status === "REJECTED";
    const tourneyStatus = (r.tournament?.status || "").toUpperCase();
    const tourneyIsOver = isTournamentOver(r.tournament) ||
      tourneyStatus === "COMPLETED" ||
      tourneyStatus === "FINISHED" ||
      tourneyStatus === "CANCELLED";

    if (isRejected && tourneyIsOver) {
      return false;
    }

    const matchesTourney =
      registrationTournamentFilter === "ALL" ||
      r.tournament_id === registrationTournamentFilter;

    const matchesStatus =
      registrationStatusFilter === "ALL" ||
      r.status.toUpperCase() === registrationStatusFilter;

    const query = registrationSearch.trim().toLowerCase();
    const teamName = r.team?.name?.toLowerCase() || "";
    const captainName = r.team?.captain?.full_name?.toLowerCase() || "";
    const city = r.team?.city?.toLowerCase() || "";
    const tourneyTitle = r.tournament?.title?.toLowerCase() || "";

    const matchesSearch =
      query === "" ||
      teamName.includes(query) ||
      captainName.includes(query) ||
      city.includes(query) ||
      tourneyTitle.includes(query);

    return matchesTourney && matchesStatus && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-background">
      {/* 1. Sidebar Navigation - Desktop only */}
      <aside className="hidden md:block md:w-64 border-r border-border bg-card/50 p-5 space-y-6 shrink-0">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg group">
          <div className="relative h-9 w-9 shrink-0 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="PlayNear Logo"
              width={36}
              height={36}
              className="object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <span className="font-black text-base tracking-tight block leading-none">
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 bg-clip-text text-transparent">
                Play
              </span>
              <span className="text-foreground">Near</span>
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Organizer Hub
            </span>
          </div>
        </Link>

        {/* Sidebar Nav Items */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeTab === "dashboard"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("tournaments")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeTab === "tournaments"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Trophy className="h-4 w-4" />
            My Tournaments
            {filteredTournaments.length > 0 && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                activeTab === "tournaments"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-foreground"
              }`}>
                {filteredTournaments.length}
              </span>
            )}
          </button>

          <Link
            href="/organizer/tournaments/new"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PlusCircle className="h-4 w-4 text-emerald-500" />
            Create Tournament
          </Link>

          <button
            onClick={() => setActiveTab("registrations")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              activeTab === "registrations"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Registrations
            {filteredRegistrations.length > 0 && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                activeTab === "registrations"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-foreground"
              }`}>
                {filteredRegistrations.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>
        </nav>

        {/* Organizer Account / Logout */}
        <div className="pt-6 border-t border-border space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-muted/50">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{organizerName}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tournament Host</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors text-left"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto min-w-0">
        {/* Mobile Header Strip */}
        <div className="md:hidden flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm leading-none block">Organizer Hub</span>
              <span className="text-[10px] text-muted-foreground">{organizerName}</span>
            </div>
          </div>
          <Link href="/organizer/tournaments/new">
            <Button variant="sports" size="sm" className="h-8 text-xs gap-1.5 shadow-sm">
              <PlusCircle className="h-3.5 w-3.5" /> New Event
            </Button>
          </Link>
        </div>

        {/* Floating Notification Toast */}
        {notification && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                : "bg-destructive/10 text-destructive border border-destructive/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "success" ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-muted-foreground hover:text-foreground ml-4"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {organizerName}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your tournaments, team registrations, and squad entries from here.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2.5">
            <Link href="/organizer/tournaments/new">
              <Button variant="sports" className="gap-2 shadow-md">
                <PlusCircle className="h-4 w-4" />
                Create Tournament
              </Button>
            </Link>
          </div>
        </div>

        {/* 3. Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => setActiveTab("tournaments")}
            className="text-left bg-card border border-border hover:border-primary/50 hover:shadow-sm transition-all p-3.5 sm:p-5 rounded-2xl space-y-1"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Tournaments</span>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl sm:text-3xl font-extrabold font-mono">{stats.totalTournaments}</div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Hosted by your account</p>
          </button>

          <button
            onClick={() => setActiveTab("registrations")}
            className="text-left bg-card border border-border hover:border-indigo-500/50 hover:shadow-sm transition-all p-3.5 sm:p-5 rounded-2xl space-y-1"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Registrations</span>
              <ClipboardList className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-xl sm:text-3xl font-extrabold font-mono">{registrations.length}</div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Team signups submitted</p>
          </button>

          <button
            onClick={() => {
              setActiveTab("registrations");
              setRegistrationStatusFilter("APPROVED");
            }}
            className="text-left bg-card border border-border hover:border-emerald-500/50 hover:shadow-sm transition-all p-3.5 sm:p-5 rounded-2xl space-y-1"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Approved</span>
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-3xl font-extrabold font-mono">
              {registrations.filter((r) => r.status === "APPROVED").length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Confirmed entries</p>
          </button>

          <div className="bg-card border border-border p-3.5 sm:p-5 rounded-2xl shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Upcoming</span>
              <Calendar className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-3xl font-extrabold font-mono">{stats.upcomingTournaments}</div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Active competitions</p>
          </div>
        </div>

        {/* TAB NAVIGATION BUTTONS */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("tournaments")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "tournaments"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Trophy className="h-4 w-4" />
            My Tournaments ({filteredTournaments.length})
          </button>

          <button
            onClick={() => setActiveTab("registrations")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "registrations"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Registrations ({filteredRegistrations.filter((r) => r.status === "PENDING").length})
          </button>
        </div>

        {/* SECTION 1: MY TOURNAMENTS */}
        {activeTab === "tournaments" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">All Created Tournaments</h2>
                <Badge variant="outline" className="font-mono text-xs">{filteredTournaments.length}</Badge>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-56">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search tournaments..."
                    value={tournamentSearch}
                    onChange={(e) => setTournamentSearch(e.target.value)}
                    className="pl-8 h-9 text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={tournamentStatusFilter}
                    onChange={(e) => setTournamentStatusFilter(e.target.value)}
                    className="bg-card border border-input rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-9 flex-1 sm:flex-initial"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="REGISTRATION_OPEN">Registration Open</option>
                    <option value="ONGOING">Live Now</option>
                    <option value="REGISTRATION_CLOSED">Registration Closed</option>
                    <option value="COMPLETED">Completed</option>
                  </select>

                  <Link href="/organizer/tournaments/new" className="flex-1 sm:flex-initial">
                    <Button variant="sports" size="sm" className="h-9 gap-1.5 text-xs w-full sm:w-auto">
                      <PlusCircle className="h-3.5 w-3.5" /> New Event
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {filteredTournaments.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center space-y-4">
                <div className="text-5xl">🏆</div>
                <h3 className="font-bold text-base">No Tournaments Found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {tournaments.length === 0
                    ? "Start hosting your first sports competition. Set up your format, venue, fees, and manage team registrations."
                    : "No tournaments match your current search and filter settings."}
                </p>
                {tournaments.length === 0 && (
                  <Link href="/organizer/tournaments/new">
                    <Button variant="sports" className="gap-2">
                      <PlusCircle className="h-4 w-4" /> Create Your First Tournament
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTournaments.map((tourney) => {
                  const sportSlug = tourney.sport?.slug || "";
                  const sportName = tourney.sport?.name || "Sport";
                  const effectiveStatus = getEffectiveTournamentStatus(tourney);
                  const isOngoing = effectiveStatus === "ONGOING";
                  const isOpen = isTournamentRegistrationOpen(tourney);
                  const isClosed = effectiveStatus === "REGISTRATION_CLOSED";
                  const isExpanded = expandedTournamentIds.has(tourney.id);

                  // Registrations belonging strictly to this tournament
                  const tourneyRegistrations = registrations.filter(
                    (r) => r.tournament_id === tourney.id
                  );
                  const tourneyPendingCount = tourneyRegistrations.filter(
                    (r) => r.status === "PENDING"
                  ).length;

                  return (
                    <div
                      key={tourney.id}
                      className="bg-card border border-border hover:border-primary/40 rounded-2xl overflow-hidden transition-all shadow-sm"
                    >
                      {/* Tournament Card Header & Info */}
                      <div className="p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-3xl shrink-0">
                              {getSportEmoji(sportSlug)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base sm:text-lg leading-tight truncate">
                                  {tourney.title}
                                </h3>
                                {isOngoing ? (
                                  <Badge variant="live" className="text-[10px] uppercase">Live Now</Badge>
                                ) : isOpen ? (
                                  <Badge variant="success" className="text-[10px] uppercase">Registration Open</Badge>
                                ) : isClosed ? (
                                  <Badge variant="warning" className="text-[10px] uppercase">Registration Closed</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {effectiveStatus.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                                <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                {tourney.venue_city || tourney.venue_name}
                              </p>
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                            <Link href={`/tournaments/${tourney.slug}`} target="_blank" className="flex-1 sm:flex-initial">
                              <Button variant="outline" size="sm" className="text-xs gap-1 w-full sm:w-auto">
                                <ExternalLink className="h-3.5 w-3.5" /> Public Hub
                              </Button>
                            </Link>

                            <Link href={`/organizer/tournaments/${tourney.id}`} className="flex-1 sm:flex-initial">
                              <Button variant="sports" size="sm" className="gap-1 text-xs font-semibold w-full sm:w-auto">
                                Manage <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {/* Tournament Metadata Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-muted/40 p-3.5 rounded-xl">
                          <div>
                            <span className="text-[10px] uppercase block font-semibold text-muted-foreground">Sport & Format</span>
                            <span className="font-medium text-foreground">{sportName} • {tourney.format.replace(/_/g, " ")}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase block font-semibold text-muted-foreground">Registered Teams</span>
                            <span className="font-medium text-foreground">
                              {tourneyRegistrations.filter((r) => r.status === "APPROVED").length} / {tourney.max_teams} Teams
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex items-center sm:justify-end">
                            <button
                              onClick={() => toggleExpandTournament(tourney.id)}
                              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                              {isExpanded ? "Hide Registrations" : `View Registrations (${tourneyPendingCount})`}
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* INLINE REGISTRATIONS ACCORDION UNDER TOURNAMENT */}
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-primary" />
                              Registered Teams for this Tournament ({tourneyRegistrations.length})
                            </h4>
                            <span className="text-[11px] text-muted-foreground">
                              {tourneyRegistrations.filter((r) => r.status === "APPROVED").length} Approved •{" "}
                              {tourneyRegistrations.filter((r) => r.status === "PENDING").length} Pending
                            </span>
                          </div>

                          {tourneyRegistrations.length === 0 ? (
                            <div className="p-6 bg-card border border-dashed border-border rounded-xl text-center space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">No teams registered yet for this tournament.</p>
                              <p className="text-[11px] text-muted-foreground">
                                Teams that sign up via the public tournament link will appear here.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {tourneyRegistrations.map((reg) => {
                                const team = reg.team;
                                const isPending = reg.status === "PENDING";
                                const isApproved = reg.status === "APPROVED";
                                const isApproving = updatingAction?.id === reg.id && updatingAction.action === "APPROVE";
                                const isRejecting = updatingAction?.id === reg.id && updatingAction.action === "REJECT";
                                const isUpdating = updatingAction !== null;

                                return (
                                  <div
                                    key={reg.id}
                                    className="bg-card border border-border hover:border-primary/30 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                                  >
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">
                                        {team?.name ? team.name.substring(0, 2).toUpperCase() : "TM"}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h5 className="font-bold text-sm truncate">{team?.name || "Team"}</h5>
                                          {isApproved ? (
                                            <Badge variant="success" className="text-[9px] py-0 px-2">APPROVED</Badge>
                                          ) : isPending ? (
                                            <Badge variant="live" className="text-[9px] py-0 px-2">PENDING REVIEW</Badge>
                                          ) : (
                                            <Badge variant="destructive" className="text-[9px] py-0 px-2">REJECTED</Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                          Captain: <span className="text-foreground font-medium">{team?.captain?.full_name || "Captain"}</span>
                                          {team?.captain?.phone && ` • ${team.captain.phone}`}
                                          {team?.city && ` • ${team.city}`}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          Registered {formatDate(reg.registered_at)}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Buttons: View Details, Approve, Reject, Remove */}
                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openTeamDetails(reg)}
                                        className="h-8 text-xs gap-1.5 font-medium"
                                      >
                                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                                        Team Details
                                      </Button>

                                      {isPending && (
                                        <>
                                          <Button
                                            variant="sports"
                                            size="sm"
                                            disabled={isUpdating}
                                            onClick={() => handleUpdateStatus(reg.id, "APPROVED")}
                                            className="h-8 text-xs gap-1 font-semibold shadow-sm"
                                          >
                                            {isApproving ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" /> Approving...
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle2 className="h-3 w-3" /> Approve
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isUpdating}
                                            onClick={() => handleUpdateStatus(reg.id, "REJECTED")}
                                            className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10"
                                          >
                                            {isRejecting ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" /> Rejecting...
                                              </>
                                            ) : (
                                              <>
                                                <XCircle className="h-3 w-3" /> Reject
                                              </>
                                            )}
                                          </Button>
                                        </>
                                      )}

                                      {reg.status !== "REJECTED" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            setDeleteTarget({
                                              registrationId: reg.id,
                                              teamName: team?.name || "Team",
                                              tournamentTitle: tourney.title,
                                              tournamentId: tourney.id,
                                            })
                                          }
                                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                          title="Remove team from tournament"
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SECTION 2: DEDICATED REGISTRATIONS SECTION */}
        {activeTab === "registrations" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-500" />
                  Team Registrations ({filteredRegistrations.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage signups, review team details, and remove teams across all tournaments.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Tournament Selector */}
                <select
                  value={registrationTournamentFilter}
                  onChange={(e) => setRegistrationTournamentFilter(e.target.value)}
                  className="bg-card border border-input rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-9 max-w-xs"
                >
                  <option value="ALL">All Tournaments ({filteredTournaments.length})</option>
                  {filteredTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>

                {/* Status Selector */}
                <select
                  value={registrationStatusFilter}
                  onChange={(e) => setRegistrationStatusFilter(e.target.value)}
                  className="bg-card border border-input rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-9"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search teams or captains..."
                    value={registrationSearch}
                    onChange={(e) => setRegistrationSearch(e.target.value)}
                    className="pl-8 h-9 text-xs w-48 sm:w-56"
                  />
                </div>
              </div>
            </div>

            {filteredRegistrations.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center space-y-3">
                <div className="text-4xl">👥</div>
                <h3 className="font-bold text-base">No Registrations Found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {registrations.length === 0
                    ? "When teams sign up for any of your tournaments, they will appear here for review."
                    : "No registrations match your selected tournament, status, or search filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRegistrations.map((reg) => {
                  const team = reg.team;
                  const tourney = reg.tournament;
                  const isPending = reg.status === "PENDING";
                  const isApproved = reg.status === "APPROVED";
                  const isApproving = updatingAction?.id === reg.id && updatingAction.action === "APPROVE";
                  const isRejecting = updatingAction?.id === reg.id && updatingAction.action === "REJECT";
                  const isUpdating = updatingAction !== null;

                  return (
                    <div
                      key={reg.id}
                      className="bg-card border border-border hover:border-primary/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm"
                    >
                      {/* Team & Captain Details */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-base text-primary shrink-0">
                          {team?.name ? team.name.substring(0, 2).toUpperCase() : "TM"}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-base truncate">{team?.name || "Team"}</h4>
                            {isApproved ? (
                              <Badge variant="success" className="text-[10px]">APPROVED</Badge>
                            ) : isPending ? (
                              <Badge variant="live" className="text-[10px]">PENDING REVIEW</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">REJECTED</Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Tournament: <strong className="text-foreground">{tourney?.title || "Tournament"}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Captain: <strong className="text-foreground">{team?.captain?.full_name || "Captain"}</strong>
                            </span>
                            {team?.captain?.phone && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-emerald-500" /> {team.captain.phone}
                                </span>
                              </>
                            )}
                            {team?.city && (
                              <>
                                <span>•</span>
                                <span>{team.city}</span>
                              </>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground">
                            Registered on {formatDate(reg.registered_at)}
                          </p>
                        </div>
                      </div>

                      {/* Actions: View Details, Approve, Reject, Remove */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTeamDetails(reg)}
                          className="h-9 text-xs gap-1.5 font-medium"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-500" />
                          See Team Details
                        </Button>

                        {isPending && (
                          <>
                            <Button
                              variant="sports"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(reg.id, "APPROVED")}
                              className="h-9 text-xs gap-1 font-semibold shadow-sm"
                            >
                              {isApproving ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(reg.id, "REJECTED")}
                              className="h-9 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            >
                              {isRejecting ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rejecting...
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </>
                              )}
                            </Button>
                          </>
                        )}

                        {reg.status !== "REJECTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                registrationId: reg.id,
                                teamName: team?.name || "Team",
                                tournamentTitle: tourney?.title || "Tournament",
                                tournamentId: reg.tournament_id,
                              })
                            }
                            className="h-9 text-xs text-destructive hover:bg-destructive/10 gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SECTION 3: DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Tournaments */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" /> Recent Tournaments
                  </h3>
                  <button
                    onClick={() => setActiveTab("tournaments")}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    View All ({tournaments.length})
                  </button>
                </div>

                {tournaments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tournaments hosted yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {tournaments.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground">{t.venue_city} • {registrations.filter((r) => r.tournament_id === t.id && r.status === "APPROVED").length}/{t.max_teams} Teams</p>
                        </div>
                        <Link href={`/organizer/tournaments/${t.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-primary">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Registrations */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-indigo-500" /> Recent Registrations
                  </h3>
                  <button
                    onClick={() => setActiveTab("registrations")}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    View All ({registrations.length})
                  </button>
                </div>

                {registrations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No team registrations yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {registrations.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.team?.name || "Team"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            For {r.tournament?.title || "Tournament"} • Captain: {r.team?.captain?.full_name || "Captain"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTeamDetails(r)}
                          className="h-8 text-xs gap-1"
                        >
                          <Eye className="h-3 w-3" /> Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TEAM DETAILS MODAL */}
        {detailRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-muted/30">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                    {detailRegistration.team?.name
                      ? detailRegistration.team.name.substring(0, 2).toUpperCase()
                      : "TM"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold leading-tight">
                        {detailRegistration.team?.name || "Team Details"}
                      </h3>
                      {detailRegistration.status === "APPROVED" ? (
                        <Badge variant="success" className="text-[10px]">APPROVED</Badge>
                      ) : detailRegistration.status === "PENDING" ? (
                        <Badge variant="live" className="text-[10px]">PENDING</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">REJECTED</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {detailRegistration.team?.city || "Local Team"}
                      {detailRegistration.tournament?.sport?.name && ` • ${detailRegistration.tournament.sport.name}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailRegistration(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Registered Tournament Banner */}
                <div className="bg-muted/40 border border-border p-4 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Registered Tournament
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {detailRegistration.tournament?.title || "Tournament"}
                    </span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Format: {detailRegistration.tournament?.format?.replace(/_/g, " ") || "Standard"} • Registered {formatDate(detailRegistration.registered_at)}
                    </p>
                  </div>

                  <Link href={`/tournaments/${detailRegistration.tournament?.slug}`} target="_blank">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary">
                      View Hub <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>

                {/* Team Captain Card */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Captain Contact</h4>
                  <div className="bg-card border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {detailRegistration.team?.captain?.full_name || "Team Captain"}
                        </p>
                        <p className="text-xs text-muted-foreground">Team Representative</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {detailRegistration.team?.captain?.phone && (
                        <a
                          href={`tel:${detailRegistration.team.captain.phone}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {detailRegistration.team.captain.phone}
                        </a>
                      )}
                      {detailRegistration.team?.captain?.email && (
                        <a
                          href={`mailto:${detailRegistration.team.captain.email}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 font-medium hover:bg-blue-500/20 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {detailRegistration.team.captain.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Performance / Stats */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Track Record</h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-muted/40 p-3 rounded-xl">
                      <span className="text-base sm:text-lg font-bold font-mono">
                        {detailRegistration.team?.stats?.matches || 0}
                      </span>
                      <span className="block text-[10px] text-muted-foreground uppercase mt-0.5">Played</span>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-xl">
                      <span className="text-base sm:text-lg font-bold font-mono">
                        {detailRegistration.team?.stats?.won || 0}
                      </span>
                      <span className="block text-[10px] uppercase mt-0.5">Won</span>
                    </div>
                    <div className="bg-red-500/10 text-destructive p-3 rounded-xl">
                      <span className="text-base sm:text-lg font-bold font-mono">
                        {detailRegistration.team?.stats?.lost || 0}
                      </span>
                      <span className="block text-[10px] uppercase mt-0.5">Lost</span>
                    </div>
                    <div className="bg-amber-500/10 text-amber-600 p-3 rounded-xl">
                      <span className="text-base sm:text-lg font-bold font-mono">
                        {detailRegistration.team?.stats?.draw || 0}
                      </span>
                      <span className="block text-[10px] uppercase mt-0.5">Drawn</span>
                    </div>
                  </div>
                </div>

                {/* Squad Members Roster */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" /> Active Squad Roster ({teamMembers.length})
                    </h4>
                    {isLoadingMembers && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading players...
                      </span>
                    )}
                  </div>

                  {isLoadingMembers ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading squad roster...
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="p-4 rounded-xl bg-muted/30 text-center text-xs text-muted-foreground">
                      No team members listed yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs"
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary shrink-0">
                            {member.user?.full_name ? member.user.full_name.substring(0, 1).toUpperCase() : "P"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{member.user?.full_name || "Squad Member"}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{member.role_in_team || "Player"}</p>
                          </div>
                          {member.role_in_team?.toUpperCase() === "CAPTAIN" && (
                            <Badge variant="sports" className="text-[9px] py-0 px-1.5">C</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link
                  href={`/teams/${detailRegistration.team?.id}`}
                  target="_blank"
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Public Team Page
                </Link>

                <div className="flex items-center gap-2">
                  {detailRegistration.status === "PENDING" && (
                    <>
                      <Button
                        variant="sports"
                        size="sm"
                        onClick={() => handleUpdateStatus(detailRegistration.id, "APPROVED")}
                        className="gap-1 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve Entry
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(detailRegistration.id, "REJECTED")}
                        className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}

                  {detailRegistration.status !== "REJECTED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget({
                          registrationId: detailRegistration.id,
                          teamName: detailRegistration.team?.name || "Team",
                          tournamentTitle: detailRegistration.tournament?.title || "Tournament",
                          tournamentId: detailRegistration.tournament_id,
                        });
                      }}
                      className="text-xs text-destructive hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Team
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REMOVE / DELETE CONFIRMATION DIALOG */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-destructive/40 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <ShieldAlert className="h-6 w-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-bold text-lg">Remove Team from Tournament?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove <strong className="text-foreground">{deleteTarget.teamName}</strong> from{" "}
                  <strong className="text-foreground">{deleteTarget.tournamentTitle}</strong>?
                </p>
                <p className="text-[11px] text-muted-foreground">
                  This will cancel their registration and remove them from the tournament roster.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>

                <Button
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleConfirmDeleteRegistration}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  {isDeleting ? (
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
      </main>
    </div>
  );
}
