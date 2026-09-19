"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Trophy,
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

type LoginRole = "PLAYER" | "ORGANIZER";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = React.useState<LoginRole>("PLAYER");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  // If already logged in, redirect away from the login page immediately
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const params = new URLSearchParams(window.location.search);
        const redirectParam = params.get("redirect");
        const targetUrl = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
        router.replace(targetUrl);
      } else {
        setIsCheckingAuth(false);
      }
    });
  }, [router, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        // Fetch database profile for role verification
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        const dbRole = (profile?.role || data.user.user_metadata?.role || "PLAYER").toUpperCase();

        if (dbRole === "PLAYER" && role === "ORGANIZER") {
          await supabase.auth.signOut();
          setErrorMessage("This account is registered as a Player. Please switch to Player to sign in.");
          setIsLoading(false);
          return;
        }

        if (dbRole === "ORGANIZER" && role === "PLAYER") {
          await supabase.auth.signOut();
          setErrorMessage("This account is registered as an Organizer. Please switch to Organizer to sign in.");
          setIsLoading(false);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const redirectParam = params.get("redirect");
        
        if (redirectParam && redirectParam.startsWith("/")) {
          router.push(redirectParam);
        } else if (dbRole === "ORGANIZER" || dbRole === "ADMIN") {
          router.push("/organizer");
        } else {
          router.push("/");
        }
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=${role}`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) setErrorMessage(error.message);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize Google login.");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <BrandLogo size="lg" showText={false} href={null} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome back to <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 bg-clip-text text-transparent">PlayNear</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Sign in to manage your tournaments, teams, and match schedules.
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
          {/* Role Segmented Switcher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Sign In As</label>
            <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => {
                  setRole("PLAYER");
                  setErrorMessage(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                  role === "PLAYER"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className={cn("h-4 w-4", role === "PLAYER" ? "text-primary" : "text-muted-foreground")} />
                Player
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole("ORGANIZER");
                  setErrorMessage(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                  role === "ORGANIZER"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Trophy className={cn("h-4 w-4", role === "ORGANIZER" ? "text-amber-500" : "text-muted-foreground")} />
                Organizer
              </button>
            </div>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder={role === "ORGANIZER" ? "organizer@example.com" : "player@example.com"}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Password</label>
                <a href="#" className="text-[11px] text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1 rounded transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button with Dynamic Role Label */}
            <Button
              type="submit"
              variant="sports"
              className="w-full font-bold shadow-md shadow-blue-500/20 mt-2"
              disabled={isLoading}
            >
              {isLoading
                ? "Verifying Credentials..."
                : role === "ORGANIZER"
                ? "Sign In as Organizer"
                : "Sign In as Player"}
            </Button>
          </form>

          {/* Signup Redirect */}
          <div className="text-center text-xs text-muted-foreground pt-3 border-t border-border">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Create free account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
