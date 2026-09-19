import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isTournamentOver } from '@/lib/tournament-status';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    serviceRoleKey &&
    supabaseUrl &&
    serviceRoleKey !== anonKey &&
    !serviceRoleKey.startsWith('sb_publishable_')
  ) {
    return createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return null;
}

// GET /api/player/tournaments — Fetch all tournaments the current user is registered in (as captain or member)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get all teams the user is part of (captain or member)
    const [{ data: captainTeams }, { data: memberTeams }] = await Promise.all([
      supabase.from('teams').select('id').eq('captain_id', user.id),
      supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
    ]);

    const teamIdSet = new Set<string>();
    (captainTeams || []).forEach((t) => teamIdSet.add(t.id));
    (memberTeams || []).forEach((m) => teamIdSet.add(m.team_id));

    const teamIds = [...teamIdSet];
    if (teamIds.length === 0) {
      return NextResponse.json({ registrations: [] });
    }

    // 2. Fetch tournament_teams registrations for those teams
    const { data: registrations, error: regErr } = await supabase
      .from('tournament_teams')
      .select(`
        id,
        tournament_id,
        team_id,
        status,
        registered_at,
        seed_number,
        group_name,
        roster_snapshot,
        team:teams(id, name, city, logo_url),
        tournament:tournaments(
          id,
          title,
          slug,
          venue_name,
          venue_city,
          tournament_start_date,
          tournament_end_date,
          entry_fee,
          currency,
          max_teams,
          format,
          status,
          sport:sports(id, name, slug, icon_name),
          organizer:profiles!tournaments_organizer_id_fkey(id, full_name, first_name)
        )
      `)
      .in('team_id', teamIds)
      .order('registered_at', { ascending: false });

    if (regErr) {
      return NextResponse.json({ error: regErr.message }, { status: 500 });
    }

    // 3. Enrich each registration with payment info from roster_snapshot
    const enriched = (registrations || []).map((reg) => {
      const snapshot = (reg.roster_snapshot as Record<string, any>) || {};
      const tourney = reg.tournament as any;
      const fee = snapshot.payment_amount ?? tourney?.entry_fee ?? 0;
      let paymentStatus = snapshot.payment_status;
      if (!paymentStatus) {
        paymentStatus = fee > 0 ? 'PAID' : 'FREE';
      }
      if (reg.status === 'REJECTED') {
        paymentStatus = snapshot.refund_status ?? 'REFUNDED';
      }
      return {
        ...reg,
        payment_status: paymentStatus,
        payment_amount: fee,
        payment_method: snapshot.payment_method ?? null,
        payment_ref: snapshot.payment_ref ?? null,
        refund_status: snapshot.refund_status ?? (reg.status === 'REJECTED' ? 'REFUNDED' : null),
        dismissed_by_player: Boolean(snapshot.dismissed_by_player),
      };
    });

    const activeRegistrations = enriched.filter((reg) => {
      if (!reg.tournament) return false;
      const tourney = Array.isArray(reg.tournament) ? reg.tournament[0] : reg.tournament;
      if (!tourney) return false;
      const isRejected = reg.status === 'REJECTED';
      const tourneyOver = isTournamentOver(tourney as any) || ((tourney as any).status || '').toUpperCase() === 'COMPLETED';
      if (isRejected && tourneyOver) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ registrations: activeRegistrations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/player/tournaments — Dismiss or mark seen a registration for the user's team
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { registration_id, action } = body;

    if (!registration_id) {
      return NextResponse.json({ error: 'registration_id is required' }, { status: 400 });
    }

    // Fetch existing registration
    const { data: reg, error: fetchErr } = await supabase
      .from('tournament_teams')
      .select('id, team_id, roster_snapshot')
      .eq('id', registration_id)
      .single();

    if (fetchErr || !reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const currentSnapshot = (reg.roster_snapshot as Record<string, any>) || {};
    const updatedSnapshot = {
      ...currentSnapshot,
      dismissed_by_player: true,
      dismissed_at: new Date().toISOString(),
      action_taken: action || 'dismiss',
    };

    const adminClient = getAdminClient();
    const effectiveClient = adminClient || supabase;

    const { error: updateErr } = await effectiveClient
      .from('tournament_teams')
      .update({ roster_snapshot: updatedSnapshot })
      .eq('id', registration_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Registration dismissed successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

