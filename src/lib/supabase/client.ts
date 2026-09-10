import { createClient } from "@supabase/supabase-js";

// Browser anon client. RLS denies direct table reads; all room state
// goes through room-api Edge Function + Realtime Broadcast/Presence.
// Single direct-DB exceptions: analytics_events insert + server_time_ms rpc.
//
// Placeholder fallback keeps prerender/build working when env is missing;
// real calls fail gracefully and UI shows Indonesian config errors.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(url, key);

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
