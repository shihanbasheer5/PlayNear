import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/teams/[id]/members/[memberId] — captain removes a player
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: teamId, memberId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the requester is the captain
    const { data: team } = await supabase
      .from('teams')
      .select('captain_id, current_players')
      .eq('id', teamId)
      .single();

    if (!team || team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only the captain can remove players' }, { status: 403 });
    }

    // Prevent captain from removing themselves
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, user_id, role_in_team')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (membership.role_in_team === 'CAPTAIN') {
      return NextResponse.json({ error: 'Cannot remove the captain' }, { status: 400 });
    }

    // Delete membership
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Decrement current_players (non-critical, ignore errors)
    try {
      const currentCount = (team as any)?.current_players;
      if (typeof currentCount === 'number') {
        await supabase
          .from('teams')
          .update({ current_players: Math.max(1, currentCount - 1) })
          .eq('id', teamId);
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Player removed from team' });
  } catch (err: unknown) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Internal error' }, { status: 500 });
  }
}
