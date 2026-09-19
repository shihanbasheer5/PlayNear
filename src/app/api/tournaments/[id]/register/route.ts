import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTournamentRegistrationOpen } from '@/lib/tournament-status';
import { formatDate } from '@/lib/utils';

// POST /api/tournaments/[id]/register — Register a team for a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to register a team.' }, { status: 401 });
    }

    // Tournament hosts cannot register teams — hosts are for creating and managing tournaments
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();
    if (role === 'ORGANIZER') {
      return NextResponse.json(
        { error: 'Tournament hosts cannot register teams. Hosts are dedicated to creating and managing tournaments.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { team_id, payment_method, payment_ref, payment_amount, payment_order_id } = body;

    if (!team_id) {
      return NextResponse.json({ error: 'Please select a team to register.' }, { status: 400 });
    }

    // 1. Verify tournament exists and is open for registration
    const { data: tournament, error: tourneyError } = await supabase
      .from('tournaments')
      .select('id, title, max_teams, status, tournament_start_date, tournament_end_date, registration_end_date, entry_fee, currency')
      .eq('id', tournamentId)
      .single();

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
    }

    if (!isTournamentRegistrationOpen(tournament)) {
      const startDateText = tournament.tournament_start_date ? ` (started on ${formatDate(tournament.tournament_start_date)})` : '';
      return NextResponse.json(
        { error: `Registration is closed for this tournament${startDateText}.` },
        { status: 400 }
      );
    }

    // 2. Check if team exists and user is captain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Selected team not found.' }, { status: 404 });
    }

    let isCaptain = team.captain_id === user.id;
    if (!isCaptain) {
      const { data: captainMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .ilike('role_in_team', 'CAPTAIN')
        .maybeSingle();

      if (captainMember) isCaptain = true;
    }

    if (!isCaptain) {
      return NextResponse.json(
        { error: `Permission denied: Only the captain of "${team.name}" can register the squad for this tournament.` },
        { status: 403 }
      );
    }

    // 3. Check for existing tournament registration
    const { data: existingReg } = await supabase
      .from('tournament_teams')
      .select('id, status')
      .eq('tournament_id', tournamentId)
      .eq('team_id', team_id)
      .maybeSingle();

    if (existingReg) {
      return NextResponse.json(
        { error: `Team "${team.name}" is already registered for this tournament (Status: ${existingReg.status}).` },
        { status: 400 }
      );
    }

    // 4. Check tournament capacity
    const { data: currentTeams, count } = await supabase
      .from('tournament_teams')
      .select('id', { count: 'exact' })
      .eq('tournament_id', tournamentId);

    const registeredCount = count ?? (currentTeams?.length ?? 0);
    if (tournament.max_teams && registeredCount >= tournament.max_teams) {
      return NextResponse.json({ error: 'Tournament has reached maximum team capacity.' }, { status: 400 });
    }

    // 5. Build roster_snapshot with payment details
    const entryFee = tournament.entry_fee ?? 0;
    const rosterSnapshot: Record<string, any> = {
      registered_by: user.id,
      registered_at: new Date().toISOString(),
      payment_amount: payment_amount ?? entryFee,
      payment_status: entryFee > 0 ? 'PAID' : 'FREE',
      payment_method: payment_method ?? (entryFee > 0 ? 'RAZORPAY' : 'FREE'),
      payment_ref: payment_ref ?? null,
      payment_order_id: payment_order_id ?? null,
    };

    // 6. Insert registration into Supabase
    const { data: registration, error: insertError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        team_id: team_id,
        status: 'PENDING',
        roster_snapshot: rosterSnapshot,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      registration,
      registered_count: registeredCount + 1,
      max_teams: tournament.max_teams,
      message: `Registration submitted successfully for "${team.name}". The organizer will review your entry.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
