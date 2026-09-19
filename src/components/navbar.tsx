"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Users, Home, User, Menu, X, PlusCircle, Layers, Settings, ChevronDown, LogOut, ClipboardList, Building2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ProfileSettingsModal } from "@/components/profile/profile-settings-modal";
import { BrandLogo } from "@/components/brand-logo";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userFirstName, setUserFirstName] = React.useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = React.useState<string | null>(null);
  const [userUsername, setUserUsername] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<"PLAYER" | "ORGANIZER" | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(true);

  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [profileModalTab, setProfileModalTab] = React.useState<"basic" | "sports" | "account">("basic");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (user) {
          setIsLoggedIn(true);
          setUserEmail(user.email || null);
          const meta = user.user_metadata;
          const fallbackName = meta?.first_name || meta?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "Player";
          setUserFirstName(fallbackName);
          if (meta?.avatar_url) setUserAvatarUrl(meta.avatar_url);
          if (meta?.username) setUserUsername(meta.username);
          if (meta?.role) setUserRole(meta.role.toUpperCase() as "PLAYER" | "ORGANIZER");

          // Fetch database profile
          const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name, full_name, username, avatar_url, role")
            .eq("id", user.id)
            .single();

          if (!isMounted) return;
          if (data) {
            const role = (data?.role || meta?.role || "PLAYER").toUpperCase() as "PLAYER" | "ORGANIZER";
            setUserRole(role);
            if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
            if (data?.username) setUserUsername(data.username);
            if (data?.first_name) {
              setUserFirstName(data.first_name);
            } else if (data?.full_name) {
              setUserFirstName(data.full_name.split(" ")[0]);
            }
          }
        } else {
          setIsLoggedIn(false);
          setUserRole(null);
          setUserFirstName(null);
          setUserAvatarUrl(null);
          setUserUsername(null);
          setUserEmail(null);
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    }

    checkUser();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsLoggedIn(false);
        setUserRole(null);
        setUserFirstName(null);
        setUserAvatarUrl(null);
        setUserUsername(null);
        setUserEmail(null);
        setAuthLoading(false);
      } else {
        checkUser();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserRole(null);
    setUserFirstName(null);
    router.push("/login");
    router.refresh();
  };

  const homeHref = "/";

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#191314]/[0.08] bg-[#ffffff]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <BrandLogo size="md" />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {isLoggedIn && userRole === "ORGANIZER" ? (
                <>
                  <Link
                    href="/"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname === "/"
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Home
                  </Link>

                  <Link
                    href="/organizer"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname === "/organizer"
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Organizer Hub
                  </Link>

                  <Link
                    href="/organizer/tournaments/new"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname.startsWith("/organizer/tournaments/new")
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Host Tournament
                  </Link>

                  <Link
                    href="/tournaments"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname.startsWith("/tournaments")
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Tournaments
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname === "/"
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Home
                  </Link>

                  <Link
                    href="/tournaments"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname.startsWith("/tournaments")
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Tournaments
                  </Link>

                  <Link
                    href="/teams"
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                      pathname.startsWith("/teams")
                        ? "bg-[#191314] text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                    )}
                  >
                    Teams
                  </Link>

                  {isLoggedIn && (
                    <Link
                      href="/registered-tournaments"
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                        pathname.startsWith("/registered-tournaments")
                          ? "bg-[#191314] text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-[#f4f4f4]"
                      )}
                    >
                      My Registrations
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>



          {/* Right side: auth & profile menu */}
          <div className="hidden md:flex items-center gap-3">
            {authLoading ? (
              <div className="h-9 w-24 rounded-full bg-muted/50 animate-pulse" />
            ) : isLoggedIn ? (
              <div className="relative" ref={dropdownRef}>
                {/* Profile Button Trigger */}
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border/70 hover:border-primary/50 bg-background/80 hover:bg-muted/60 transition-all shadow-xs group"
                >
                  <div className="h-8 w-8 rounded-full border border-border overflow-hidden bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      userFirstName ? userFirstName[0].toUpperCase() : <User className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {userFirstName}
                    {userRole === "ORGANIZER" && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-md border border-amber-500/20">
                        Host
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                      profileDropdownOpen ? "rotate-180 text-primary" : "group-hover:text-foreground"
                    }`}
                  />
                </button>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Header Summary */}
                    <div className="px-3 py-2.5 border-b border-border/60 mb-1">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full border border-border overflow-hidden bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {userAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={userAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                          ) : (
                            userFirstName ? userFirstName[0].toUpperCase() : <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{userFirstName}</p>
                          {userUsername ? (
                            <p className="text-xs font-mono text-primary font-medium truncate">@{userUsername}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="space-y-0.5">
                      <Link
                        href="/"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                      >
                        <Home className="h-4 w-4 text-primary" />
                        <span>Home</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setProfileModalTab("basic");
                          setProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                      >
                        {userRole === "ORGANIZER" ? (
                          <Building2 className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Settings className="h-4 w-4 text-primary" />
                        )}
                        <span>{userRole === "ORGANIZER" ? "Host Settings" : "Profile Settings"}</span>
                      </button>

                      {userRole !== "ORGANIZER" ? (
                        <>
                          <Link
                            href="/dashboard"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Layers className="h-4 w-4" />
                            <span>Dashboard</span>
                          </Link>

                          <Link
                            href="/my-teams"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Users className="h-4 w-4" />
                            <span>My Teams</span>
                          </Link>

                          <Link
                            href="/registered-tournaments"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <ClipboardList className="h-4 w-4" />
                            <span>My Registrations</span>
                          </Link>
                        </>
                      ) : (
                        <Link
                          href="/organizer"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Layers className="h-4 w-4" />
                          <span>Organizer Hub</span>
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-border/60 my-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="rounded-full px-4 text-xs font-semibold text-foreground hover:bg-black/[0.05]">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="dark" size="sm" className="bg-[#191314] text-white hover:bg-black rounded-full px-5 py-2 text-xs font-bold shadow-xs">
                    Join Free
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background p-4 space-y-3">
          <div className="space-y-1">
            {isLoggedIn && userRole === "ORGANIZER" ? (
              <>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium",
                    pathname === "/"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Home className="h-5 w-5" /> 🏠 Home
                </Link>
                <Link
                  href="/organizer"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium",
                    pathname === "/organizer"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Layers className="h-5 w-5" /> 📊 Organizer Hub
                </Link>
                <Link
                  href="/organizer/tournaments/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-emerald-600 font-semibold"
                >
                  <PlusCircle className="h-5 w-5" /> ➕ Host Tournament
                </Link>
                <Link
                  href="/tournaments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground"
                >
                  <Trophy className="h-5 w-5" /> 🏆 Tournaments
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium",
                    pathname === "/"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Home className="h-5 w-5" /> 🏠 Home
                </Link>
                {isLoggedIn && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium",
                      pathname === "/dashboard"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Layers className="h-5 w-5" /> 📊 Dashboard
                  </Link>
                )}
                <Link
                  href="/tournaments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground"
                >
                  <Trophy className="h-5 w-5" /> 🏆 Tournaments
                </Link>
                <Link
                  href="/teams"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground"
                >
                  <Users className="h-5 w-5" /> 👥 Teams
                </Link>
                {isLoggedIn && (
                  <Link
                    href="/registered-tournaments"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium",
                      pathname.startsWith("/registered-tournaments")
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ClipboardList className="h-5 w-5" /> 📋 My Registrations
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            {authLoading ? (
              <div className="h-12 w-full rounded-xl bg-muted/40 animate-pulse" />
            ) : isLoggedIn ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
                  <div className="h-9 w-9 rounded-full border border-border overflow-hidden bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      userFirstName ? userFirstName[0].toUpperCase() : <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <span>{userFirstName}</span>
                      {userRole === "ORGANIZER" && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
                          Host
                        </span>
                      )}
                    </div>
                    {userUsername && (
                      <span className="block text-xs font-mono text-primary font-medium">@{userUsername}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setProfileModalTab("basic");
                    setProfileModalOpen(true);
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-foreground hover:bg-muted"
                >
                  {userRole === "ORGANIZER" ? (
                    <Building2 className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Settings className="h-5 w-5 text-primary" />
                  )}
                  <span>{userRole === "ORGANIZER" ? "Host Settings" : "Profile Settings"}</span>
                </button>

                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <User className="h-4 w-4" /> Sign In
                  </Button>
                </Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="sports" className="w-full justify-center">
                    Join Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      </header>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={profileModalOpen}
        initialTab={profileModalTab}
        userRole={userRole || undefined}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={(updated) => {
          if (updated?.first_name) {
            setUserFirstName(updated.first_name);
          }
          if (updated?.avatar_url) {
            setUserAvatarUrl(updated.avatar_url);
          }
          if (updated?.username) {
            setUserUsername(updated.username);
          }
        }}
      />
    </>
  );
}
