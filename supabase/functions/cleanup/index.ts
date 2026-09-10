// Supabase Edge Function: cleanup — dipanggil pg_cron tiap jam (§14/§17).
// Hapus rooms expired (cascade participants + capture_sessions) + file
// sessions/* > 24 jam + final/* > 7 hari. Auth: Bearer CLEANUP_KEY.
// Deploy: supabase functions deploy cleanup
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLEANUP_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLEANUP_KEY = Deno.env.get("CLEANUP_KEY")!;
const db = createClient(URL, SERVICE_KEY);

async function removePrefix(bucket: string, prefix: string, olderThanMs: number) {
  const now = Date.now();
  const { data: files } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!files) return 0;
  const stale = files
    .filter((f) => f.updated_at && now - new Date(f.updated_at).getTime() > olderThanMs)
    .map((f) => `${prefix}/${f.name}`);
  if (stale.length === 0) return 0;
  await db.storage.from(bucket).remove(stale);
  return stale.length;
}

serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${CLEANUP_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  // Tandai expired dulu agar status konsisten sebelum row dihapus.
  await db
    .from("rooms")
    .update({ status: "expired" })
    .lt("expires_at", new Date().toISOString())
    .in("status", ["waiting", "capturing"]);

  const { data: dead } = await db
    .from("rooms")
    .select("id")
    .lt("expires_at", new Date().toISOString());
  let filesRemoved = 0;
  for (const r of dead ?? []) {
    // Hapus file per-shot sesi room ini (best-effort; row tetap dihapus).
    const { data: sessions } = await db
      .from("capture_sessions")
      .select("id")
      .eq("room_id", r.id);
    for (const s of sessions ?? []) {
      const { data: listed } = await db.storage.from("photobooth-temp").list(`sessions/${s.id}`, { limit: 100 });
      for (const dir of listed ?? []) {
        if (!dir.name) continue;
        const { data: shots } = await db.storage
          .from("photobooth-temp")
          .list(`sessions/${s.id}/${dir.name}`, { limit: 10 });
        const paths = (shots ?? []).map((f) => `sessions/${s.id}/${dir.name}/${f.name}`);
        if (paths.length > 0) await db.storage.from("photobooth-temp").remove(paths);
      }
    }
  }
  // Sweep file yatim by mtime walau row sudah hilang (§19).
  filesRemoved += await removePrefix("photobooth-temp", "sessions", 24 * 3600_000);
  filesRemoved += await removePrefix("photobooth-final", "final", 7 * 24 * 3600_000);

  const { count } = await db
    .from("rooms")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());
  return Response.json({ roomsDeleted: count ?? 0, filesRemoved });
});
