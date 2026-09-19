import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTournamentOver } from '@/lib/tournament-status';

// GET /api/organizer/stats — Aggregate real stats for the logged-in organizer
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch tournaments owned by this organizer
    const { data: tournaments, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('id, status, tournament_start_date, tournament_end_date')
      .eq('organizer_id', user.id);

    if (tourneyErr) {
      return NextResponse.json({ error: tourneyErr.message }, { status: 500 });
    }

    // Exclude finished / completed / cancelled tournaments
    const activeTournaments = (tournaments || []).filter((t: any) => {
      const status = (t.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'FINISHED' || status === 'CANCELLED' || status === 'DELETED') {
        return false;
      }
      if (isTournamentOver(t)) {
        return false;
      }
      return true;
    });

    const totalTournaments = activeTournaments.length;
    const upcomingTournaments = activeTournaments.length;
    const tournamentIds = (tournaments || []).map((t) => t.id);

    let totalRegistrations = 0;
    let totalTeams = 0;

    // 2. Fetch registrations for organizer's tournaments
    if (tournamentIds.length > 0) {
      const { data: registrations, error: regErr } = await supabase
        .from('tournament_teams')
        .select(`
          id,
          team_id,
          status,
          tournament:tournaments(id, status, tournament_start_date, tournament_end_date)
        `)
        .in('tournament_id', tournamentIds);

      if (!regErr && registrations) {
        // Exclude registrations of deleted tournaments,
        // and if a team is rejected and the tournament is over, do not count/show
        const activeRegistrations = registrations.filter((r: any) => {
          if (!r.tournament) return false;
          const isRejected = r.status === 'REJECTED';
          const tStatus = (r.tournament.status || '').toUpperCase();
          const tOver = isTournamentOver(r.tournament) || tStatus === 'COMPLETED' || tStatus === 'CANCELLED';
          if (isRejected && tOver) return false;
          return true;
        });

        totalRegistrations = activeRegistrations.length;
        const approvedTeamIds = new Set(
          activeRegistrations.filter((r) => r.status === 'APPROVED').map((r) => r.team_id)
        );
        totalTeams = approvedTeamIds.size;
      }
    }

    return NextResponse.json({
      stats: {
        totalTournaments,
        totalRegistrations,
        totalTeams,
        upcomingTournaments,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
