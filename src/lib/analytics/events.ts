import { supabase } from "@/lib/supabase/client";
import type { AnalyticsEvent } from "@/types/realtime";

// Fire-and-forget beta analytics (§30). Insert failures never block UX.
export function track(event: AnalyticsEvent, roomId?: string | null, meta: Record<string, unknown> = {}) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    supabase
      .from("analytics_events")
      .insert({ room_id: roomId ?? null, event, meta })
      .then(() => {}, () => {});
  } catch {
    /* ignore */
  }
}
