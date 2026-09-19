import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/teams/[id]/join — fetch pending join requests (captain only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify captain
    const { data: team } = await supabase
      .from('teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();

    if (!team || team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from('team_join_requests')
      .select(`
        id, message, position_applying_for, status, created_at,
        user:profiles(id, full_name, first_name, last_name, username, avatar_url, city, primary_sport, playing_position, bio, phone, gender, experience_achievements)
      `)
      .eq('team_id', teamId)
      .eq('status', 'PENDING')
      .neq('position_applying_for', 'LEAVE_REQUEST')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/teams/[id]/join — request to join a team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const supabase = await createClient();

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to request to join a team.' }, { status: 401 });
    }

    const body = await request.json();
    const { message = '', position_applying_for = '' } = body;

    // 2. Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, captain_id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    // 3. Cannot request to join your own team (captain)
    if (team.captain_id === user.id) {
      return NextResponse.json({ error: 'You are the captain of this team.' }, { status: 400 });
    }

    // 4. Check if already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this team.' }, { status: 400 });
    }

    // 5. Check for duplicate request (prevent duplicates)
    const { data: existingRequest } = await supabase
      .from('team_join_requests')
      .select('id, status')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json(
          { error: 'You already have a pending request to join this team.' },
          { status: 400 }
        );
      }
      // If previously rejected, allow re-request by updating
      const { data: updated, error: updateErr } = await supabase
        .from('team_join_requests')
        .update({ status: 'PENDING', message, position_applying_for, updated_at: new Date().toISOString() })
        .eq('id', existingRequest.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, request: updated, message: 'Join request re-submitted.' });
    }

    // 6. Create the join request
    const { data: joinRequest, error: insertError } = await supabase
      .from('team_join_requests')
      .insert({
        team_id: teamId,
        user_id: user.id,
        message: message.trim(),
        position_applying_for: position_applying_for.trim(),
        status: 'PENDING',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, request: joinRequest, message: 'Join request sent successfully!' },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
