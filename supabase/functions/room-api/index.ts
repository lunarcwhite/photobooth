// Supabase Edge Function: room-api — satu-satunya penulis DB (§FR-05).
// Deploy: supabase functions deploy room-api
// Routes (suffix after /functions/v1/room-api/):
//   POST create | POST join | GET get | POST start | POST signed-url | POST finish | POST end

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SB_URL, SERVICE_KEY);

const MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: "Room tidak ditemukan. Periksa kode.",
  ROOM_EXPIRED: "Room sudah kedaluwarsa.",
  ROOM_FULL: "Room sudah penuh.",
  NOT_HOST: "Hanya host yang bisa melakukan ini.",
  NOT_MEMBER: "Kamu bukan anggota room ini.",
  SESSION_UNKNOWN: "Sesi tidak dikenal. Gabung ulang.",
  SESSION_ACTIVE: "Sesi sudah berjalan.",
  INVALID_NAME: "Nama 1–30 karakter.",
  BAD_PATH: "Path file tidak valid.",
  RATE_LIMITED: "Terlalu sering. Coba lagi nanti.",
};

const err = (code: string, status = 400) =>
  json({ error: code, message: MESSAGES[code] ?? code }, status);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9]{6,8}$/;

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 30).replace(/<[^>]*>/g, "");
  return s.length >= 1 ? s : null;
}

// Rate limit in-memory per instance (§18.3, over-limit antar-instance OK untuk beta).
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}
const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I,O,0,1
async function freshCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    let c = "";
    for (let j = 0; j < 6; j++) {
      c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const { data } = await db.from("rooms").select("id").eq("code", c).maybeSingle();
    if (!data) return c;
  }
  throw new Error("code collision");
}

async function getRoom(code: string) {
  const { data } = await db.from("rooms").select("*").eq("code", code).maybeSingle();
  return data;
}
const isExpired = (room: { expires_at: string; status: string }) =>
  room.status === "expired" || new Date(room.expires_at).getTime() < Date.now();

async function membersOf(roomId: string) {
  const { data } = await db
    .from("participants")
    .select("id,display_name,role")
    .eq("room_id", roomId);
  return (data ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name,
    role: m.role,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }
  const path = new URL(req.url).pathname.replace(/^.*\/room-api\/?/, "");
  const ip = ipOf(req);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  // POST /create {displayName, sessionId}
  if (path === "create" && req.method === "POST") {
    if (limited(`create:${ip}`, 10, 3600_000)) return err("RATE_LIMITED", 429);
    const name = cleanName(body.displayName);
    const sid = body.sessionId;
    if (!name) return err("INVALID_NAME", 400);
    if (typeof sid !== "string" || !UUID_RE.test(sid)) return err("SESSION_UNKNOWN", 400);
    const code = await freshCode();
    const { data: room, error: e1 } = await db
      .from("rooms")
      .insert({ code, host_session_id: sid, status: "waiting" })
      .select("id,expires_at")
      .single();
    if (e1 || !room) return err("RATE_LIMITED", 429);
    const { data: p } = await db
      .from("participants")
      .insert({ room_id: room.id, session_id: sid, display_name: name, role: "host" })
      .select("id")
      .single();
    return json({ roomId: room.id, code, expiresAt: room.expires_at, participantId: p?.id });
  }

  // POST /join {code, displayName, sessionId}
  if (path === "join" && req.method === "POST") {
    if (limited(`join:${ip}`, 30, 3600_000)) return err("RATE_LIMITED", 429);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = cleanName(body.displayName);
    const sid = body.sessionId;
    if (!CODE_RE.test(code)) return err("ROOM_NOT_FOUND", 404);
    if (!name) return err("INVALID_NAME", 400);
    if (typeof sid !== "string" || !UUID_RE.test(sid)) return err("SESSION_UNKNOWN", 400);
    const room = await getRoom(code);
    if (!room) return err("ROOM_NOT_FOUND", 404);
    if (isExpired(room) || room.status === "completed") return err("ROOM_EXPIRED", 410);
    const { data: existing } = await db
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("session_id", sid)
      .maybeSingle();
    if (existing) {
      await db.from("participants").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
      return json({ roomId: room.id, participantId: existing.id, members: await membersOf(room.id) });
    }
    const { count } = await db
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= 2) return err("ROOM_FULL", 403);
    const { data: p, error } = await db
      .from("participants")
      .insert({ room_id: room.id, session_id: sid, display_name: name, role: "guest" })
      .select("id")
      .single();
    if (error || !p) return err("ROOM_FULL", 403); // race: slot direbut duluan
    return json({ roomId: room.id, participantId: p.id, members: await membersOf(room.id) });
  }

  // GET /get?code=&sessionId=
  if (path === "get" && req.method === "GET") {
    const u = new URL(req.url);
    const code = (u.searchParams.get("code") ?? "").trim().toUpperCase();
    const sid = u.searchParams.get("sessionId") ?? "";
    if (!CODE_RE.test(code)) return err("ROOM_NOT_FOUND", 404);
    const room = await getRoom(code);
    if (!room) return err("ROOM_NOT_FOUND", 404);
    const { data: me } = await db
      .from("participants")
      .select("id,role")
      .eq("room_id", room.id)
      .eq("session_id", sid)
      .maybeSingle();
    if (!me) return err("SESSION_UNKNOWN", 404);
    await db.from("participants").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id);
    // Sertakan sesi aktif agar klien yang refresh mid-session bisa rejoin jadwal.
    const { data: cs } = await db
      .from("capture_sessions")
      .select("id,target_times")
      .eq("room_id", room.id)
      .neq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const activeSession =
      cs && Array.isArray(cs.target_times) && cs.target_times.length === 4
        ? { sessionDbId: cs.id, targetTimes: cs.target_times }
        : null;
    return json({
      status: isExpired(room) ? "expired" : room.status,
      expiresAt: room.expires_at,
      members: await membersOf(room.id),
      myRole: me.role,
      activeSession,
    });
  }

  // POST /start {code, sessionId} — host only, hitung targetTimes dari jam server
  if (path === "start" && req.method === "POST") {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const sid = body.sessionId;
    if (!CODE_RE.test(code)) return err("ROOM_NOT_FOUND", 404);
    const room = await getRoom(code);
    if (!room) return err("ROOM_NOT_FOUND", 404);
    if (isExpired(room)) return err("ROOM_EXPIRED", 410);
    const { data: me } = await db
      .from("participants")
      .select("id,role")
      .eq("room_id", room.id)
      .eq("session_id", sid)
      .maybeSingle();
    if (!me) return err("NOT_MEMBER", 403);
    if (room.host_session_id !== sid || me.role !== "host") return err("NOT_HOST", 403);
    const { data: active } = await db
      .from("capture_sessions")
      .select("id")
      .eq("room_id", room.id)
      .neq("status", "completed")
      .limit(1);
    if (active && active.length > 0) return err("SESSION_ACTIVE", 409);
    const t0 = Date.now() + 3000;
    const targetTimes = [t0, t0 + 7000, t0 + 14000, t0 + 21000];
    const { data: cs } = await db
      .from("capture_sessions")
      .insert({
        room_id: room.id,
        status: "countdown",
        total_shots: 4,
        current_shot: 0,
        target_times: targetTimes,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    await db.from("rooms").update({ status: "capturing" }).eq("id", room.id);
    return json({ sessionDbId: cs?.id, targetTimes });
  }

  // POST /signed-url {sessionDbId, sessionId, sequence, op, participantId?}
  // op: upload | download (per-shot, sequence 1-4) | final-upload | final-download
  if (path === "signed-url" && req.method === "POST") {
    const { sessionDbId, sessionId: sid, sequence, op, participantId } = body;
    if (typeof sessionDbId !== "string" || !UUID_RE.test(sessionDbId)) return err("BAD_PATH", 400);
    if (typeof sid !== "string" || !UUID_RE.test(sid)) return err("NOT_MEMBER", 403);
    if (op !== "upload" && op !== "download" && op !== "final-upload" && op !== "final-download") {
      return err("BAD_PATH", 400);
    }
    const needSequence = op === "upload" || op === "download";
    if (needSequence && (typeof sequence !== "number" || sequence < 1 || sequence > 4)) {
      return err("BAD_PATH", 400);
    }
    if (limited(`su:${sessionDbId}:${sid}`, 32, 3600_000)) return err("RATE_LIMITED", 429);
    const { data: cs } = await db
      .from("capture_sessions")
      .select("id,room_id")
      .eq("id", sessionDbId)
      .maybeSingle();
    if (!cs) return err("BAD_PATH", 400);
    const { data: me } = await db
      .from("participants")
      .select("id")
      .eq("room_id", cs.room_id)
      .eq("session_id", sid)
      .maybeSingle();
    if (!me) return err("NOT_MEMBER", 403);
    // Path selalu dibangun server; klien tidak kirim path (§14).
    let bucket = "photobooth-temp";
    let filePath: string;
    if (op === "final-upload" || op === "final-download") {
      bucket = "photobooth-final";
      filePath = `final/${sessionDbId}/${me.id}.jpg`;
    } else if (op === "upload") {
      filePath = `sessions/${sessionDbId}/${me.id}/${sequence}.jpg`;
    } else {
      if (typeof participantId !== "string" || !UUID_RE.test(participantId)) return err("BAD_PATH", 400);
      const { data: owner } = await db
        .from("participants")
        .select("id")
        .eq("id", participantId)
        .eq("room_id", cs.room_id)
        .maybeSingle();
      if (!owner) return err("BAD_PATH", 400);
      filePath = `sessions/${sessionDbId}/${participantId}/${sequence}.jpg`;
    }
    if (op === "upload" || op === "final-upload") {
      const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(filePath);
      if (error || !data) return err("BAD_PATH", 400);
      return json({ signedUrl: data.signedUrl, path: data.path, token: data.token, expiresIn: 3600 });
    }
    const { data, error } = await db.storage.from(bucket).createSignedUrl(filePath, 3600);
    if (error || !data) return err("BAD_PATH", 400);
    return json({ signedUrl: data.signedUrl, expiresIn: 3600 });
  }

  // POST /finish {sessionDbId, sessionId}
  if (path === "finish" && req.method === "POST") {
    const { sessionDbId, sessionId: sid } = body;
    if (typeof sessionDbId !== "string" || !UUID_RE.test(sessionDbId)) return err("BAD_PATH", 400);
    const { data: cs } = await db
      .from("capture_sessions")
      .select("id,room_id")
      .eq("id", sessionDbId)
      .maybeSingle();
    if (!cs) return err("BAD_PATH", 400);
    const { data: me } = await db
      .from("participants")
      .select("id")
      .eq("room_id", cs.room_id)
      .eq("session_id", sid)
      .maybeSingle();
    if (!me) return err("NOT_MEMBER", 403);
    await db
      .from("capture_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionDbId);
    // Booth kembali waiting agar bisa ambil ulang tanpa buat room baru.
    await db.from("rooms").update({ status: "waiting" }).eq("id", cs.room_id);
    return json({ ok: true });
  }

  // POST /end {code, sessionId} — host only
  if (path === "end" && req.method === "POST") {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const sid = body.sessionId;
    const room = await getRoom(code);
    if (!room) return err("ROOM_NOT_FOUND", 404);
    if (room.host_session_id !== sid) return err("NOT_HOST", 403);
    await db.from("rooms").update({ status: "completed" }).eq("id", room.id);
    return json({ ok: true });
  }

  return err("BAD_PATH", 404);
});
