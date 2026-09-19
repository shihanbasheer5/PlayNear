import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { confirmation } = body;

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Please type DELETE to confirm account deletion.' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // 1. Delete associated data where cascade may not be automatic
    // Delete team join requests created by user
    await supabase.from('team_join_requests').delete().eq('user_id', userId);
    // Delete team memberships
    await supabase.from('team_members').delete().eq('user_id', userId);
    // Delete profile
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.warn('Profile deletion error:', profileDeleteError);
    }

    // 2. If service role key is available, delete the auth user via Admin API
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceRoleKey && supabaseUrl) {
      const adminClient = createAdminClient(supabaseUrl, serviceRoleKey);
      const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (adminDeleteError) {
        console.warn('Admin user delete warning:', adminDeleteError);
      }
    }

    // 3. Sign out the session
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err: any) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete account' }, { status: 500 });
  }
}
