import Link from "next/link";
import { Github, Heart, Shield } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.08] bg-[#f7f8f4]/60 dark:bg-black/20 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3 md:col-span-1">
            <BrandLogo size="md" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Empowering local sports communities, tournament organizers, captains, and athletes with modern management tools.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tournaments" className="hover:text-foreground transition-colors">
                  Find Tournaments
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-foreground transition-colors">
                  Teams Directory
                </Link>
              </li>
              <li>
                <Link href="/teams/new" className="hover:text-foreground transition-colors">
                  Create a Team
                </Link>
              </li>
              <li>
                <Link href="/registered-tournaments" className="hover:text-foreground transition-colors">
                  My Registrations
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Organizers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/organizer/tournaments/new" className="hover:text-foreground transition-colors">
                  Host a Tournament
                </Link>
              </li>
              <li>
                <Link href="/organizer" className="hover:text-foreground transition-colors">
                  Organizer Hub
                </Link>
              </li>
              <li>
                <Link href="/tournaments" className="hover:text-foreground transition-colors">
                  Tournament Brackets
                </Link>
              </li>
            </ul>
          </div>

          {/* Supported Sports */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Sports</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tournaments?sport=cricket" className="hover:text-foreground transition-colors">
                  🏏 Cricket Tournaments
                </Link>
              </li>
              <li>
                <Link href="/tournaments?sport=football" className="hover:text-foreground transition-colors">
                  ⚽ Football Tournaments
                </Link>
              </li>
              <li>
                <Link href="/tournaments?sport=kabaddi" className="hover:text-foreground transition-colors">
                  🤼 Kabaddi Competitions
                </Link>
              </li>
              <li>
                <Link href="/tournaments?sport=volleyball" className="hover:text-foreground transition-colors">
                  🏐 Volleyball Cups
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} PlayNear Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-emerald-500" /> Supabase RLS Protected
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> For Local Athletes
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
