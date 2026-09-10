// Browser session identity (FR-02). One UUID per browser, persisted in
// localStorage. Sent as `sessionId` on every room-api call. Not a secret,
// not auth — just a per-browser slot key. New tab/incognito = new slot.
const KEY = "ldr_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const ROOM_CODE_RE = /^[A-Z0-9]{6,8}$/;

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function validateDisplayName(name: string): string {
  const clean = name.trim().slice(0, 30).replace(/<[^>]*>/g, "");
  return clean || "Guest";
}
