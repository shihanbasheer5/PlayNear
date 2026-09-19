import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/player/teams — get teams the logged-in player belongs to
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships, error } = await supabase
      .from('team_members')
      .select(`
        id,
        role_in_team,
        status,
        joined_at,
        team:teams(
          id,
          name,
          slug,
          city,
          bio,
          stats,
          captain_id,
          sport:sports(id, name, slug, icon_name)
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE');

    if (error) {
      console.warn('Error querying memberships:', error.message);
    }

    // Also fetch teams where user is captain
    const { data: captainTeams } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        slug,
        city,
        bio,
        stats,
        captain_id,
        sport:sports(id, name, slug, icon_name)
      `)
      .eq('captain_id', user.id);

    const membershipList = (memberships || []) as any[];
    const membershipTeamIds = new Set(membershipList.map(m => m.team?.id).filter(Boolean));

    const extraCaptainEntries = (captainTeams || [])
      .filter(t => !membershipTeamIds.has(t.id))
      .map(t => ({
        id: `captain-${t.id}`,
        role_in_team: 'CAPTAIN',
        status: 'ACTIVE',
        joined_at: null,
        team: t,
      }));

    return NextResponse.json({ memberships: [...membershipList, ...extraCaptainEntries] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
