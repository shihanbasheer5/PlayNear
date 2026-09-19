import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === 'rzp_test_placeholder') {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// POST /api/payments/create-order — Create a Razorpay Order for tournament registration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to proceed with payment.' }, { status: 401 });
    }

    const body = await request.json();
    const { tournament_id, team_id } = body;

    if (!tournament_id || !team_id) {
      return NextResponse.json({ error: 'tournament_id and team_id are required.' }, { status: 400 });
    }

    // 1. Fetch tournament
    const { data: tournament, error: tourneyError } = await supabase
      .from('tournaments')
      .select('id, title, entry_fee, currency, max_teams')
      .eq('id', tournament_id)
      .single();

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
    }

    // 1b. Verify user is the captain of the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Selected team not found.' }, { status: 404 });
    }

    let isCaptain = team.captain_id === user.id;
    if (!isCaptain) {
      const { data: captainMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .ilike('role_in_team', 'CAPTAIN')
        .maybeSingle();

      if (captainMember) isCaptain = true;
    }

    if (!isCaptain) {
      return NextResponse.json(
        { error: `Permission denied: Only the captain of "${team.name}" can initiate registration and payment.` },
        { status: 403 }
      );
    }

    const entryFee = tournament.entry_fee ?? 0;
    const currency = tournament.currency || 'INR';

    // Free tournament: no Razorpay order required
    if (entryFee <= 0) {
      return NextResponse.json({
        isFree: true,
        amount: 0,
        currency,
        message: 'No payment required for this tournament.',
      });
    }

    const amountInPaise = Math.round(entryFee * 100);
    const razorpay = getRazorpayClient();
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;

    // If Razorpay keys are not yet configured or in mock test mode
    if (!razorpay || !keyId) {
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return NextResponse.json({
        isMock: true,
        order_id: mockOrderId,
        amount: amountInPaise,
        currency,
        key_id: keyId || 'rzp_test_placeholder',
        tournament_title: tournament.title,
        message: 'Razorpay keys not configured. Running in simulated test mode.',
      });
    }

    // 2. Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `rcpt_${Date.now()}_${team_id.slice(0, 6)}`,
      notes: {
        tournament_id: tournament.id,
        tournament_title: tournament.title,
        team_id,
        user_id: user.id,
      },
    });

    return NextResponse.json({
      isFree: false,
      isMock: false,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      tournament_title: tournament.title,
    });
  } catch (err: unknown) {
    console.error('Error creating Razorpay order:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create payment order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
