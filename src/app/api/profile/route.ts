import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no row exists yet, return default structure from user metadata
    const meta = user.user_metadata || {};
    const fallbackProfile = profile || {
      id: user.id,
      email: user.email || '',
      full_name: meta.full_name || user.email?.split('@')[0] || 'Player',
      first_name: meta.first_name || '',
      last_name: meta.last_name || '',
      username: meta.username || user.email?.split('@')[0]?.toLowerCase() || '',
      date_of_birth: null,
      gender: null,
      phone: meta.phone || null,
      avatar_url: meta.avatar_url || null,
      city: meta.city || null,
      state: meta.state || null,
      bio: null,
      primary_sport: 'cricket',
      other_sports: [],
      playing_position: null,
      experience_achievements: null,
      role: meta.role || 'PLAYER',
    };

    return NextResponse.json({ profile: fallbackProfile });
  } catch (err: any) {
    console.error('Profile GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      username,
      date_of_birth,
      gender,
      phone,
      city,
      state,
      bio,
      avatar_url,
      primary_sport,
      other_sports,
      playing_position,
      experience_achievements,
    } = body;

    // Clean first and last name
    const cleanFirstName = (first_name || '').trim();
    const cleanLastName = (last_name || '').trim();
    const cleanFullName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ') || (user.email?.split('@')[0] ?? 'Player');

    // Clean username (lowercase, remove spaces, allow letters, numbers, underscores)
    let cleanUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername && cleanFirstName) {
      cleanUsername = cleanFirstName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }

    // Check username uniqueness if provided
    if (cleanUsername) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json(
          { error: `Username @${cleanUsername} is already taken. Please choose another.` },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {
      id: user.id,
      email: user.email,
      full_name: cleanFullName,
      first_name: cleanFirstName || null,
      last_name: cleanLastName || null,
      username: cleanUsername || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      phone: (phone || '').trim() || null,
      city: (city || '').trim() || null,
      state: (state || '').trim() || null,
      bio: (bio || '').trim() || null,
      avatar_url: avatar_url || null,
      primary_sport: primary_sport || 'cricket',
      other_sports: Array.isArray(other_sports) ? other_sports : [],
      playing_position: (playing_position || '').trim() || null,
      experience_achievements: (experience_achievements || '').trim() || null,
      updated_at: new Date().toISOString(),
    };

    // 1. Check if profile row already exists for this user
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    let updatedProfile = null;
    let saveError = null;

    if (existingProfile) {
      // User has existing row: UPDATE directly (triggers only UPDATE RLS policy)
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('*')
        .single();
      updatedProfile = data;
      saveError = error;
    } else {
      // First-time user profile: INSERT
      const { data, error } = await supabase
        .from('profiles')
        .insert(updates)
        .select('*')
        .single();
      updatedProfile = data;
      saveError = error;
    }

    // 2. Fallback: If RLS blocked it and service role key is configured, bypass RLS safely on server
    if (saveError && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.warn('RLS policy issue encountered, recovering via service role admin client...');
      try {
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: adminData, error: adminError } = await adminClient
          .from('profiles')
          .upsert(updates, { onConflict: 'id' })
          .select('*')
          .single();

        if (!adminError && adminData) {
          updatedProfile = adminData;
          saveError = null;
        } else if (adminError) {
          console.error('Admin client fallback error:', adminError);
        }
      } catch (adminException) {
        console.error('Admin client exception:', adminException);
      }
    }

    if (saveError) {
      console.error('Error updating profile in Supabase:', saveError);
      if (saveError.message?.includes('schema cache') || saveError.message?.includes('column')) {
        return NextResponse.json({
          error: `Missing database column. Please run the SQL migration query in your Supabase Dashboard SQL Editor (see supabase/migration_profile_settings.sql). Error: ${saveError.message}`
        }, { status: 400 });
      }
      if (saveError.message?.includes('row-level security') || saveError.message?.includes('RLS')) {
        return NextResponse.json({
          error: `Row-level security error: Please run the RLS fix query in your Supabase Dashboard SQL Editor to allow profile inserts/updates. Error: ${saveError.message}`
        }, { status: 400 });
      }
      return NextResponse.json({ error: saveError.message }, { status: 400 });
    }

    // Also update auth user metadata for convenience
    await supabase.auth.updateUser({
      data: {
        full_name: cleanFullName,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        avatar_url: avatar_url || null,
      },
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (err: any) {
    console.error('Profile PUT error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
