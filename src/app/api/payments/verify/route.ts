import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

// POST /api/payments/verify — Verify Razorpay payment signature
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, is_mock } = body;

    if (!razorpay_payment_id) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    // If mock test simulation
    if (is_mock || razorpay_order_id?.startsWith('order_mock_')) {
      return NextResponse.json({
        verified: true,
        payment_id: razorpay_payment_id,
        is_mock: true,
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keySecret && keySecret !== 'placeholder_secret') {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return NextResponse.json(
          { error: 'Payment signature verification failed. Please contact support if your money was debited.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      verified: true,
      payment_id: razorpay_payment_id,
    });
  } catch (err: unknown) {
    console.error('Payment verification error:', err);
    const msg = err instanceof Error ? err.message : 'Internal payment verification error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
