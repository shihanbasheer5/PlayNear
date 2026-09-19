import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/teams/[id]/join/[requestId] — captain approves or rejects a join request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: teamId, requestId } = await params;
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is the team captain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, captain_id, name, current_players, max_players')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    if (team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only the team captain can approve or reject join requests.' }, { status: 403 });
    }

    // 3. Fetch the join request
    const { data: joinRequest, error: reqError } = await supabase
      .from('team_join_requests')
      .select('id, user_id, status, position_applying_for')
      .eq('id', requestId)
      .eq('team_id', teamId)
      .single();

    if (reqError || !joinRequest) {
      return NextResponse.json({ error: 'Join request not found.' }, { status: 404 });
    }

    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json({ error: `Request has already been ${joinRequest.status.toLowerCase()}.` }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // 'approve' | 'reject'

    if (action === 'approve') {
      // Check team is not full
      const maxPlayers = team.max_players || 15;
      const { count: currentActive } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'ACTIVE');

      if ((currentActive ?? 0) >= maxPlayers) {
        return NextResponse.json({ error: 'Team is already full.' }, { status: 400 });
      }

      // Check if player is already in team_members
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', joinRequest.user_id)
        .maybeSingle();

      const memberRole = joinRequest.position_applying_for || 'Player';

      if (existingMember) {
        const { error: updateError } = await supabase
          .from('team_members')
          .update({
            role_in_team: memberRole,
            status: 'ACTIVE',
            joined_at: new Date().toISOString(),
          })
          .eq('id', existingMember.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      } else {
        const memberPayload: Record<string, unknown> = {
          team_id: teamId,
          user_id: joinRequest.user_id,
          player_id: joinRequest.user_id,
          role_in_team: memberRole,
          status: 'ACTIVE',
          joined_at: new Date().toISOString(),
        };

        let { error: insertError } = await supabase.from('team_members').insert(memberPayload);

        if (insertError) {
          delete memberPayload.player_id;
          const retry = await supabase.from('team_members').insert(memberPayload);
          if (retry.error) {
            return NextResponse.json({ error: retry.error.message }, { status: 500 });
          }
        }
      }

      // Update join request status
      await supabase
        .from('team_join_requests')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      // Update current_players count
      await supabase
        .from('teams')
        .update({ current_players: (currentActive ?? 0) + 1 })
        .eq('id', teamId);

      return NextResponse.json({ success: true, message: 'Player approved and added to the team.' });
    } else if (action === 'reject') {
      await supabase
        .from('team_join_requests')
        .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      return NextResponse.json({ success: true, message: 'Join request rejected.' });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject".' }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
