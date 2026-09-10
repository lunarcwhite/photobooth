// Typed fetch wrapper ke Edge Function room-api (kontrak FR-05).
// Semua error server: {error: CODE, message: Indonesia}.
import { getSessionId } from "@/lib/room/session";

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/room-api`;

export class RoomApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit, query = ""): Promise<T> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new RoomApiError("NO_CONFIG", "Konfigurasi server belum diisi. Hubungi penyelenggara beta.");
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}${query}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new RoomApiError("NETWORK", "Tidak bisa menghubungi server. Periksa koneksi internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoomApiError(data.error ?? "UNKNOWN", data.message ?? "Terjadi kesalahan. Coba lagi.");
  return data as T;
}
const sid = () => getSessionId();

export interface ActiveSession {
  sessionDbId: string;
  targetTimes: [number, number, number, number];
}

export const roomApi = {
  create: (displayName: string) =>
    call<{ roomId: string; code: string; expiresAt: string; participantId: string }>("create", {
      method: "POST",
      body: JSON.stringify({ displayName, sessionId: sid() }),
    }),
  join: (code: string, displayName: string) =>
    call<{ roomId: string; participantId: string; members: Member[] }>("join", {
      method: "POST",
      body: JSON.stringify({ code, displayName, sessionId: sid() }),
    }),
  get: (code: string) =>
    call<{
      status: string;
      expiresAt: string;
      members: Member[];
      myRole: string;
      activeSession: ActiveSession | null;
    }>("get", undefined, `?code=${encodeURIComponent(code)}&sessionId=${sid()}`),
  start: (code: string) =>
    call<{ sessionDbId: string; targetTimes: [number, number, number, number] }>("start", {
      method: "POST",
      body: JSON.stringify({ code, sessionId: sid() }),
    }),
  signedUrl: (args: {
    sessionDbId: string;
    sequence: number;
    op: "upload" | "download" | "final-upload" | "final-download";
    participantId?: string;
  }) =>
    call<{ signedUrl: string; path?: string; token?: string; expiresIn: number }>("signed-url", {
      method: "POST",
      body: JSON.stringify({ ...args, sessionId: sid() }),
    }),
  finish: (sessionDbId: string) =>
    call<{ ok: true }>("finish", {
      method: "POST",
      body: JSON.stringify({ sessionDbId, sessionId: sid() }),
    }),
  end: (code: string) =>
    call<{ ok: true }>("end", {
      method: "POST",
      body: JSON.stringify({ code, sessionId: sid() }),
    }),
};

export interface Member {
  id: string;
  displayName: string;
  role: "host" | "guest";
}
