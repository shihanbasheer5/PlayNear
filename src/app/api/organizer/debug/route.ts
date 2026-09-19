import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/organizer/debug
 * Diagnoses exactly why approve/reject is failing.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ step: 'AUTH', error: 'Not logged in — please sign in first.' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasRealServiceKey =
      !!serviceRoleKey &&
      serviceRoleKey !== anonKey &&
      !serviceRoleKey.startsWith('sb_publishable_') &&
      serviceRoleKey.length > 50;

    // Step 1: Find a tournament owned by this user
    const { data: myTournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('id, title, organizer_id')
      .eq('organizer_id', user.id)
      .limit(1);

    if (tErr) {
      return NextResponse.json({ step: 'FETCH_TOURNAMENTS', error: tErr.message, user_id: user.id });
    }

    if (!myTournaments || myTournaments.length === 0) {
      return NextResponse.json({
        step: 'NO_TOURNAMENTS',
        message: 'You have no tournaments. Create one first, then register a team to it.',
        user_id: user.id,
        has_service_key: hasRealServiceKey,
      });
    }

    const tournament = myTournaments[0];

    // Step 2: Find a registration in that tournament
    const { data: regs, error: rErr } = await supabase
      .from('tournament_teams')
      .select('id, status, tournament_id')
      .eq('tournament_id', tournament.id)
      .limit(1);

    if (rErr) {
      return NextResponse.json({ step: 'FETCH_REGS', error: rErr.message });
    }

    if (!regs || regs.length === 0) {
      return NextResponse.json({
        step: 'NO_REGISTRATIONS',
        message: 'No teams registered yet for your tournament. Register a team first.',
        tournament_id: tournament.id,
        tournament_title: tournament.title,
        has_service_key: hasRealServiceKey,
      });
    }

    const reg = regs[0];

    // Step 3: Test RPC function (SECURITY DEFINER — created by fix_organizer_registration_policies.sql)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('update_registration_status', {
      p_registration_id: reg.id,
      p_new_status: reg.status, // same value — no actual change, just tests permission
      p_caller_id: user.id,
    });

    const rpcWorking = !rpcErr && rpcResult && (rpcResult as any).success === true;

    // Step 4: Test direct UPDATE via authenticated session (depends on RLS policies)
    const { data: directUpdate, error: directErr } = await supabase
      .from('tournament_teams')
      .update({ status: reg.status }) // same value — no actual change
      .eq('id', reg.id)
      .select('id, status');

    const directWorking = !directErr && directUpdate && directUpdate.length > 0;

    return NextResponse.json({
      diagnosis: {
        user_id: user.id,
        user_email: user.email,
        has_service_role_key: hasRealServiceKey,
        tournament_id: tournament.id,
        tournament_title: tournament.title,
        test_registration_id: reg.id,
        test_registration_status: reg.status,
      },
      tests: {
        rpc_function_exists: !rpcErr,
        rpc_function_works: rpcWorking,
        rpc_error: rpcErr?.message || null,
        direct_update_works: directWorking,
        direct_update_error: directErr?.message || null,
        direct_update_rows: directUpdate?.length ?? 0,
      },
      verdict:
        rpcWorking
          ? '✅ RPC works — approve/reject should work. If still failing, restart the dev server.'
          : directWorking
          ? '✅ Direct update works — approve/reject should work. Restart the dev server.'
          : `❌ BOTH methods failing. Fix: run supabase/fix_organizer_registration_policies.sql in Supabase SQL Editor. RPC error: ${rpcErr?.message || 'function not found'} | Direct error: ${directErr?.message || '0 rows (RLS blocked)'}`,
      next_step: rpcWorking || directWorking
        ? 'Both methods work — try approving again after a hard refresh (Ctrl+Shift+R).'
        : 'Open Supabase Dashboard → SQL Editor → paste and run the contents of: supabase/fix_organizer_registration_policies.sql',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
