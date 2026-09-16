import { supabase } from "@/lib/supabase/client";
import { roomApi } from "@/lib/room/api";

// Photo exchange over private Storage via signed URLs (§14).
// Uploads that outlive the 7s shot gap continue in background; the schedule never waits.

export async function uploadShot(sessionDbId: string, sequence: number, blob: Blob): Promise<string> {
  const s = await roomApi.signedUrl({ sessionDbId, sequence, op: "upload" });
  if (!s.path || !s.token) throw new Error("URL upload tidak valid");
  const { error } = await supabase.storage
    .from("photobooth-temp")
    .uploadToSignedUrl(s.path, s.token, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return s.path; // → broadcast as capture_ack.storagePath
}

export async function downloadShot(sessionDbId: string, sequence: number, participantId: string): Promise<Blob> {
  const s = await roomApi.signedUrl({ sessionDbId, sequence, op: "download", participantId });
  const res = await fetch(s.signedUrl);
  if (!res.ok) throw new Error("Unduhan foto teman gagal");
  return await res.blob();
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("gagal membaca foto"));
    r.readAsDataURL(blob);
  });
}
