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
  AlertCircle, 
  CheckCircle2,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePasswordRequirements } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

type SignupRole = "PLAYER" | "ORGANIZER";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<SignupRole>("PLAYER");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  // If already logged in, redirect away from the signup page immediately
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
  }, [supabase, router]);

  // Live password validation state
  const passwordValidation = React.useMemo(() => {
    return validatePasswordRequirements(password);
  }, [password]);

  const { checks } = passwordValidation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage("Please enter your last name.");
      return;
    }

    // 1. Frontend validation check
    if (!passwordValidation.isValid) {
      setErrorMessage(passwordValidation.error || "Please satisfy all password requirements marked in red below.");
      return;
    }

    setIsLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      // 2. Call backend signup API route
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email,
          password,
          role,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result.error || "Failed to create account. Please check your details.");
        setIsLoading(false);
        return;
      }

      // Immediate redirect without email confirmation requirement
      const targetUrl = result.redirectUrl || (role === "ORGANIZER" ? "/organizer" : "/");
      router.push(targetUrl);
      router.refresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(
        errorMsg === "Failed to fetch"
          ? "Network connection error. Please check your internet connection."
          : errorMsg
      );
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Checking session...</p>
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
              Join the <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 bg-clip-text text-transparent">PlayNear</span> Community
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Sign up to create teams, register for tournaments, or host competitions.
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
          {/* Role Segmented Switcher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">I want to register as</label>
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



          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name + Last Name side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">First Name *</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="given-name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Last Name *</label>
                <div className="relative mt-1">
                  <Input
                    placeholder="e.g. Chen"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="text-xs font-semibold text-foreground">Email Address *</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={role === "ORGANIZER" ? "organizer@example.com" : "player@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label className="text-xs font-semibold text-foreground">Password *</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
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

              {/* Password Requirements Checklist */}
              <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 text-[11px]">
                <div className="font-semibold text-muted-foreground mb-1">
                  Password Requirements:
                </div>

                <div className={cn("flex items-center gap-1.5 transition-colors",
                  checks.minLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 font-medium")}>
                  {checks.minLength ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span>At least 8 characters</span>
                </div>

                <div className={cn("flex items-center gap-1.5 transition-colors",
                  checks.hasUpper ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 font-medium")}>
                  {checks.hasUpper ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span>At least one uppercase letter (A-Z)</span>
                </div>

                <div className={cn("flex items-center gap-1.5 transition-colors",
                  checks.hasLower ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 font-medium")}>
                  {checks.hasLower ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span>At least one lowercase letter (a-z)</span>
                </div>

                <div className={cn("flex items-center gap-1.5 transition-colors",
                  checks.hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 font-medium")}>
                  {checks.hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span>At least one number (0-9)</span>
                </div>

                <div className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/50">
                  Special characters (e.g. !@#\$%) are optional.
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="sports"
              className="w-full font-bold shadow-md shadow-blue-500/20 mt-2"
              disabled={isLoading}
            >
              {isLoading
                ? "Creating Account..."
                : role === "ORGANIZER"
                ? "Create Organizer Account"
                : "Create Player Account"}
            </Button>
          </form>

          {/* Login Redirect */}
          <div className="text-center text-xs text-muted-foreground pt-3 border-t border-border">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
