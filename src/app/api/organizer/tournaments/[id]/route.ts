import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/organizer/tournaments/[id] — Fetch single tournament details for owner
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

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        sport:sports(id, name, slug, icon_name),
        tournament_teams(
          id,
          status,
          registered_at,
          team:teams(
            id,
            name,
            slug,
            city,
            logo_url,
            bio,
            stats,
            captain:profiles!teams_captain_id_fkey(id, full_name, first_name, email, phone)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Security: normal organizers can ONLY access their own tournaments
    if (tournament.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to manage this tournament.' }, { status: 403 });
    }

    return NextResponse.json({ tournament });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/organizer/tournaments/[id] — Update tournament details
export async function PATCH(
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('tournaments')
      .select('id, organizer_id')
      .eq('id', id)
      .single();

    if (!existing || existing.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      venue_name,
      venue_address,
      venue_city,
      status,
      entry_fee,
      prize_pool,
      rules_text,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title) {
      updates.title = title.trim();
      updates.name = title.trim();
    }
    if (description !== undefined) updates.description = description.trim();
    if (venue_name) updates.venue_name = venue_name.trim();
    if (venue_address) updates.venue_address = venue_address.trim();
    if (venue_city) updates.venue_city = venue_city.trim();
    if (status) updates.status = status;
    if (entry_fee !== undefined) {
      updates.entry_fee = typeof entry_fee === 'number'
        ? entry_fee
        : parseInt(String(entry_fee || '0').replace(/[^0-9]/g, ''), 10) || 0;
    }
    if (prize_pool !== undefined) updates.prize_pool = prize_pool.trim();
    if (rules_text !== undefined) updates.rules_text = rules_text.trim();

    let { data: updated, error: updateError } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    // Universal auto-recovery loop: if any column is missing in schema cache, strip it and retry automatically
    let patchAttempt = 0;
    while (updateError && patchAttempt < 8) {
      patchAttempt++;
      const match = updateError.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && match[1] in updates) {
        delete updates[match[1]];
        const retry = await supabase
          .from('tournaments')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        updated = retry.data;
        updateError = retry.error;
      } else {
        break;
      }
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tournament: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/organizer/tournaments/[id] — Permanently delete a tournament
export async function DELETE(
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

    // Verify ownership before deleting
    const { data: existing } = await supabase
      .from('tournaments')
      .select('id, organizer_id, title')
      .eq('id', id)
      .single();

    if (!existing || existing.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tournament.' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Tournament "${existing.title}" has been deleted.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
