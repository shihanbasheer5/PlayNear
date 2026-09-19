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

// GET /api/teams/[id]/leave — fetch pending leave requests (captain) or user leave status (player)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const reader = adminClient || supabase;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check team and captain status
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, captain_id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const isCaptain = team.captain_id === user.id;

    if (isCaptain) {
      // Captain: fetch all pending leave requests for this team
      const requestsMap = new Map<string, any>();

      // 1. Primary: check team_leave_requests table for status === 'PENDING'
      try {
        const { data: leaveData, error: leaveError } = await reader
          .from('team_leave_requests')
          .select(`
            id, reason, status, created_at, user_id,
            user:profiles(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender)
          `)
          .eq('team_id', teamId)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false });

        if (!leaveError && leaveData) {
          for (const item of leaveData) {
            requestsMap.set(item.user_id || item.id, {
              id: item.id,
              reason: item.reason || 'Requested to leave the team',
              status: 'PENDING',
              created_at: item.created_at,
              user: item.user,
              source: 'team_leave_requests',
            });
          }
        }
      } catch { /* table might not exist */ }

      // 2. Resilient: check team_join_requests ONLY with position_applying_for = 'LEAVE_REQUEST' AND status = 'PENDING'
      try {
        const { data: joinLeaveData, error: joinLeaveError } = await reader
          .from('team_join_requests')
          .select(`
            id, message, position_applying_for, status, created_at, user_id,
            user:profiles(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender)
          `)
          .eq('team_id', teamId)
          .eq('position_applying_for', 'LEAVE_REQUEST')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false });

        if (!joinLeaveError && joinLeaveData) {
          for (const item of joinLeaveData) {
            if (!requestsMap.has(item.user_id)) {
              requestsMap.set(item.user_id, {
                id: item.id,
                reason: item.message || 'Requested to leave the team',
                status: 'PENDING',
                created_at: item.created_at,
                user: item.user,
                source: 'team_join_requests',
              });
            }
          }
        }
      } catch (e) {
        console.warn('Error reading join requests for leave:', e);
      }

      // 3. Squad members explicitly tagged with status === 'LEAVE_REQUESTED'
      try {
        const { data: members } = await reader
          .from('team_members')
          .select('id, user_id, role_in_team, status, joined_at')
          .eq('team_id', teamId)
          .eq('status', 'LEAVE_REQUESTED');

        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id).filter(Boolean);
          const { data: profiles } = await reader
            .from('profiles')
            .select('id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender')
            .in('id', userIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p]));

          for (const member of members) {
            if (!requestsMap.has(member.user_id)) {
              requestsMap.set(member.user_id, {
                id: member.id,
                reason: 'Player requested to leave the team',
                status: 'PENDING',
                created_at: member.joined_at || new Date().toISOString(),
                user: profileMap.get(member.user_id),
                source: 'team_members',
              });
            }
          }
        }
      } catch (e) {
        console.warn('Error reading team_members for leave:', e);
      }

      const requests = Array.from(requestsMap.values());
      return NextResponse.json({ isCaptain: true, requests });
    } else {
      // Player: check if this user has a pending leave request
      let userRequest: any = null;

      // 1. Check team_leave_requests
      try {
        const { data: reqData } = await supabase
          .from('team_leave_requests')
          .select('id, reason, status, created_at')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .eq('status', 'PENDING')
          .maybeSingle();

        if (reqData) {
          userRequest = reqData;
        }
      } catch { /* table might not exist */ }

      // 2. Check team_join_requests
      if (!userRequest) {
        try {
          const { data: joinLeaveData } = await supabase
            .from('team_join_requests')
            .select('id, message, status, created_at')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .eq('position_applying_for', 'LEAVE_REQUEST')
            .eq('status', 'PENDING')
            .maybeSingle();

          if (joinLeaveData) {
            userRequest = {
              id: joinLeaveData.id,
              reason: joinLeaveData.message,
              status: 'PENDING',
              created_at: joinLeaveData.created_at,
            };
          }
        } catch { /* ignore */ }
      }

      return NextResponse.json({ isCaptain: false, userRequest });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/teams/[id]/leave — player submits leave request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to request to leave a team.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason = '' } = body;

    // 1. Check team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, captain_id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    // 2. Captain cannot request to leave own team
    if (team.captain_id === user.id) {
      return NextResponse.json({ error: 'Captain cannot leave the team. Transfer captaincy or delete the team instead.' }, { status: 400 });
    }

    // 3. Must be an active member
    const { data: member } = await supabase
      .from('team_members')
      .select('id, user_id, status')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      // Also check player_id column if present
      const { data: legacyMember } = await supabase
        .from('team_members')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('player_id', user.id)
        .maybeSingle();

      if (!legacyMember) {
        return NextResponse.json({ error: 'You are not a member of this team.' }, { status: 403 });
      }
    }

    let leaveRequestId: string = user.id;

    // 4. Try team_leave_requests table first
    try {
      const { data: newReq, error: insertError } = await supabase
        .from('team_leave_requests')
        .upsert({
          team_id: teamId,
          user_id: user.id,
          reason: reason.trim(),
          status: 'PENDING',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'team_id,user_id' })
        .select()
        .maybeSingle();

      if (!insertError && newReq) {
        leaveRequestId = newReq.id;
      }
    } catch { /* table might not exist yet */ }

    // 5. Store in team_join_requests (always works with established RLS)
    try {
      // Delete any prior request from this user on this team
      await supabase
        .from('team_join_requests')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      // Insert leave request row
      const { data: joinLeaveReq, error: joinLeaveErr } = await supabase
        .from('team_join_requests')
        .insert({
          team_id: teamId,
          user_id: user.id,
          message: reason.trim() || 'Player requested to leave the team',
          position_applying_for: 'LEAVE_REQUEST',
          status: 'PENDING',
        })
        .select()
        .single();

      if (!joinLeaveErr && joinLeaveReq) {
        leaveRequestId = joinLeaveReq.id;
      }
    } catch (e) {
      console.warn('Error saving to team_join_requests:', e);
    }

    // Try tagging team_members status if allowed
    try {
      await supabase
        .from('team_members')
        .update({ status: 'LEAVE_REQUESTED' })
        .eq('team_id', teamId)
        .eq('user_id', user.id);
    } catch { /* ignore RLS */ }

    return NextResponse.json({
      success: true,
      message: 'Leave request submitted. Awaiting captain approval.',
      requestId: leaveRequestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/leave — player cancels their pending leave request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cancel in team_leave_requests
    try {
      await supabase
        .from('team_leave_requests')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('status', 'PENDING');
    } catch { /* table might not exist */ }

    // Cancel / delete in team_join_requests
    try {
      await supabase
        .from('team_join_requests')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('position_applying_for', 'LEAVE_REQUEST');
    } catch { /* ignore */ }

    // Reset status in team_members back to ACTIVE
    try {
      await supabase
        .from('team_members')
        .update({ status: 'ACTIVE' })
        .eq('team_id', teamId)
        .eq('user_id', user.id);
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, message: 'Leave request withdrawn.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
