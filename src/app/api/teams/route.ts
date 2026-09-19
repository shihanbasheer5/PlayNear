import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_SPORT_SLUGS } from '@/lib/sports-config';
import { getOrEnsureSport } from '@/lib/ensure-sport';

// GET /api/teams — search teams (public, filtered to 4 supported sports)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sportSlug = (searchParams.get('sport') || '').toLowerCase().trim();
    const city = searchParams.get('city') || '';
    const search = searchParams.get('search') || '';

    // Build query — filter to ONLY the 4 supported sports
    let query = supabase
      .from('teams')
      .select(`
        *,
        sport:sports(id, name, slug, icon_name),
        captain:profiles!teams_captain_id_fkey(id, full_name, first_name, last_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Filter by sport slug — must be one of supported 4
    if (sportSlug && SUPPORTED_SPORT_SLUGS.includes(sportSlug as typeof SUPPORTED_SPORT_SLUGS[number])) {
      const { data: sportData } = await supabase
        .from('sports')
        .select('id')
        .ilike('slug', sportSlug)
        .maybeSingle();
      if (sportData) {
        query = query.eq('sport_id', sportData.id);
      }
    } else {
      // Only show teams from the 4 supported sports
      const { data: supportedSports } = await supabase
        .from('sports')
        .select('id')
        .in('slug', SUPPORTED_SPORT_SLUGS);
      if (supportedSports && supportedSports.length > 0) {
        query = query.in('sport_id', supportedSports.map(s => s.id));
      }
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const teamIds = (data || []).map((t: Record<string, unknown>) => t.id as string);

    // Fetch ACTIVE member counts separately for accuracy
    let memberCountMap: Record<string, number> = {};
    if (teamIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)
        .eq('status', 'ACTIVE');

      if (memberRows) {
        for (const row of memberRows) {
          const tid = row.team_id as string;
          memberCountMap[tid] = (memberCountMap[tid] || 0) + 1;
        }
      }
    }

    const teams = (data || []).map((team: Record<string, unknown>) => ({
      ...team,
      target_tournament: (team.target_tournament as string) || (team.description as string) || null,
      member_count: memberCountMap[team.id as string] ?? 0,
    }));

    return NextResponse.json({ teams });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/teams — create a team (authenticated)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to create a team.' }, { status: 401 });
    }

    // Check role — hosts are exclusively for creating and managing tournaments, not teams
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();
    if (role === 'ORGANIZER') {
      return NextResponse.json(
        { error: 'Tournament hosts cannot create teams. Hosts are dedicated to creating and managing tournaments.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, sport_slug, city, bio, max_players, positions_needed, current_players, logo_url, target_tournament } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    // Validate sport — MUST be one of the 4 supported sports
    if (!sport_slug || !SUPPORTED_SPORT_SLUGS.includes(sport_slug)) {
      return NextResponse.json(
        { error: 'Invalid sport. Only Cricket, Football, Kabaddi, and Volleyball are supported.' },
        { status: 400 }
      );
    }

    if (!city || !city.trim()) {
      return NextResponse.json({ error: 'City/location is required.' }, { status: 400 });
    }

    // Look up sport_id from slug or auto-provision if missing
    const sport = await getOrEnsureSport(supabase, sport_slug);

    if (!sport) {
      return NextResponse.json({ error: `Sport "${sport_slug}" not found in database. Please run supabase/seed_supported_sports.sql in your Supabase SQL Editor.` }, { status: 400 });
    }

    // Generate a unique slug
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const uniqueSuffix = Date.now().toString(36);
    const slug = `${baseSlug}-${uniqueSuffix}`;

    const cleanTargetTournament = target_tournament && typeof target_tournament === 'string' ? target_tournament.trim() : null;

    // Create team with universal schema cache recovery
    const teamPayload: Record<string, unknown> = {
      captain_id: user.id,
      sport_id: sport.id,
      name: name.trim(),
      slug,
      city: city.trim(),
      bio: bio?.trim() || '',
      description: cleanTargetTournament, // Fallback column that always exists
      target_tournament: cleanTargetTournament,
      logo_url: logo_url && typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null,
      max_players: max_players || 15,
      current_players: current_players || 1,
      positions_needed: positions_needed?.trim() || '',
      stats: { matches: 0, won: 0, lost: 0, draw: 0 },
    };

    let { data: team, error: insertError } = await supabase
      .from('teams')
      .insert(teamPayload)
      .select()
      .single();

    let teamAttempt = 0;
    while (insertError && teamAttempt < 6) {
      teamAttempt++;
      const match = insertError.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && match[1] in teamPayload) {
        delete teamPayload[match[1]];
        const retry = await supabase
          .from('teams')
          .insert(teamPayload)
          .select()
          .single();
        team = retry.data;
        insertError = retry.error;
      } else {
        break;
      }
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Add the captain as the first team member (support both user_id and legacy player_id)
    const memberPayload: Record<string, unknown> = {
      team_id: team.id,
      user_id: user.id,
      role_in_team: 'CAPTAIN',
      status: 'ACTIVE',
      joined_at: new Date().toISOString(),
    };

    let { error: memberError } = await supabase.from('team_members').insert({
      ...memberPayload,
      player_id: user.id,
    });

    if (memberError) {
      // Retry without player_id if column does not exist
      const retry = await supabase.from('team_members').insert(memberPayload);
      if (retry.error) {
        console.warn('Could not auto-add captain to team_members:', retry.error.message);
      }
    }

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
