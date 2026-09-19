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
    !serviceRoleKey.startsWith('sb_publishable_') &&
    serviceRoleKey.length > 50
  ) {
    return createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return null;
}

// GET /api/organizer/registrations — List all team registrations across tournaments owned by the organizer
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const status = searchParams.get('status');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch tournaments owned by this organizer
    let tourneyQuery = supabase
      .from('tournaments')
      .select('id, title, slug, format, status, venue_city, max_teams, entry_fee, currency, tournament_start_date, tournament_end_date, sport:sports(id, name, slug, icon_name)')
      .eq('organizer_id', user.id);

    if (tournamentId) {
      tourneyQuery = tourneyQuery.eq('id', tournamentId);
    }

    const { data: tournaments, error: tourneyErr } = await tourneyQuery;
    if (tourneyErr) {
      return NextResponse.json({ error: tourneyErr.message }, { status: 500 });
    }

    const tournamentIds = (tournaments || []).map((t) => t.id);
    if (tournamentIds.length === 0) {
      return NextResponse.json({ registrations: [], tournaments: [] });
    }

    const tournamentMap = new Map((tournaments || []).map((t) => [t.id, t]));

    // 2. Fetch registrations for these tournaments
    let regQuery = supabase
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
        team:teams(
          id,
          name,
          slug,
          city,
          bio,
          logo_url,
          stats,
          captain:profiles!teams_captain_id_fkey(id, full_name, first_name, last_name, email, phone, avatar_url)
        )
      `)
      .in('tournament_id', tournamentIds)
      .order('registered_at', { ascending: false });

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      regQuery = regQuery.eq('status', status.toUpperCase());
    }

    const { data: registrations, error: regErr } = await regQuery;
    if (regErr) {
      return NextResponse.json({ error: regErr.message }, { status: 500 });
    }

    // Attach tournament details & payment information to each registration
    const enriched = (registrations || []).map((reg) => {
      const tourney = tournamentMap.get(reg.tournament_id) || null;
      const snapshot = (reg.roster_snapshot as Record<string, any>) || {};
      const fee = snapshot.payment_amount ?? (reg as any).payment_amount ?? tourney?.entry_fee ?? 0;
      let paymentStatus = snapshot.payment_status ?? (reg as any).payment_status;
      if (!paymentStatus) {
        paymentStatus = fee > 0 ? 'PAID' : 'FREE';
      }
      if (reg.status === 'REJECTED') {
        paymentStatus = 'REFUNDED';
      }
      return {
        ...reg,
        tournament: tourney,
        payment_status: paymentStatus,
        payment_amount: fee,
        payment_method: snapshot.payment_method ?? (reg as any).payment_method ?? 'UPI',
        payment_ref: snapshot.payment_ref ?? (reg as any).payment_ref ?? null,
        refund_status: snapshot.refund_status ?? (reg.status === 'REJECTED' ? 'REFUNDED' : null),
      };
    });

    // Filter out registrations for deleted tournaments,
    // and if a team is rejected and the tournament where team got rejected is over/completed/finished, do not show!
    const activeRegistrations = enriched.filter((reg) => {
      if (!reg.tournament) return false;
      const isRejected = reg.status === 'REJECTED';
      const tourneyStatus = (reg.tournament.status || '').toUpperCase();
      const tourneyOver = isTournamentOver(reg.tournament) ||
        tourneyStatus === 'COMPLETED' ||
        tourneyStatus === 'FINISHED' ||
        tourneyStatus === 'CANCELLED';

      if (isRejected && tourneyOver) {
        return false;
      }
      return true;
    });

    // Also filter tournaments for the dropdown to exclude completed/finished tournaments
    const activeTournaments = (tournaments || []).filter((t: any) => {
      const tourneyStatus = (t.status || '').toUpperCase();
      return tourneyStatus !== 'COMPLETED' && tourneyStatus !== 'FINISHED' && tourneyStatus !== 'CANCELLED' && !isTournamentOver(t);
    });

    return NextResponse.json({
      registrations: activeRegistrations,
      tournaments: activeTournaments,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/organizer/registrations — Remove a team registration from a tournament
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id') || searchParams.get('registration_id');

    let registrationId = queryId;
    if (!registrationId) {
      try {
        const body = await request.json();
        registrationId = body.registration_id || body.id;
      } catch {
        // Body was empty or not JSON
      }
    }

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required.' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Strategy 1: Use RPC SECURITY DEFINER function (bypasses RLS, checks ownership in SQL)
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('delete_registration_by_organizer', {
        p_registration_id: registrationId,
        p_caller_id: user.id,
      });

    if (!rpcErr && rpcResult) {
      const result = rpcResult as { success: boolean; error?: string; deleted_id?: string };
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Registration removed successfully.',
          removedRegistrationId: registrationId,
        });
      }
      if (result.error?.includes('Forbidden')) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error?.includes('not found')) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
    }

    // Strategy 2: Admin client (if service role key is set)
    if (adminClient) {
      // Verify ownership first
      const { data: reg } = await adminClient
        .from('tournament_teams')
        .select('id, tournament_id')
        .eq('id', registrationId)
        .maybeSingle();

      if (!reg) {
        return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
      }

      const { data: tourney } = await adminClient
        .from('tournaments')
        .select('organizer_id, title')
        .eq('id', reg.tournament_id)
        .maybeSingle();

      if (!tourney || tourney.organizer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
      }

      const { data: deleted, error: delErr } = await adminClient
        .from('tournament_teams')
        .delete()
        .eq('id', registrationId)
        .select();

      if (!delErr && deleted && deleted.length > 0) {
        return NextResponse.json({
          success: true,
          message: `Registration removed from "${tourney.title}".`,
          removedRegistrationId: registrationId,
        });
      }
    }

    // Strategy 3: Authenticated organizer client
    const { data: regCheck } = await supabase
      .from('tournament_teams')
      .select('id, tournament_id')
      .eq('id', registrationId)
      .maybeSingle();

    if (!regCheck) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    const { data: tourneyCheck } = await supabase
      .from('tournaments')
      .select('organizer_id, title')
      .eq('id', regCheck.tournament_id)
      .maybeSingle();

    if (!tourneyCheck || tourneyCheck.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const { data: deleted, error: delErr } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('id', registrationId)
      .select();

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not delete registration. Please run supabase/fix_organizer_registration_policies.sql in your Supabase SQL Editor to grant organizer permissions.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Registration removed from "${tourneyCheck.title}".`,
      removedRegistrationId: registrationId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/organizer/registrations — Approve or Reject a registration
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { registration_id, status } = body;

    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : '';
    if (!registration_id || !['APPROVED', 'REJECTED', 'PENDING'].includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Invalid registration ID or status.' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // ─────────────────────────────────────────────────────────
    // STRATEGY 1: RPC via SECURITY DEFINER function (best: no service key needed, RLS bypassed)
    // Requires running supabase/fix_organizer_registration_policies.sql once.
    // ─────────────────────────────────────────────────────────
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('update_registration_status', {
        p_registration_id: registration_id,
        p_new_status: normalizedStatus,
        p_caller_id: user.id,
      });

    if (!rpcErr && rpcResult) {
      const result = rpcResult as { success: boolean; error?: string; new_status?: string };
      if (result.success) {
        // Fetch full registration row to return enriched data
        const { data: updatedReg } = await supabase
          .from('tournament_teams')
          .select('id, tournament_id, team_id, status, registered_at, roster_snapshot')
          .eq('id', registration_id)
          .maybeSingle();

        const snapshot = ((updatedReg?.roster_snapshot as Record<string, any>) || {});
        return NextResponse.json({
          success: true,
          registration: {
            ...(updatedReg || {}),
            status: normalizedStatus,
            payment_status:
              normalizedStatus === 'REJECTED'
                ? 'REFUNDED'
                : snapshot.payment_status || 'PAID',
            refund_status: normalizedStatus === 'REJECTED' ? 'REFUNDED' : null,
          },
          message:
            normalizedStatus === 'APPROVED'
              ? 'Team approved successfully.'
              : 'Team rejected successfully.',
        });
      }

      if (result.error?.includes('Forbidden')) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error?.includes('not found')) {
        return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
      }
      // RPC returned false but no useful error — fall through to next strategy
    }
    // rpcErr means the function doesn't exist yet — fall through to next strategy

    // ─────────────────────────────────────────────────────────
    // STRATEGY 2: Admin client (if service role key is set in .env.local)
    // ─────────────────────────────────────────────────────────
    const reader = adminClient || supabase;

    // Fetch registration
    const { data: reg, error: fetchErr } = await reader
      .from('tournament_teams')
      .select('id, tournament_id, team_id, status, roster_snapshot')
      .eq('id', registration_id)
      .maybeSingle();

    if (fetchErr || !reg) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    // Security: verify organizer ownership
    const { data: tourney, error: tourneyErr } = await reader
      .from('tournaments')
      .select('id, organizer_id, entry_fee, title')
      .eq('id', reg.tournament_id)
      .maybeSingle();

    if (tourneyErr || !tourney || tourney.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    // Build updated snapshot
    const existingSnapshot = (reg.roster_snapshot as Record<string, any>) || {};
    const updatedSnapshot = { ...existingSnapshot };

    if (normalizedStatus === 'REJECTED') {
      updatedSnapshot.payment_status = 'REFUNDED';
      updatedSnapshot.refund_status = 'REFUNDED';
      updatedSnapshot.refunded_at = new Date().toISOString();
      updatedSnapshot.rejected_at = new Date().toISOString();
      updatedSnapshot.rejected_by = user.id;
    } else if (normalizedStatus === 'APPROVED') {
      if (!existingSnapshot.payment_status || existingSnapshot.payment_status !== 'PAID') {
        updatedSnapshot.payment_status = (tourney.entry_fee || 0) > 0 ? 'PAID' : 'FREE';
      }
      updatedSnapshot.approved_at = new Date().toISOString();
      updatedSnapshot.approved_by = user.id;
    }

    let updateResult = null;

    if (adminClient) {
      updateResult = await adminClient
        .from('tournament_teams')
        .update({ status: normalizedStatus, roster_snapshot: updatedSnapshot })
        .eq('id', registration_id)
        .select();
    }

    if (!updateResult?.data || updateResult.data.length === 0) {
      updateResult = await supabase
        .from('tournament_teams')
        .update({ status: normalizedStatus, roster_snapshot: updatedSnapshot })
        .eq('id', registration_id)
        .select();
    }

    if (updateResult?.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    if (!updateResult?.data || updateResult.data.length === 0) {
      return NextResponse.json(
        {
          error:
            'Database permission error: could not update registration status. Please run supabase/fix_organizer_registration_policies.sql in your Supabase SQL Editor to fix this.',
        },
        { status: 403 }
      );
    }

    const updatedRow = updateResult.data[0];

    return NextResponse.json({
      success: true,
      registration: {
        ...updatedRow,
        status: normalizedStatus,
        payment_status:
          updatedSnapshot.payment_status ||
          (normalizedStatus === 'REJECTED' ? 'REFUNDED' : 'PAID'),
        refund_status: updatedSnapshot.refund_status,
      },
      message:
        normalizedStatus === 'APPROVED'
          ? 'Team approved successfully.'
          : 'Team rejected successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
