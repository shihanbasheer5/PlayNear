import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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

// PATCH /api/teams/[id]/leave/[requestId] — captain approves or rejects leave request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: teamId, requestId } = await params;
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const db = adminClient || supabase;

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is the team captain
    const { data: team, error: teamError } = await db
      .from('teams')
      .select('id, captain_id, name, current_players')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    if (team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only the team captain can approve or reject leave requests.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body; // 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject".' }, { status: 400 });
    }

    // 3. Find target player by checking team_leave_requests, team_join_requests, or team_members
    let targetUserId: string | null = null;

    // Check in team_leave_requests
    try {
      const { data: leaveReq } = await db
        .from('team_leave_requests')
        .select('id, user_id')
        .eq('id', requestId)
        .eq('team_id', teamId)
        .maybeSingle();

      if (leaveReq) targetUserId = leaveReq.user_id;
    } catch { /* ignore */ }

    // Check in team_join_requests
    if (!targetUserId) {
      try {
        const { data: joinReq } = await db
          .from('team_join_requests')
          .select('id, user_id')
          .eq('id', requestId)
          .eq('team_id', teamId)
          .maybeSingle();

        if (joinReq) targetUserId = joinReq.user_id;
      } catch { /* ignore */ }
    }

    // Check in team_members
    if (!targetUserId) {
      try {
        const { data: mem } = await db
          .from('team_members')
          .select('id, user_id, player_id')
          .eq('id', requestId)
          .eq('team_id', teamId)
          .maybeSingle();

        if (mem) targetUserId = mem.user_id || mem.player_id;
      } catch { /* ignore */ }
    }

    // Check if requestId itself is a user ID in profiles
    if (!targetUserId) {
      try {
        const { data: prof } = await db
          .from('profiles')
          .select('id')
          .eq('id', requestId)
          .maybeSingle();

        if (prof) targetUserId = prof.id;
      } catch { /* ignore */ }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Leave request or member not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      // 1. Remove player from team_members (handles user_id, player_id, and row id)
      try {
        await db
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .or(`user_id.eq.${targetUserId},player_id.eq.${targetUserId},id.eq.${requestId}`);
      } catch { /* ignore */ }

      try {
        await supabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .or(`user_id.eq.${targetUserId},player_id.eq.${targetUserId},id.eq.${requestId}`);
      } catch { /* ignore */ }

      // 2. Remove / delete from team_join_requests
      try {
        await db
          .from('team_join_requests')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', targetUserId);
      } catch { /* ignore */ }

      try {
        await supabase
          .from('team_join_requests')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', targetUserId);
      } catch { /* ignore */ }

      // 3. Update team_leave_requests if table exists
      try {
        await db
          .from('team_leave_requests')
          .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
          .eq('team_id', teamId)
          .eq('user_id', targetUserId);
      } catch { /* ignore */ }

      try {
        await db
          .from('team_leave_requests')
          .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } catch { /* ignore */ }

      // 4. Decrement team current_players
      try {
        const nextCount = Math.max(1, (team.current_players || 1) - 1);
        await db
          .from('teams')
          .update({ current_players: nextCount })
          .eq('id', teamId);
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        message: 'Leave request approved. Player removed from squad.',
        userId: targetUserId,
        action: 'approved',
      });
    } else {
      // Reject:
      // 1. Restore status to ACTIVE in team_members
      try {
        await db
          .from('team_members')
          .update({ status: 'ACTIVE' })
          .eq('team_id', teamId)
          .or(`user_id.eq.${targetUserId},player_id.eq.${targetUserId},id.eq.${requestId}`);
      } catch { /* ignore */ }

      try {
        await supabase
          .from('team_members')
          .update({ status: 'ACTIVE' })
          .eq('team_id', teamId)
          .or(`user_id.eq.${targetUserId},player_id.eq.${targetUserId},id.eq.${requestId}`);
      } catch { /* ignore */ }

      // 2. Mark / delete in team_join_requests
      try {
        await db
          .from('team_join_requests')
          .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
          .eq('team_id', teamId)
          .eq('user_id', targetUserId)
          .eq('position_applying_for', 'LEAVE_REQUEST');
      } catch { /* ignore */ }

      try {
        await supabase
          .from('team_join_requests')
          .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
          .eq('team_id', teamId)
          .eq('user_id', targetUserId)
          .eq('position_applying_for', 'LEAVE_REQUEST');
      } catch { /* ignore */ }

      // 3. Mark in team_leave_requests
      try {
        await db
          .from('team_leave_requests')
          .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
          .eq('team_id', teamId)
          .eq('user_id', targetUserId);
      } catch { /* ignore */ }

      try {
        await db
          .from('team_leave_requests')
          .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } catch { /* ignore */ }

      return NextResponse.json({
        success: true,
        message: 'Leave request rejected. Player remains in squad.',
        userId: targetUserId,
        action: 'rejected',
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
