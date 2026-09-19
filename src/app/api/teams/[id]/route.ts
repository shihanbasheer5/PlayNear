import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/teams/[id] — get team details (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    let { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        sport:sports(id, name, slug, icon_name),
        captain:profiles!teams_captain_id_fkey(id, full_name, first_name, last_name, avatar_url, city),
        team_members(
          id,
          role_in_team,
          status,
          joined_at,
          user:profiles!team_members_user_id_fkey(id, full_name, first_name, last_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    // Resilient fallback if nested team_members relation failed
    if (error || !team) {
      const { data: fallbackTeam, error: fallbackError } = await supabase
        .from('teams')
        .select(`
          *,
          sport:sports(id, name, slug, icon_name),
          captain:profiles!teams_captain_id_fkey(id, full_name, first_name, last_name, avatar_url, city)
        `)
        .eq('id', id)
        .single();

      if (fallbackError || !fallbackTeam) {
        return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
      }

      // Fetch team members separately
      const { data: members } = await supabase
        .from('team_members')
        .select(`
          id,
          role_in_team,
          status,
          joined_at,
          user:profiles!team_members_user_id_fkey(id, full_name, first_name, last_name, avatar_url)
        `)
        .eq('team_id', id);

      team = {
        ...fallbackTeam,
        team_members: members || [],
      };
    }

    const normalizedTeam = team ? {
      ...team,
      target_tournament: (team.target_tournament as string) || (team.description as string) || null,
    } : null;

    return NextResponse.json({ team: normalizedTeam });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/teams/[id] — update team details (Captain only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });
    }

    // Check if team exists and caller is captain
    const { data: existingTeam, error: fetchError } = await supabase
      .from('teams')
      .select('id, captain_id, stats')
      .eq('id', id)
      .single();

    if (fetchError || !existingTeam) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    if (existingTeam.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only the team captain can edit team details.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, logo_url, bio, city, positions_needed, stats, max_players, target_tournament } = body;

    const updatePayload: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Team name cannot be empty.' }, { status: 400 });
      }
      updatePayload.name = name.trim();
    }

    if (target_tournament !== undefined) {
      const cleanTarget = target_tournament && typeof target_tournament === 'string' && target_tournament.trim() ? target_tournament.trim() : null;
      updatePayload.target_tournament = cleanTarget;
      updatePayload.description = cleanTarget; // Resilient fallback
    }

    if (logo_url !== undefined) {
      updatePayload.logo_url = logo_url && typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null;
    }

    if (bio !== undefined) {
      updatePayload.bio = String(bio).trim();
    }

    if (city !== undefined) {
      updatePayload.city = String(city).trim();
    }

    if (positions_needed !== undefined) {
      updatePayload.positions_needed = String(positions_needed).trim();
    }

    if (max_players !== undefined) {
      updatePayload.max_players = parseInt(max_players) || 15;
    }

    if (stats !== undefined && typeof stats === 'object' && stats !== null) {
      const won = Math.max(0, parseInt(stats.won) || 0);
      const draw = Math.max(0, parseInt(stats.draw) || 0);
      const lost = Math.max(0, parseInt(stats.lost) || 0);
      const matches = stats.matches !== undefined ? Math.max(0, parseInt(stats.matches) || 0) : (won + draw + lost);
      updatePayload.stats = { matches, won, draw, lost };
    }

    let { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        sport:sports(id, name, slug, icon_name),
        captain:profiles!teams_captain_id_fkey(id, full_name, first_name, last_name, avatar_url, city)
      `)
      .single();

    if (updateError) {
      const match = updateError.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && match[1] in updatePayload) {
        delete updatePayload[match[1]];
        const retry = await supabase
          .from('teams')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        updatedTeam = retry.data;
        updateError = retry.error;
      }
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const normalizedUpdated = updatedTeam ? {
      ...updatedTeam,
      target_tournament: (updatedTeam.target_tournament as string) || (updatedTeam.description as string) || null,
    } : null;

    return NextResponse.json({ success: true, team: normalizedUpdated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { createClient as createAdminClient } from '@supabase/supabase-js';

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

// DELETE /api/teams/[id] — permanently delete team from database (Captain only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to delete a team.' }, { status: 401 });
    }

    // Verify team exists and requester is the captain
    const { data: team, error: fetchError } = await supabase
      .from('teams')
      .select('id, captain_id, name')
      .eq('id', id)
      .single();

    if (fetchError || !team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    if (team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only the team captain can delete this team.' }, { status: 403 });
    }

    // ── Strategy 1: Try RPC SECURITY DEFINER function first ──
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('delete_team_by_captain', {
      p_team_id: id,
      p_captain_id: user.id,
    });

    if (!rpcErr && rpcResult && (rpcResult as { success?: boolean }).success) {
      return NextResponse.json({
        success: true,
        message: (rpcResult as { message?: string }).message || `Team "${team.name}" has been permanently deleted from the database.`,
      });
    }

    // ── Strategy 2: If Service Role Admin Client is available, bypass RLS ──
    const adminClient = getAdminClient();
    const effectiveClient = adminClient || supabase;

    // 1. Delete all team leave requests
    try {
      await effectiveClient.from('team_leave_requests').delete().eq('team_id', id);
    } catch { /* non-critical */ }

    // 2. Delete all team join requests
    try {
      await effectiveClient.from('team_join_requests').delete().eq('team_id', id);
    } catch { /* non-critical */ }

    // 3. Delete all squad members
    try {
      await effectiveClient.from('team_members').delete().eq('team_id', id);
    } catch { /* non-critical */ }

    // 4. Delete tournament team registrations
    try {
      await effectiveClient.from('tournament_teams').delete().eq('team_id', id);
    } catch { /* non-critical */ }

    // 5. Clear references from matches (home_team_id, away_team_id, winner_team_id)
    try {
      await effectiveClient.from('matches').update({ home_team_id: null }).eq('home_team_id', id);
    } catch { /* non-critical */ }
    try {
      await effectiveClient.from('matches').update({ away_team_id: null }).eq('away_team_id', id);
    } catch { /* non-critical */ }
    try {
      await effectiveClient.from('matches').update({ winner_team_id: null }).eq('winner_team_id', id);
    } catch { /* non-critical */ }

    // 6. Delete the team record itself
    const { error: deleteError } = await effectiveClient
      .from('teams')
      .delete()
      .eq('id', id);

    if (deleteError) {
      if (deleteError.message.includes('tournament_teams') || deleteError.message.includes('foreign key')) {
        return NextResponse.json({
          error: `Foreign key constraint: Tournament registrations exist for this team. Please run supabase/migration_team_deletion.sql in your Supabase SQL Editor to enable automatic cascading deletions. (${deleteError.message})`
        }, { status: 409 });
      }
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Team "${team.name}" has been permanently deleted from the database.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
