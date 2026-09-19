"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  PlusCircle,
  Search,
  LogOut,
  User,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getSportEmoji } from "@/lib/sports-config";
import { BrandLogo } from "@/components/brand-logo";

interface MyTeamMembership {
  id: string;
  role_in_team: string;
  status: string;
  joined_at: string;
  member_count: number;
  team: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    logo_url?: string | null;
    captain_id: string;
    max_players: number | null;
    sport: {
      id: string;
      name: string;
      slug: string;
    } | null;
    stats: { matches: number; won: number; lost: number; draw: number };
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = React.useState<{ full_name: string; first_name?: string | null; email: string; role: string } | null>(null);
  const [myTeams, setMyTeams] = React.useState<MyTeamMembership[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name, email, role")
        .eq("id", user.id)
        .single();

      const dbRole = (profileData?.role || user.user_metadata?.role || "PLAYER").toUpperCase();
      if (dbRole === "ORGANIZER") {
        router.replace("/organizer");
        return;
      }

      if (profileData) {
        setProfile(profileData);
      } else {
        // Fallback from user metadata
        const meta = user.user_metadata;
        setProfile({
          full_name: meta?.full_name || user.email?.split("@")[0] || "Player",
          first_name: meta?.first_name || null,
          email: user.email || "",
          role: meta?.role || "PLAYER",
        });
      }

      // Load my teams — fetch memberships AND teams where I'm captain (covers edge cases)
      const { data: memberships } = await supabase
        .from("team_members")
        .select(`
          id, role_in_team, status, joined_at,
          team:teams(
            id, name, slug, city, logo_url, captain_id, max_players, stats,
            sport:sports(id, name, slug, icon_name)
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE");

      const membershipList = (memberships as unknown as MyTeamMembership[]) || [];

      // Also fetch teams where user is captain but may not have a team_members row
      const { data: captainTeams } = await supabase
        .from("teams")
        .select(`
          id, name, slug, city, logo_url, captain_id, max_players, stats,
          sport:sports(id, name, slug, icon_name)
        `)
        .eq("captain_id", user.id);

      // Merge: add captain teams not already in membership list
      const membershipTeamIds = new Set(membershipList.map((m) => m.team?.id).filter(Boolean));
      const extraCaptainEntries: MyTeamMembership[] = (captainTeams || [])
        .filter((t) => !membershipTeamIds.has(t.id))
        .map((t) => ({
          id: `captain-${t.id}`,
          role_in_team: "Captain",
          status: "ACTIVE",
          joined_at: "",
          member_count: 0,
          team: (t as unknown) as MyTeamMembership["team"],
        }));

      const allTeams = [...membershipList, ...extraCaptainEntries];

      // Fetch ACTIVE member counts for all teams
      const allTeamIds = allTeams.map((m) => m.team?.id).filter(Boolean) as string[];
      if (allTeamIds.length > 0) {
        const { data: memberRows } = await supabase
          .from("team_members")
          .select("team_id")
          .in("team_id", allTeamIds)
          .eq("status", "ACTIVE");

        const countMap: Record<string, number> = {};
        for (const row of memberRows || []) {
          const tid = (row as { team_id: string }).team_id;
          countMap[tid] = (countMap[tid] || 0) + 1;
        }
        allTeams.forEach((m) => {
          if (m.team?.id) m.member_count = countMap[m.team.id] ?? 0;
        });
      }

      setMyTeams(allTeams);
      setIsLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const displayName = profile?.first_name || profile?.full_name?.split(" ")[0] || "Player";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <BrandLogo size="md" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span>Hi, {displayName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* Welcome */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-extrabold">Welcome, {displayName} 👋</h1>
        <p className="text-blue-100 mt-1 text-sm">Find your next game or build your team.</p>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/teams">
          <div className="group bg-card border border-border hover:border-primary/40 hover:shadow-md rounded-2xl p-6 cursor-pointer transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="font-bold text-lg">🔍 Find a Team</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join an existing local team near you.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-primary group-hover:underline">
              Browse Teams <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/teams/new">
          <div className="group bg-card border border-border hover:border-primary/40 hover:shadow-md rounded-2xl p-6 cursor-pointer transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                <PlusCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="font-bold text-lg">➕ Create a Team</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create your own team and invite players.
            </p>
            <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-primary group-hover:underline">
              Create Team <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* My Teams */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            My Teams
          </h2>
          {myTeams.length > 0 && (
            <Link href="/teams" className="text-xs text-primary font-semibold hover:underline">
              Find more teams →
            </Link>
          )}
        </div>

        {myTeams.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center space-y-4">
            <div className="text-4xl">🏆</div>
            <p className="text-muted-foreground font-medium">No teams yet</p>
            <p className="text-sm text-muted-foreground">Join or create a team to get started.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/teams">
                <Button variant="outline" size="sm" className="gap-2">
                  <Search className="h-3.5 w-3.5" /> Find a Team
                </Button>
              </Link>
              <Link href="/teams/new">
                <Button variant="sports" size="sm" className="gap-2">
                  <PlusCircle className="h-3.5 w-3.5" /> Create a Team
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTeams.map((membership) => {
              const team = membership.team;
              if (!team) return null;
              const sportSlug = team.sport?.slug || "";
              const sportName = team.sport?.name || "Sport";
              return (
                <div
                  key={membership.id}
                  className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-border/80 shadow-sm">
                      {team.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.innerText = getSportEmoji(sportSlug);
                            }
                          }}
                        />
                      ) : (
                        getSportEmoji(sportSlug)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{team.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        {team.city || "Location unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {sportName}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {membership.role_in_team}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {membership.member_count ?? 0}/{team.max_players ?? 15}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link href={`/teams/${team.id}`}>
                    <Button variant="outline" size="sm" className="text-xs font-semibold shrink-0">
                      View
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tournaments CTA */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Browse Tournaments</h3>
            <p className="text-xs text-muted-foreground">Find local competitions to register your team.</p>
          </div>
        </div>
        <Link href="/tournaments">
          <Button variant="outline" size="sm" className="shrink-0 text-xs">
            View All
          </Button>
        </Link>
      </div>
    </div>
  );
}
