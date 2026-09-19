import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_SPORT_SLUGS } from '@/lib/sports-config';
import { getOrEnsureSport } from '@/lib/ensure-sport';
import { resolveTournamentCoordinates } from '@/lib/geo-utils';
import { isTournamentOver } from '@/lib/tournament-status';

// GET /api/organizer/tournaments — List tournaments owned by authenticated organizer
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify organizer role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const dbRole = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();
    if (dbRole !== 'ORGANIZER' && dbRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Organizer access only' }, { status: 403 });
    }

    // Fetch tournaments belonging strictly to this organizer
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        sport:sports(id, name, slug, icon_name),
        tournament_teams(id, status)
      `)
      .eq('organizer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out finished or cancelled/deleted tournaments
    const activeTournaments = (tournaments || []).filter((t: any) => {
      const status = (t.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'FINISHED' || status === 'CANCELLED' || status === 'DELETED') {
        return false;
      }
      if (isTournamentOver(t)) {
        return false;
      }
      return true;
    });

    const formatted = activeTournaments.map((t: Record<string, unknown>) => {
      const teamRows = (t.tournament_teams as Array<{ id: string; status: string }> | null) || [];
      const approvedCount = teamRows.filter((tt) => tt.status === 'APPROVED').length;
      return {
        ...t,
        registered_count: approvedCount,
        tournament_teams: undefined,
      };
    });

    return NextResponse.json({ tournaments: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/organizer/tournaments — Create a tournament owned by authenticated organizer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // Verify organizer role from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const dbRole = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();
    if (dbRole !== 'ORGANIZER' && dbRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only organizers can create tournaments.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      sport_slug,
      description,
      banner_url,
      format = 'SINGLE_ELIMINATION',
      venue_name,
      venue_address,
      venue_city,
      registration_start_date,
      registration_end_date,
      tournament_start_date,
      tournament_end_date,
      max_teams = 8,
      min_players_per_team = 1,
      max_players_per_team = 15,
      entry_fee = 0,
      prize_pool = '',
      rules_text = '',
    } = body;

    // Validate Title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Tournament title is required.' }, { status: 400 });
    }

    // Validate Sport — ONLY the 4 supported sports
    if (!sport_slug || !SUPPORTED_SPORT_SLUGS.includes(sport_slug)) {
      return NextResponse.json(
        { error: 'Invalid sport. Only Cricket, Football, Kabaddi, and Volleyball are supported.' },
        { status: 400 }
      );
    }

    if (!venue_name || !venue_city) {
      return NextResponse.json({ error: 'Venue name and city are required.' }, { status: 400 });
    }

    // Retrieve sport_id from slug or auto-provision if missing
    const sport = await getOrEnsureSport(supabase, sport_slug);

    if (!sport) {
      return NextResponse.json(
        { error: `Sport "${sport_slug}" not found in database. Please run supabase/seed_supported_sports.sql in your Supabase SQL Editor.` },
        { status: 400 }
      );
    }

    // Generate unique slug
    const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const uniqueSuffix = Date.now().toString(36);
    const slug = `${baseSlug}-${uniqueSuffix}`;

    const now = new Date().toISOString();
    const tourneyStart = tournament_start_date ? new Date(tournament_start_date).toISOString() : now;
    const tourneyEnd = tournament_end_date ? new Date(tournament_end_date).toISOString() : tourneyStart;
    const regStart = registration_start_date ? new Date(registration_start_date).toISOString() : now;
    const regEnd = registration_end_date ? new Date(registration_end_date).toISOString() : tourneyStart;

    const numericEntryFee = typeof entry_fee === 'number'
      ? entry_fee
      : parseInt(String(entry_fee || '0').replace(/[^0-9]/g, ''), 10) || 0;

    const bannerImageUrl = banner_url && banner_url.trim().length > 0 
      ? banner_url.trim() 
      : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200';

    // Compute venue coordinates for interactive map
    const coords = resolveTournamentCoordinates({
      id: slug,
      venue_lat: Number(body.venue_lat) || null,
      venue_lng: Number(body.venue_lng) || null,
      venue_city: venue_city.trim(),
      venue_address: venue_address?.trim() || venue_name.trim(),
      venue_name: venue_name.trim(),
    });

    const insertPayload: Record<string, unknown> = {
      organizer_id: user.id, // NEVER trusting frontend organizer_id
      sport_id: sport.id,
      title: title.trim(),
      name: title.trim(),
      slug,
      description: description?.trim() || '',
      banner_url: bannerImageUrl,
      format,
      status: 'REGISTRATION_OPEN',
      venue_name: venue_name.trim(),
      venue_address: venue_address?.trim() || venue_name.trim(),
      venue_city: venue_city.trim(),
      venue_lat: coords.lat,
      venue_lng: coords.lng,
      registration_start_date: regStart,
      registration_end_date: regEnd,
      tournament_start_date: tourneyStart,
      tournament_end_date: tourneyEnd,
      max_teams: Number(max_teams) || 8,
      min_players_per_team: Number(min_players_per_team) || 1,
      max_players_per_team: Number(max_players_per_team) || 15,
      entry_fee: numericEntryFee,
      currency: 'INR',
      prize_pool: prize_pool?.trim() || '',
      rules_text: rules_text?.trim() || '',
    };

    // Server-enforce organizer_id = authenticated user ID
    let { data: tournament, error: insertError } = await supabase
      .from('tournaments')
      .insert(insertPayload)
      .select()
      .single();

    // Universal auto-recovery loop: if any column is missing in schema cache, strip it and retry automatically
    let retryAttempt = 0;
    while (insertError && retryAttempt < 8) {
      retryAttempt++;
      const match = insertError.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && match[1] in insertPayload) {
        delete insertPayload[match[1]];
        const retry = await supabase
          .from('tournaments')
          .insert(insertPayload)
          .select()
          .single();
        tournament = retry.data;
        insertError = retry.error;
      } else {
        break;
      }
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tournament }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
