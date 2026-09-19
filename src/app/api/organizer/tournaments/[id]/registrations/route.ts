import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Make sure serviceRoleKey is a genuine secret key, not the publishable anon key
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

// GET /api/organizer/tournaments/[id]/registrations — List team registrations for this tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ownership of tournament
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('id, organizer_id, title')
      .eq('id', id)
      .single();

    if (!tourney || tourney.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const { data: registrations, error } = await supabase
      .from('tournament_teams')
      .select(`
        id,
        tournament_id,
        team_id,
        status,
        registered_at,
        seed_number,
        group_name,
        team:teams(
          id,
          name,
          slug,
          city,
          bio,
          stats,
          captain:profiles!teams_captain_id_fkey(id, full_name, first_name, email, phone)
        )
      `)
      .eq('tournament_id', id)
      .order('registered_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ registrations: registrations || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/organizer/tournaments/[id]/registrations — Approve or Reject a registration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify tournament ownership
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('id, organizer_id')
      .eq('id', tournamentId)
      .single();

    if (!tourney || tourney.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const body = await request.json();
    const { registration_id, status } = body;

    if (!registration_id || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid registration ID or status.' }, { status: 400 });
    }

    // Strategy 1: Try RPC SECURITY DEFINER function first
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('update_registration_status', {
      p_registration_id: registration_id,
      p_new_status: status,
      p_caller_id: user.id,
    });

    if (!rpcErr && rpcResult && (rpcResult as { success: boolean }).success) {
      const { data: updatedRow } = await supabase
        .from('tournament_teams')
        .select('*')
        .eq('id', registration_id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        registration: updatedRow || { id: registration_id, status },
        message: status === 'APPROVED' ? 'Team approved successfully.' : 'Team rejected successfully.',
      });
    }

    const adminClient = getAdminClient();
    let updateResult = null;

    if (adminClient) {
      updateResult = await adminClient
        .from('tournament_teams')
        .update({ status })
        .eq('id', registration_id)
        .eq('tournament_id', tournamentId)
        .select();
    }

    if (!updateResult?.data || updateResult.data.length === 0) {
      updateResult = await supabase
        .from('tournament_teams')
        .update({ status })
        .eq('id', registration_id)
        .eq('tournament_id', tournamentId)
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

    return NextResponse.json({ success: true, registration: updateResult.data[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/organizer/tournaments/[id]/registrations — Remove a team registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify tournament ownership
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('id, organizer_id, title')
      .eq('id', tournamentId)
      .single();

    if (!tourney || tourney.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id') || searchParams.get('registration_id');

    let registrationId = queryId;
    if (!registrationId) {
      try {
        const body = await request.json();
        registrationId = body.registration_id || body.id;
      } catch {
        // empty body
      }
    }

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required.' }, { status: 400 });
    }

    // Strategy 1: Try RPC SECURITY DEFINER function first
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('delete_registration_by_organizer', {
      p_registration_id: registrationId,
      p_caller_id: user.id,
    });

    if (!rpcErr && rpcResult && (rpcResult as { success: boolean }).success) {
      return NextResponse.json({
        success: true,
        message: 'Registration removed successfully.',
        removedRegistrationId: registrationId,
      });
    }

    const adminClient = getAdminClient();
    let deleteResult = null;

    if (adminClient) {
      deleteResult = await adminClient
        .from('tournament_teams')
        .delete()
        .eq('id', registrationId)
        .eq('tournament_id', tournamentId)
        .select();
    }

    if (!deleteResult?.data || deleteResult.data.length === 0) {
      deleteResult = await supabase
        .from('tournament_teams')
        .delete()
        .eq('id', registrationId)
        .eq('tournament_id', tournamentId)
        .select();
    }

    if (deleteResult.error) {
      return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
    }

    if (!deleteResult.data || deleteResult.data.length === 0) {
      return NextResponse.json(
        { error: 'Failed to remove registration from database (0 rows deleted).' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, message: 'Registration removed successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
