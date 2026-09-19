"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  User,
  Camera,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Trophy,
  Award,
  Trash2,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Shield,
  Activity,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_SPORTS, SupportedSportSlug } from "@/lib/sports-config";
import { createClient } from "@/lib/supabase/client";

// Preset sports avatar icons if user doesn't have an image
const PRESET_AVATARS = [
  { id: "cricket", emoji: "🏏", label: "Cricketer", bg: "bg-amber-500/20 text-amber-500 border-amber-500/30" },
  { id: "football", emoji: "⚽", label: "Striker", bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" },
  { id: "kabaddi", emoji: "🤼", label: "Raider", bg: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
  { id: "volleyball", emoji: "🏐", label: "Setter", bg: "bg-sky-500/20 text-sky-500 border-sky-500/30" },
  { id: "fire", emoji: "🔥", label: "Champion", bg: "bg-rose-500/20 text-rose-500 border-rose-500/30" },
  { id: "star", emoji: "⭐", label: "All-Star", bg: "bg-purple-500/20 text-purple-500 border-purple-500/30" },
];

// Preset host / tournament organizer badges
const HOST_PRESET_AVATARS = [
  { id: "trophy", emoji: "🏆", label: "Tournament Host", bg: "bg-amber-500/20 text-amber-500 border-amber-500/30" },
  { id: "arena", emoji: "🏟️", label: "Sports Arena", bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" },
  { id: "shield", emoji: "🛡️", label: "Official League", bg: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  { id: "star", emoji: "⭐", label: "Elite Organizer", bg: "bg-purple-500/20 text-purple-500 border-purple-500/30" },
  { id: "flame", emoji: "🔥", label: "Action Arena", bg: "bg-rose-500/20 text-rose-500 border-rose-500/30" },
  { id: "crown", emoji: "👑", label: "Premier Host", bg: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30" },
];

const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
];

// Playing positions mapped per sport as specified by user
const SPORT_POSITIONS: Record<string, string[]> = {
  cricket: ["Batsman", "Bowler", "All-rounder", "Wicketkeeper"],
  football: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
  kabaddi: ["Raider", "Defender", "All-rounder"],
  volleyball: ["Setter", "Libero", "Middle Blocker", "Outside Hitter", "Opposite Hitter"],
};

export interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updated: any) => void;
  initialTab?: "basic" | "sports" | "account";
  isStandalone?: boolean;
  userRole?: "PLAYER" | "ORGANIZER" | string;
}

export function ProfileSettingsModal({
  isOpen,
  onClose,
  onProfileUpdated,
  initialTab = "basic",
  isStandalone = false,
  userRole: initialUserRole,
}: ProfileSettingsModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = React.useState<"basic" | "sports" | "account">(initialTab);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State - Basic Profile
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [bio, setBio] = React.useState("");

  // Form State - Sports Profile
  const [primarySport, setPrimarySport] = React.useState("cricket");
  const [otherSports, setOtherSports] = React.useState<string[]>([]);
  const [playingPosition, setPlayingPosition] = React.useState("");
  const [achievements, setAchievements] = React.useState("");

  // Account State
  const [userId, setUserId] = React.useState("");
  const [userRole, setUserRole] = React.useState<string>(initialUserRole || "PLAYER");
  const [createdAt, setCreatedAt] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (initialUserRole) {
      setUserRole(initialUserRole);
    }
  }, [initialUserRole]);

  const isHost = (userRole || "").toUpperCase() === "ORGANIZER" || (userRole || "").toUpperCase() === "ADMIN";

  // Prevent host from ever getting trapped in player sports tab
  React.useEffect(() => {
    if (isHost && activeTab === "sports") {
      setActiveTab("basic");
    }
  }, [isHost, activeTab]);

  // Calculate age helper
  const calculatedAge = React.useMemo(() => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 && age < 120 ? age : null;
  }, [dob]);

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll and handle Escape key
  React.useEffect(() => {
    if (isOpen && !isStandalone) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, isStandalone, onClose]);

  // Load Profile on Mount / Open
  React.useEffect(() => {
    if (!isOpen && !isStandalone) return;

    async function loadData() {
      setLoadingProfile(true);
      setStatusMessage(null);
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (res.ok && data.profile) {
          const p = data.profile;
          setUserId(p.id || "");
          setEmail(p.email || "");
          setUserRole(p.role || "PLAYER");
          setCreatedAt(p.created_at || "");

          setFirstName(p.first_name || (p.full_name ? p.full_name.split(" ")[0] : ""));
          setLastName(p.last_name || (p.full_name ? p.full_name.split(" ").slice(1).join(" ") : ""));
          setUsername(p.username || "");
          setDob(p.date_of_birth ? p.date_of_birth.split("T")[0] : "");
          setGender(p.gender || "");
          setPhone(p.phone || "");
          setCity(p.city || "");
          setState(p.state || "");
          setBio(p.bio || "");
          setPhotoUrl(p.avatar_url || "");

          const detectedSport = p.primary_sport || "cricket";
          setPrimarySport(detectedSport);
          setOtherSports(Array.isArray(p.other_sports) ? p.other_sports : []);
          setPlayingPosition(p.playing_position || "");
          setAchievements(p.experience_achievements || "");
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadData();
  }, [isOpen, isStandalone]);

  // If primary sport changes and current playing position doesn't fit, offer current positions
  const availablePositions = React.useMemo(() => {
    return SPORT_POSITIONS[primarySport.toLowerCase()] || ["Player", "Captain", "All-rounder"];
  }, [primarySport]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Photo file size should be less than 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoUrl(reader.result);
        setStatusMessage({ type: "success", text: "Photo preview loaded! Remember to save." });
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleOtherSport = (slug: string) => {
    if (slug === primarySport) return;
    setOtherSports((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSave = async (tabToSave: "basic" | "sports") => {
    setSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        username: username,
        date_of_birth: isHost ? null : (dob || null),
        gender: isHost ? null : (gender || null),
        phone: phone,
        city: city,
        state: state,
        bio: bio,
        avatar_url: photoUrl,
        primary_sport: isHost ? (primarySport || "cricket") : primarySport,
        other_sports: isHost ? [] : otherSports.filter((s) => s !== primarySport),
        playing_position: isHost ? null : playingPosition,
        experience_achievements: isHost ? null : achievements,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setStatusMessage({
          type: "success",
          text: isHost
            ? "Host profile saved successfully!"
            : (tabToSave === "basic" ? "Basic profile saved successfully!" : "Sports profile saved successfully!"),
        });
        if (onProfileUpdated) {
          onProfileUpdated(data.profile);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onClose) onClose();
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== "DELETE") {
      setStatusMessage({ type: "error", text: 'Please type "DELETE" exactly to confirm.' });
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Failed to delete account." });
        setIsDeleting(false);
      } else {
        if (onClose) onClose();
        router.push("/signup?deleted=true");
        router.refresh();
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Account deletion failed." });
      setIsDeleting(false);
    }
  };

  if (!isOpen && !isStandalone) return null;

  const content = (
    <div className="flex flex-col w-full h-full max-h-[88vh] sm:max-h-[85vh] bg-card text-card-foreground overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/60 bg-muted/40">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 ${
            isHost
              ? "bg-gradient-to-tr from-amber-500 to-orange-600 shadow-amber-500/20"
              : "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20"
          }`}>
            {isHost ? <Building2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <User className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
              {isHost ? "Host Profile Settings" : "Profile Settings"}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground hidden xs:block sm:block">
              {isHost
                ? "Manage your tournament organizer identity, contact details, and account"
                : "Manage your identity, sports preferences, and account"}
            </p>
          </div>
        </div>
        {!isStandalone && (
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="shrink-0 flex border-b border-border px-3 sm:px-6 bg-muted/15 gap-1 sm:gap-2 pt-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => { setActiveTab("basic"); setStatusMessage(null); }}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === "basic"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {isHost ? <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" /> : <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          <span>{isHost ? "1. Host Profile" : "1. Basic Profile"}</span>
        </button>
        {!isHost && (
          <button
            type="button"
            onClick={() => { setActiveTab("sports"); setStatusMessage(null); }}
            className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "sports"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>2. Sports Profile</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => { setActiveTab("account"); setStatusMessage(null); }}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === "account"
              ? "border-destructive text-destructive"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>{isHost ? "2. Account" : "3. Account"}</span>
        </button>
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`mx-4 sm:mx-6 mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-lg flex items-center gap-2 text-xs sm:text-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-destructive/15 text-destructive border border-destructive/30"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
        {loadingProfile ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading your profile details...</p>
          </div>
        ) : activeTab === "basic" ? (
          /* ========================================================================= */
          /* 1. BASIC / HOST PROFILE TAB                                               */
          /* ========================================================================= */
          isHost ? (
            /* --------------------------------------------------------------------- */
            /* HOST / ORGANIZER SPECIFIC PROFILE SETTINGS                            */
            /* --------------------------------------------------------------------- */
            <div className="space-y-6">
              {/* Host Informational Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">Tournament Host & Organizer Identity</span>
                      <Badge variant="outline" className="bg-background text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] uppercase font-bold py-0">
                        Host
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Information displayed publicly on your tournament listings, match fixtures, and captain notices.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization Logo / Host Photo */}
              <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-foreground">Organization Logo / Host Emblem</label>
                  <span className="text-xs text-muted-foreground">Publicly visible</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-2xl border-2 border-border overflow-hidden bg-amber-500/10 flex items-center justify-center text-3xl font-bold shadow-inner">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="Host Emblem" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {firstName ? firstName[0].toUpperCase() : "🏆"}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95"
                      title="Upload organization logo"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2 rounded-xl"
                      >
                        <Camera className="h-4 w-4 text-amber-500" /> Upload Logo / Photo
                      </Button>
                      {photoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhotoUrl("")}
                          className="text-xs text-muted-foreground hover:text-destructive rounded-xl"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Or pick an official host badge:</p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {HOST_PRESET_AVATARS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPhotoUrl(`https://api.dicebear.com/7.x/identicon/svg?seed=${preset.id}`)}
                          className={`text-lg p-2 rounded-xl border hover:scale-110 transition-transform ${preset.bg}`}
                          title={preset.label}
                        >
                          {preset.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Host Representative & Organization Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    First Name / Lead Contact <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Lead organizer or representative name</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Last Name / Org Suffix
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sports Club or Sharma"
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Public Host Name: &quot;{[firstName, lastName].filter(Boolean).join(" ") || "Your Organization"}&quot;
                  </p>
                </div>
              </div>

              {/* Organization Handle / Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Host Handle / Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    @
                  </span>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="bay_area_sports_club"
                    className="pl-8 rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Unique handle for your tournament organizer profile and public listings</p>
              </div>

              {/* Contact Phone & Official Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Contact Phone Number <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10 rounded-xl"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Direct contact for captains & tournament registrations</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Official Account Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      disabled
                      className="pl-10 rounded-xl bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Managed securely through your sign-in account</p>
                </div>
              </div>

              {/* Host City & State / Province */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Operating City / Headquarters <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="pl-10 rounded-xl"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Primary city where your tournaments are hosted</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    State / Province
                  </label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">State or regional jurisdiction</p>
                </div>
              </div>

              {/* About Organization / Host Bio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    About Host / Organization Bio
                  </label>
                  <span className="text-xs text-muted-foreground">{bio.length}/500</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Established sports academy hosting competitive leagues and knockouts with certified referees, digital live scoring, quality turf facilities, and medals..."
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Brief description of your organization, past tournaments, facilities, and participant guidelines.
                </p>
              </div>

              {/* Save Host Profile Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="sports"
                  onClick={() => handleSave("basic")}
                  disabled={saving}
                  className="w-full sm:w-auto min-w-[170px] gap-2 rounded-xl h-11 font-semibold shadow-md shadow-amber-500/10"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Host Profile
                </Button>
              </div>
            </div>
          ) : (
            /* --------------------------------------------------------------------- */
            /* PLAYER SPECIFIC BASIC PROFILE SETTINGS                                */
            /* --------------------------------------------------------------------- */
            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 sm:p-5">
                <label className="block text-sm font-semibold text-foreground mb-3">Profile Photo</label>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-full border-2 border-border overflow-hidden bg-primary/10 flex items-center justify-center text-3xl font-bold shadow-inner">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-primary">{firstName ? firstName[0].toUpperCase() : "👤"}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95"
                      title="Upload new photo"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Camera className="h-4 w-4 text-primary" /> Upload Image
                      </Button>
                      {photoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhotoUrl("")}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Or pick a sports avatar badge:</p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {PRESET_AVATARS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPhotoUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${preset.id}`)}
                          className={`text-lg p-1.5 rounded-xl border hover:scale-110 transition-transform ${preset.bg}`}
                          title={preset.label}
                        >
                          {preset.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Names & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Virat"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Last Name
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Kohli"
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Username & DOB / Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      @
                    </span>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="virat_runmachine"
                      className="pl-8 rounded-xl"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Unique handle for your player profile</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Date of Birth
                    </label>
                    {calculatedAge !== null && (
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                        Age: {calculatedAge} yrs old
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Gender & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Select Gender</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Email (Read only from auth) & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      disabled
                      className="pl-10 rounded-xl bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Managed securely through your sign-in account</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    City / Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai, Maharashtra"
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Bio / About me */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Short Bio / About Me
                  </label>
                  <span className="text-xs text-muted-foreground">{bio.length}/300</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Passionate local athlete, weekend warrior, and team leader..."
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {/* Save Basic Profile Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="sports"
                  onClick={() => handleSave("basic")}
                  disabled={saving}
                  className="w-full sm:w-auto min-w-[160px] gap-2 rounded-xl h-11 font-semibold"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Basic Profile
                </Button>
              </div>
            </div>
          )
        ) : activeTab === "sports" ? (
          /* ========================================================================= */
          /* 2. SPORTS PROFILE TAB                                                     */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Primary Sport column */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Primary Sport <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Your main discipline used for tournaments and team matchmaking.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SUPPORTED_SPORTS.map((sport) => {
                  const isSelected = primarySport.toLowerCase() === sport.slug.toLowerCase();
                  return (
                    <button
                      key={sport.slug}
                      type="button"
                      onClick={() => {
                        setPrimarySport(sport.slug);
                        // Reset playing position if not available in new sport
                        const newPositions = SPORT_POSITIONS[sport.slug] || [];
                        if (!newPositions.includes(playingPosition)) {
                          setPlayingPosition(newPositions[0] || "");
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20 font-bold"
                          : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-3xl">{sport.emoji}</span>
                      <span className="text-sm">{sport.name}</span>
                      {isSelected && (
                        <span className="text-[10px] bg-primary text-primary-foreground font-semibold px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playing Position column - REACTIVE TO PRIMARY SPORT */}
            <div className="bg-muted/30 border border-border/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-semibold text-foreground">
                    Playing Position
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Available roles for{" "}
                    <span className="font-semibold text-primary capitalize">{primarySport}</span>:
                  </p>
                </div>
                {playingPosition && (
                  <Badge variant="sports" className="text-xs font-semibold">
                    Current: {playingPosition}
                  </Badge>
                )}
              </div>

              {/* Reactive position buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {availablePositions.map((pos) => {
                  const isSelected = playingPosition === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPlayingPosition(pos)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                          : "bg-background border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>

              {/* Custom position write-in fallback */}
              <div className="pt-2">
                <Input
                  value={playingPosition}
                  onChange={(e) => setPlayingPosition(e.target.value)}
                  placeholder="Or enter custom position / specialization..."
                  className="rounded-xl text-xs bg-background"
                />
              </div>
            </div>

            {/* Other Sports column */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Other Sports
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Select other sports you also play or compete in:
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SUPPORTED_SPORTS.map((sport) => {
                  const isPrimary = primarySport.toLowerCase() === sport.slug.toLowerCase();
                  const isSelected = otherSports.includes(sport.slug);

                  if (isPrimary) return null; // Don't show primary in other sports

                  return (
                    <button
                      key={sport.slug}
                      type="button"
                      onClick={() => toggleOtherSport(sport.slug)}
                      className={`px-3.5 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{sport.emoji}</span>
                      <span>{sport.name}</span>
                      {isSelected ? <Check className="h-3.5 w-3.5 ml-1" /> : <span className="text-xs opacity-50">+</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Achievements / Experience text box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-foreground">
                  Achievements / Experience
                </label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Highlight your sports background, tournament medals, club honors, or playing career.
              </p>
              <textarea
                rows={4}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="e.g. &#10;• 5+ years state level cricket tournament player&#10;• Top Run Scorer - Mumbai Inter-Collegiate Trophy 2024&#10;• Captain of Shivaji Park CC"
                className="w-full p-3.5 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-sans"
              />
            </div>

            {/* Save Sports Profile Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="sports"
                onClick={() => handleSave("sports")}
                disabled={saving}
                className="w-full sm:w-auto min-w-[160px] gap-2 rounded-xl h-11 font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Sports Profile
              </Button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. ACCOUNT TAB (Logout & Delete Account)                                   */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Account Information Overview */}
            <div className="border border-border rounded-2xl p-5 bg-muted/20 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Account Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Account Email:</span>
                  <p className="font-semibold text-foreground mt-0.5">{email || "Not loaded"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Role:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {isHost ? "Tournament Host / Organizer" : userRole}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <p className="font-mono text-muted-foreground mt-0.5 truncate">{userId || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Member Since:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {createdAt ? new Date(createdAt).toLocaleDateString() : (isHost ? "Active organizer" : "Active player")}
                  </p>
                </div>
              </div>
            </div>

            {/* Logout Section */}
            <div className="border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Sign Out of PlayNear</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  End your current session on this device.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="gap-2 rounded-xl self-start sm:self-center"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="border-2 border-destructive/30 bg-destructive/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-destructive/15 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-destructive">Delete Account</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isHost
                      ? "Permanently delete your organizer profile, hosted tournament data, and fixtures. This action is irreversible."
                      : "Permanently delete your profile, player stats, team memberships, and personal data. This action is irreversible."}
                  </p>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" /> I want to delete my account
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-background border border-destructive/40 space-y-3">
                  <p className="text-xs text-foreground font-semibold">
                    To confirm permanent deletion, please type <span className="text-destructive font-mono">DELETE</span> below:
                  </p>
                  <Input
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="Type DELETE"
                    className="rounded-xl border-destructive/40 text-sm font-mono"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationInput("");
                      }}
                      className="rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteConfirmationInput !== "DELETE" || isDeleting}
                      onClick={handleDeleteAccount}
                      className="gap-2 rounded-xl text-xs"
                    >
                      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Permanently Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
        {content}
      </div>
    );
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl lg:max-w-3xl my-auto max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>,
    document.body
  );
}
