"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomBroadcastEvent } from "@/types/realtime";

export type CallStatus = "idle" | "calling" | "connected" | "failed";

interface Args {
  myId: string | null;
  peerId: string | null;
  stream: MediaStream | null;
  isHost: boolean;
  send: (e: RoomBroadcastEvent) => Promise<void>;
  enabled: boolean;
}

// P2P video+suara via RTCPeerConnection. Signaling lewat Broadcast Supabase.
// Host = offerer, guest = answerer. STUN public gratis; tanpa TURN di MVP —
// sebagian jaringan simetris NAT bisa gagal (lihat status "gagal").
// ponytail: tambah TURN (mis. Metered/Twilio) jika gagal >10% di beta.
export function usePeerCall({ myId, peerId, stream, isHost, send, enabled }: Args) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sendRef = useRef(send);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Selalu pakai pengirim terbaru tanpa restart koneksi.
  useEffect(() => {
    sendRef.current = send;
  });

  const closePc = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
  }, []);

  const makePc = useCallback(() => {
    closePc();
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (e) => {
      for (const t of e.streams[0]?.getTracks() ?? []) {
        if (!remote.getTrackById(t.id)) remote.addTrack(t);
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && myId) {
        void sendRef.current({
          event: "call_ice",
          from: myId,
          candidate: JSON.stringify(e.candidate),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      else if (s === "failed") setStatus("failed");
      else if (s === "disconnected") setStatus("calling");
    };
    return pc;
  }, [closePc, stream, myId]);

  // Simpan sinyal mentah untuk diproses effect di bawah.
  const [inbox, setInbox] = useState<RoomBroadcastEvent | null>(null);
  const handleSignal = useCallback((e: RoomBroadcastEvent) => {
    if (e.event === "call_offer" || e.event === "call_answer" || e.event === "call_ice" || e.event === "call_bye") {
      setInbox(e);
    }
  }, []);

  // Mulai / ulang panggilan saat kedua stream + id siap.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi status koneksi eksternal, sah */
  useEffect(() => {
    if (!enabled || !myId || !peerId || !stream) return;
    if (!isHost) return; // guest menunggu offer
    let cancelled = false;
    setStatus("calling");
    (async () => {
      try {
        const pc = makePc();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (cancelled || !myId) return;
        await sendRef.current({ event: "call_offer", from: myId, sdp: JSON.stringify(offer) });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, myId, peerId, stream, isHost, makePc]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Proses pesan signaling masuk.
  useEffect(() => {
    if (!inbox || !myId || !stream) return;
    if ("from" in inbox && inbox.from === myId) return; // pesan sendiri
    (async () => {
      try {
        if (inbox.event === "call_offer" && !isHost) {
          const pc = makePc();
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(inbox.sdp)));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          setStatus("calling");
          await sendRef.current({ event: "call_answer", from: myId, sdp: JSON.stringify(answer) });
        } else if (inbox.event === "call_answer" && isHost) {
          const pc = pcRef.current;
          if (pc && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(inbox.sdp)));
          }
        } else if (inbox.event === "call_ice") {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(inbox.candidate))).catch(() => {});
          }
        } else if (inbox.event === "call_bye") {
          closePc();
          setStatus("idle");
        }
      } catch {
        setStatus("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  // Tambah track baru (mis. mic menyusul) ke koneksi hidup.
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !stream) return;
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      if (!senders.some((s) => s.track?.id === track.id && s.track?.kind === track.kind)) {
        pc.addTrack(track, stream);
      }
    }
  }, [stream]);

  // Coba lagi dari awal (tombol user).
  const retry = useCallback(() => {
    setInbox(null);
    closePc();
    setStatus("idle");
    if (!myId || !peerId || !stream || !isHost) return;
    setStatus("calling");
    (async () => {
      try {
        const pc = makePc();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendRef.current({ event: "call_offer", from: myId, sdp: JSON.stringify(offer) });
      } catch {
        setStatus("failed");
      }
    })();
  }, [myId, peerId, stream, isHost, makePc, closePc]);

  useEffect(() => closePc, [closePc]);

  return { status, remoteStream, retry, handleSignal };
}
