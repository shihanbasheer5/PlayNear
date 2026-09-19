"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProfileSettingsModal } from "@/components/profile/profile-settings-modal";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [role, setRole] = React.useState<string>("PLAYER");
  const supabase = createClient();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setRole((user.user_metadata?.role || "PLAYER").toUpperCase());
      }
    });
  }, [supabase]);

  const isHost = role === "ORGANIZER" || role === "ADMIN";

  return (
    <main className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={isHost ? "/organizer" : "/dashboard"}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> {isHost ? "Back to Organizer Hub" : "Back to Dashboard"}
          </Link>
        </div>

        {/* Standalone Profile Settings Container */}
        <ProfileSettingsModal
          isOpen={true}
          onClose={() => {}}
          isStandalone={true}
          userRole={role}
        />
      </div>
    </main>
  );
}
