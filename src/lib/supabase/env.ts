/**
 * TROUVETOU — Configuration publique Supabase.
 *
 * Supabase expose désormais deux formats de clé cliente :
 *   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`        (JWT, historique)
 *   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, nouveau)
 * Les deux sont publiques et interchangeables. On accepte l'une ou l'autre
 * pour qu'un projet migré vers le nouveau format fonctionne sans renommage.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
}
