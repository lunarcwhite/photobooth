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

const dbg = (...a: unknown[]) => {
  try {
    if (typeof window !== "undefined" && window.location.search.includes("debug=call")) {
      console.debug("[call]", ...a);
    }
  } catch {
    /* abaikan */
  }
};

// P2P video+suara via RTCPeerConnection. Signaling lewat Broadcast Supabase.
// Aturan Luther: SATU PC per upaya. Host membuat offer sekali, lalu kirim
// ulang SDP YANG SAMA tiap 4 detik sampai connected — tidak pernah bikin
// ulang PC saat loop (itu yang membuat jawaban guest basi).
// Guest menjawab sekali, abaikan offer duplikat selama calling/connected.
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
  const answeredRef = useRef(false);

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

  const closePc = useCallback((keepRemote = false) => {
    dbg("closePc");
    pcRef.current?.close();
    pcRef.current = null;
    pendingIceRef.current = [];
    answeredRef.current = false;
    if (!keepRemote) setRemoteStream(null);
  }, []);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const q = pendingIceRef.current.splice(0);
    dbg("flushIce", q.length);
    for (const init of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(init));
      } catch {
        /* kandidat basi */
      }
    }
  }, []);

  const makePc = useCallback(() => {
    dbg("makePc host=", isHostRef.current);
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
      dbg("ontrack", e.streams[0]?.getTracks().map((t) => t.kind).join(","));
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
      dbg("pcState", s);
      if (s === "connected") setStatus("connected");
      else if (s === "failed") setStatus("failed");
      else if (s === "disconnected" && statusRef.current === "connected") setStatus("calling");
    };
    return pc;
  }, []);

  // Host: buat offer SEKALI, kirim ulang SDP sama sampai connected.
  const startHost = useCallback(async () => {
    const id = myIdRef.current;
    const peer = peerIdRef.current;
    const local = streamRef.current;
    if (!id || !peer || !local || !enabledRef.current) {
      dbg("startHost skip", { id: !!id, peer: !!peer, local: !!local });
      return;
    }
    try {
      setStatus("calling");
      const pc = makePc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      dbg("offer sent");
      await sendRef.current({ event: "call_offer", from: id, sdp: JSON.stringify(offer) });
    } catch (e) {
      dbg("offer fail", e);
      setStatus("failed");
    }
  }, [makePc]);

  const resendOffer = useCallback(() => {
    const pc = pcRef.current;
    const id = myIdRef.current;
    const desc = pc?.localDescription;
    if (!pc || !desc || !id) return;
    dbg("resend same offer");
    void sendRef.current({ event: "call_offer", from: id, sdp: JSON.stringify(desc) }).catch(() => {});
  }, []);

  const handleSignal = useCallback(
    (e: RoomBroadcastEvent) => {
      const id = myIdRef.current;
      if (!id || !("from" in e) || e.from === id) return;
      dbg("signal", e.event, "from", e.from.slice(0, 8));
      if (e.event === "call_hello") {
        if (isHostRef.current && enabledRef.current && statusRef.current !== "connected") {
          // Tamu siap tapi belum ada offer terkirim → mulai; kalau sudah
          // calling → kirim ulang SDP yang sama, jangan bikin PC baru.
          if (pcRef.current?.localDescription) resendOffer();
          else void startHost();
        }
        return;
      }
      if (e.event === "call_offer") {
        if (isHostRef.current) return;
        // Abaikan duplikat selama sudah menjawab / sudah connect.
        if (statusRef.current === "connected" || answeredRef.current) {
          dbg("offer ignored (already answered/connected)");
          return;
        }
        setPendingOffer({ from: e.from, sdp: e.sdp });
        return;
      }
      if (e.event === "call_answer") {
        if (!isHostRef.current) return;
        const pc = pcRef.current;
        if (!pc) {
          dbg("answer ignored (no pc)");
          return;
        }
        (async () => {
          try {
            if (!pc.remoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(e.sdp)));
              dbg("answer applied");
              await flushIce();
            } else {
              dbg("answer ignored (already have remote)");
            }
          } catch (err) {
            dbg("answer apply fail", err);
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
    [closePc, flushIce, resendOffer, startHost],
  );

  // Host mulai saat siap; loop kirim ulang SDP SAMA tiap 4 dtk.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi status koneksi eksternal, sah */
  useEffect(() => {
    if (!enabled || !myId || !stream) return;
    sendRef.current({ event: "call_hello", from: myId }).catch(() => {});
    if (!isHost || !peerId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    void startHost();
    timer = setInterval(() => {
      if (cancelled || statusRef.current === "connected") {
        if (timer) clearInterval(timer);
        return;
      }
      resendOffer();
    }, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, myId, peerId, stream, isHost, startHost, resendOffer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Guest menjawab offer tertunda sekali.
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
        dbg("answer sent");
        answeredRef.current = true;
        setPendingOffer(null);
      } catch (err) {
        dbg("answer fail", err);
        if (!cancelled) setStatus("calling"); // tunggu offer berikutnya
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingOffer, stream, myId, enabled, isHost, makePc, flushIce]);

  // Tambah track baru ke koneksi hidup (tanpa renegosiasi agresif).
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !stream) return;
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      if (!senders.some((s) => s.track?.id === track.id)) {
        try {
          pc.addTrack(track, stream);
        } catch {
          /* abaikan */
        }
      }
    }
  }, [stream]);

  const retry = useCallback(() => {
    dbg("retry");
    setPendingOffer(null);
    closePc();
    setStatus("calling");
    const id = myIdRef.current;
    if (!id) {
      setStatus("idle");
      return;
    }
    void sendRef.current({ event: "call_hello", from: id }).catch(() => {});
    if (isHostRef.current) void startHost();
  }, [closePc, startHost]);

  useEffect(() => closePc, [closePc]);

  return { status, remoteStream, retry, handleSignal };
}
