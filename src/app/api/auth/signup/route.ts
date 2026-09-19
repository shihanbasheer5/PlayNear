import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validatePasswordRequirements } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, first_name, last_name, email, password, role } = body;

    // 1. Basic field checks
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Strict role validation — only PLAYER or ORGANIZER, no ADMIN creation through signup
    const validRoles = ['PLAYER', 'ORGANIZER'];
    const userRole = validRoles.includes(role) ? role : 'PLAYER';

    // 2. Strict Backend Password Validation
    const passwordValidation = validatePasswordRequirements(password || '');
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error || 'Password does not meet security requirements.' },
        { status: 400 }
      );
    }

    // 3. Check Supabase Environment Configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(
        {
          error:
            'Database connection not configured. Please check your Supabase credentials in .env.local.',
        },
        { status: 503 }
      );
    }

    // 4. Create User in Supabase Auth (Immediate account creation without email confirmation requirement)
    const supabase = await createClient();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanFirstName = (first_name || '').trim();
    const cleanLastName = (last_name || '').trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          role: userRole,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to create user account.' },
        { status: 400 }
      );
    }

    // 5. Ensure the profile row exists in public.profiles with the exact database role
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanName,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        role: userRole,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    // 6. Sign in immediately so the session is active right away
    let session = data.session;
    if (!session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });
      session = signInData?.session || null;
    }

    const redirectUrl = userRole === 'ORGANIZER' ? '/organizer' : '/dashboard';

    return NextResponse.json({
      success: true,
      user: data.user,
      session: session,
      role: userRole,
      redirectUrl,
      message: 'Account created and ready immediately.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error during account creation.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
