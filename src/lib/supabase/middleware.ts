import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Get current user session
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect authenticated users away from Auth pages (/login, /signup)
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const url = request.nextUrl.clone();
    url.pathname = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Protect Organizer Routes (/organizer, /organizer/*)
  if (pathname.startsWith('/organizer')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Check database role for the authenticated user
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const dbRole = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();

    // Deny access to Players on Organizer routes
    if (dbRole !== 'ORGANIZER' && dbRole !== 'ADMIN') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Protect Player Dashboard and Team Creation/Management against Organizers
  // Hosts/Organizers are exclusively for creating and managing tournaments
  if (pathname === '/dashboard' || pathname === '/teams' || pathname === '/teams/new' || pathname.startsWith('/teams/new') || pathname === '/my-teams' || pathname.startsWith('/my-teams')) {
    if (!user) {
      if (pathname === '/dashboard' || pathname === '/teams/new' || pathname.startsWith('/my-teams')) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const dbRole = (profile?.role || user.user_metadata?.role || 'PLAYER').toUpperCase();

    if (dbRole === 'ORGANIZER') {
      const url = request.nextUrl.clone();
      url.pathname = '/organizer';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
