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
// Broadcast tidak persisten: offer bisa hilang jika peer belum subscribe.
// Maka host kirim ulang offer berkala sampai connected; guest kirim hello
// agar host tahu kapan offer ulang dibutuhkan. ICE yang datang dini di-buffer.
// STUN public gratis; tanpa TURN di MVP.
// ponytail: tambah TURN (mis. Metered/Twilio) jika gagal >10% di beta.
export function usePeerCall({ myId, peerId, stream, isHost, send, enabled }: Args) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pendingOffer, setPendingOffer] = useState<{ from: string; sdp: string } | null>(null);

  const myIdRef = useRef(myId);
  const peerIdRef = useRef(peerId);
  const streamRef = useRef(stream);
  const isHostRef = useRef(isHost);
  const sendRef = useRef(send);
  const enabledRef = useRef(enabled);
  const statusRef = useRef(status);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    myIdRef.current = myId;
    peerIdRef.current = peerId;
    streamRef.current = stream;
    isHostRef.current = isHost;
    sendRef.current = send;
    enabledRef.current = enabled;
  });
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const closePc = useCallback((silent = false) => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingIceRef.current = [];
    if (!silent) setRemoteStream(null);
  }, []);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const q = pendingIceRef.current.splice(0);
    for (const init of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(init));
      } catch {
        /* kandidat basi — abaikan */
      }
    }
  }, []);

  const makePc = useCallback(() => {
    pcRef.current?.close();
    pendingIceRef.current = [];
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;
    const local = streamRef.current;
    if (local) {
      for (const track of local.getTracks()) pc.addTrack(track, local);
    }
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (e) => {
      for (const t of e.streams[0]?.getTracks() ?? []) {
        if (!remote.getTrackById(t.id)) {
          try {
            remote.addTrack(t);
          } catch {
            /* abaikan */
          }
        }
      }
    };
    pc.onicecandidate = (e) => {
      const id = myIdRef.current;
      if (e.candidate && id) {
        void sendRef.current({
          event: "call_ice",
          from: id,
          candidate: JSON.stringify(e.candidate.toJSON()),
        }).catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      else if (s === "failed") setStatus("failed");
      else if (s === "disconnected" && statusRef.current === "connected") setStatus("calling");
    };
    return pc;
  }, []);

  const sendOffer = useCallback(async () => {
    const id = myIdRef.current;
    const peer = peerIdRef.current;
    const local = streamRef.current;
    if (!id || !peer || !local || !enabledRef.current) return false;
    try {
      const pc = makePc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await sendRef.current({ event: "call_offer", from: id, sdp: JSON.stringify(offer) });
      setStatus("calling");
      return true;
    } catch {
      setStatus("failed");
      return false;
    }
  }, [makePc]);

  // Sinyal masuk dari Broadcast (dipanggil pemilik via onEvent → ref).
  const handleSignal = useCallback(
    (e: RoomBroadcastEvent) => {
      const id = myIdRef.current;
      if (!id || !("from" in e) || e.from === id) return;
      if (e.event === "call_hello") {
        // Pasangan baru siap → host tawarkan ulang segera.
        if (isHostRef.current && enabledRef.current && statusRef.current !== "connected") {
          void sendOffer();
        }
        return;
      }
      if (e.event === "call_offer") {
        if (!isHostRef.current) setPendingOffer({ from: e.from, sdp: e.sdp });
        return;
      }
      if (e.event === "call_answer") {
        if (!isHostRef.current) return;
        const pc = pcRef.current;
        if (!pc) return;
        (async () => {
          try {
            if (!pc.remoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(e.sdp)));
              await flushIce();
            }
          } catch {
            /* jawaban basi — tawarkan ulang via loop */
          }
        })();
        return;
      }
      if (e.event === "call_ice") {
        const pc = pcRef.current;
        let init: RTCIceCandidateInit | null = null;
        try {
          init = JSON.parse(e.candidate);
        } catch {
          return;
        }
        if (!init) return;
        if (pc?.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(init)).catch(() => {});
        } else {
          if (pendingIceRef.current.length < 50) pendingIceRef.current.push(init);
        }
        return;
      }
      if (e.event === "call_bye") {
        closePc();
        setPendingOffer(null);
        setStatus("idle");
      }
    },
    [closePc, flushIce, sendOffer],
  );

  // Umumkan kesiapan + (host) loop offer sampai connected.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi status koneksi eksternal, sah */
  useEffect(() => {
    if (!enabled || !myId || !stream) return;
    // Beri tahu pasangan bahwa kita siap menerima/menjawab.
    sendRef.current({ event: "call_hello", from: myId }).catch(() => {});
    if (!isHost || !peerId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    void sendOffer();
    timer = setInterval(() => {
      if (cancelled || statusRef.current === "connected") {
        if (timer) clearInterval(timer);
        return;
      }
      void sendOffer();
    }, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, myId, peerId, stream, isHost, sendOffer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Guest menjawab offer yang tertunda begitu stream siap.
  useEffect(() => {
    if (!pendingOffer || !stream || !myId || !enabled || isHost) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("calling");
        const pc = makePc();
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(pendingOffer.sdp)));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (cancelled) return;
        await sendRef.current({ event: "call_answer", from: myId, sdp: JSON.stringify(answer) });
        setPendingOffer(null);
      } catch {
        if (!cancelled) {
          // Biarkan pendingOffer agar dicoba lagi saat offer berikutnya tiba.
          setStatus("calling");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingOffer, stream, myId, enabled, isHost, makePc, flushIce]);

  // Tambah track baru (mis. mic menyusul) ke koneksi hidup.
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !stream) return;
    const senders = pc.getSenders();
    let renegotiate = false;
    for (const track of stream.getTracks()) {
      if (!senders.some((s) => s.track?.id === track.id)) {
        try {
          pc.addTrack(track, stream);
          renegotiate = true;
        } catch {
          /* abaikan */
        }
      }
    }
    if (renegotiate && isHost && statusRef.current === "connected" && myId) {
      // Renegosiasi ringan tanpa loop: satu offer tambahan.
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendRef.current({ event: "call_offer", from: myId, sdp: JSON.stringify(offer) });
        } catch {
          /* abaikan */
        }
      })();
    }
  }, [stream, isHost, myId]);

  // Coba lagi dari awal (tombol user). Guest kirim hello agar host offer ulang.
  const retry = useCallback(() => {
    setPendingOffer(null);
    closePc();
    setStatus("calling");
    const id = myIdRef.current;
    if (!id) {
      setStatus("idle");
      return;
    }
    void sendRef.current({ event: "call_hello", from: id }).catch(() => {});
    if (isHostRef.current) void sendOffer();
  }, [closePc, sendOffer]);

  useEffect(() => closePc, [closePc]);

  return { status, remoteStream, retry, handleSignal };
}
