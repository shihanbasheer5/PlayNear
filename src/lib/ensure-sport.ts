import { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSportBySlug } from './sports-config';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    serviceRoleKey &&
    supabaseUrl &&
    serviceRoleKey !== anonKey &&
    !serviceRoleKey.startsWith('sb_publishable_') &&
    serviceRoleKey.length > 50
  ) {
    return createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return null;
}

/**
 * Ensures that a sport exists in the database by slug.
 * Handles auto-provisioning via RPC, admin client, or direct insert.
 */
export async function getOrEnsureSport(
  supabase: SupabaseClient,
  sportSlug: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const cleanSlug = sportSlug.trim().toLowerCase();
  const sportDef = getSportBySlug(cleanSlug);

  // 1. Try finding by slug (case-insensitive)
  const { data: existingSport } = await supabase
    .from('sports')
    .select('id, name, slug')
    .ilike('slug', cleanSlug)
    .maybeSingle();

  if (existingSport) {
    return existingSport;
  }

  // 1b. Also try finding by name if slug didn't match (e.g. name = 'Kabaddi' or 'Volleyball')
  if (sportDef) {
    const { data: existingByName } = await supabase
      .from('sports')
      .select('id, name, slug')
      .ilike('name', `%${sportDef.name}%`)
      .maybeSingle();

    if (existingByName) {
      return existingByName;
    }
  }

  // 2. Try RPC get_or_create_sport (SECURITY DEFINER)
  try {
    const { data: rpcSport, error: rpcErr } = await supabase.rpc('get_or_create_sport', {
      p_slug: cleanSlug,
      p_name: sportDef?.name || cleanSlug,
      p_category: 'TEAM',
      p_icon_name: cleanSlug,
    });

    if (!rpcErr && rpcSport) {
      const sportRecord = Array.isArray(rpcSport) ? rpcSport[0] : rpcSport;
      if (sportRecord?.id) {
        return sportRecord;
      }
    }
  } catch {
    // RPC may not exist in database yet
  }

  // 3. Try with service-role admin client if available
  const adminClient = getAdminClient();
  const targetClient = adminClient || supabase;

  try {
    const { data: insertedSport, error: insertErr } = await targetClient
      .from('sports')
      .insert({
        name: sportDef?.name || cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1),
        slug: cleanSlug,
        category: 'TEAM',
        icon_name: cleanSlug,
        rules_template: {},
      })
      .select('id, name, slug')
      .single();

    if (!insertErr && insertedSport) {
      return insertedSport;
    }
  } catch {
    // RLS might block if not admin client
  }

  // Final check in case another concurrent process inserted it
  const { data: finalCheck } = await supabase
    .from('sports')
    .select('id, name, slug')
    .ilike('slug', cleanSlug)
    .maybeSingle();

  return finalCheck || null;
}
