"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RoomBroadcastEvent } from "@/types/realtime";

export interface PresencePeer {
  participantId: string;
  displayName: string;
  cameraReady: boolean;
}

interface Me {
  participantId: string;
  displayName: string;
  cameraReady: boolean;
}

// Single channel per room: Broadcast (event "room") + Presence.
// Channel key uses the public room CODE — both clients derive it without a lookup.
// ponytail: PRD names it room:<room-id>; code is unique and equivalent. Switch if codes become reusable.
export function useRoomChannel(code: string, me: Me | null, onEvent: (e: RoomBroadcastEvent) => void) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [connected, setConnected] = useState<string>(() =>
    isSupabaseConfigured() ? "menghubungkan..." : "konfigurasi Supabase belum diisi",
  );
  const chRef = useRef<RealtimeChannel | null>(null);
  const cbRef = useRef(onEvent);
  const meRef = useRef(me);

  // Keep latest callback/identity without touching refs during render.
  useEffect(() => {
    cbRef.current = onEvent;
  });
  useEffect(() => {
    meRef.current = me;
  });

  useEffect(() => {
    if (!me) return;
    if (!isSupabaseConfigured()) return;
    const key = me.participantId;
    const ch = supabase.channel(`room:${code}`, { config: { presence: { key } } });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PresencePeer>();
      const list: PresencePeer[] = [];
      for (const arr of Object.values(state)) for (const p of arr) list.push(p as PresencePeer);
      setPeers(list);
    });
    ch.on("broadcast", { event: "room" }, ({ payload }) => {
      cbRef.current(payload as RoomBroadcastEvent);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected("terhubung");
        const m = meRef.current!;
        await ch.track({ participantId: m.participantId, displayName: m.displayName, cameraReady: m.cameraReady });
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setConnected("terputus, mencoba lagi...");
      } else {
        setConnected("menghubungkan...");
      }
    });
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, me?.participantId]);

  // Keep presence flag in sync when camera becomes ready (no re-subscribe).
  useEffect(() => {
    const ch = chRef.current;
    if (!ch || !me) return;
    ch.track({ participantId: me.participantId, displayName: me.displayName, cameraReady: me.cameraReady }).catch(() => {});
  }, [me?.cameraReady, me?.displayName, me?.participantId, me]);

  const send = useCallback(async (event: RoomBroadcastEvent) => {
    const ch = chRef.current;
    if (!ch) return;
    await ch.send({ type: "broadcast", event: "room", payload: event });
  }, []);

  return { peers, connected, send };
}
