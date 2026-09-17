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

// Batas agar "menghubungkan..." tidak selamanya: resend/offer basi lalu segar.
const RESEND_MS = 4000;
const MAX_RESEND_SAME = 5; // 20 dtk tanpa jawaban → offer baru
const WATCHDOG_MS = 5000;
const CALLING_TIMEOUT_MS = 15000;
const MAX_AUTO_ATTEMPTS = 2; // lalu "failed" agar tombol Coba Lagi muncul

// P2P video+suara via RTCPeerConnection. Signaling lewat Broadcast Supabase.
// Anti-deadlock: jawaban yang hilang di jalan DIPERBAIKI, bukan diabaikan.
// - Guest menyimpan jawaban terakhir; offer duplikat (SDP SAMA) dibalas
//   dengan jawaban tersimpan — host yang tidak pernah menerima jawaban
//   bisa lanjut, bukan stuck "menghubungkan..." selamanya.
// - Offer BARU (SDP beda, host bikin PC baru mis. pindah halaman) selalu
//   dijawab ulang.
// - Host menghitung resend tanpa jawaban: > MAX_RESEND_SAME → handshake
//   segar (PC + offer baru) agar guest yang menunggu offer basi bisa jawab.
// - Buffer ICE dipertahankan saat ganti PC (kandidat dini tidak dibuang).
// - Watchdog: calling terlalu lama → restart otomatis (maks 2x) → failed.
export function usePeerCall({ myId, peerId, stream, isHost, send, enabled }: Args) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pendingOffer, setPendingOffer] = useState<{ from: string; sdp: string; offerId: string } | null>(null);

  const myIdRef = useRef(myId);
  const peerIdRef = useRef(peerId);
  const streamRef = useRef(stream);
  const isHostRef = useRef(isHost);
  const sendRef = useRef(send);
  const enabledRef = useRef(enabled);
  const statusRef = useRef(status);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  // ID unik per handshake: jawaban basi (offerId lama) ditolak agar tidak
  // meracuni PC baru. Perbandingan SDP saja tidak cukup karena dua offer
  // berbeda bisa punya SDP identik.
  const offerIdRef = useRef<string | null>(null);
  const answeredOfferIdRef = useRef<string | null>(null);
  const answeredSdpRef = useRef<string | null>(null);
  const lastAnswerRef = useRef<{ offerId: string; sdp: string } | null>(null);
  const resendCountRef = useRef(0);
  const callingSinceRef = useRef<number | null>(null);
  const autoAttemptsRef = useRef(0);
  const startingRef = useRef(false);
  const lastHelloRef = useRef(0);

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
    if (status === "calling" && callingSinceRef.current === null) {
      callingSinceRef.current = Date.now();
    } else if (status !== "calling") {
      callingSinceRef.current = null;
    }
  }, [status]);

  const closePc = useCallback((keepRemote = false) => {
    dbg("closePc");
    pcRef.current?.close();
    pcRef.current = null;
    // ICE buffer DIPERTAHANKAN (kandidat dini berguna untuk PC pengganti;
    // yang basi gagal diam-diam saat flush).
    offerIdRef.current = null;
    answeredOfferIdRef.current = null;
    answeredSdpRef.current = null;
    lastAnswerRef.current = null;
    resendCountRef.current = 0;
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

let dynamicIceServers: RTCIceServer[] | null = null;
let dynamicIceFetched = false;

// Pre-fetch dynamic ICE servers jika endpoint API disediakan (mis. Metered.ca)
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_TURN_API_URL && !dynamicIceFetched) {
  dynamicIceFetched = true;
  fetch(process.env.NEXT_PUBLIC_TURN_API_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((servers) => {
      if (Array.isArray(servers) && servers.length > 0) {
        dynamicIceServers = servers;
        dbg("dynamic TURN servers loaded from API", servers.length);
      }
    })
    .catch(() => {
      /* fallback ke static credentials */
    });
}

function getIceServers(): RTCIceServer[] {
  if (dynamicIceServers && dynamicIceServers.length > 0) {
    return dynamicIceServers;
  }

  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  // Konfigurasi TURN relay opsional (untuk jaringan seluler / symmetric NAT)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl) {
    const urls = turnUrl.split(",").map((u) => u.trim());
    servers.push({
      urls,
      username: username || undefined,
      credential: credential || undefined,
    });
  }

  return servers;
}

  const makePc = useCallback(() => {
    dbg("makePc host=", isHostRef.current);
    pcRef.current?.close();
    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
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

  const sendOffer = useCallback(async (pc: RTCPeerConnection) => {
    const id = myIdRef.current;
    if (!id) return;
    const desc = pc.localDescription;
    if (!desc) return;
    dbg("offer sent", offerIdRef.current);
    await sendRef.current({ event: "call_offer", from: id, sdp: JSON.stringify(desc), offerId: offerIdRef.current ?? undefined });
  }, []);

  // Host: buat offer. Guard ganda agar hello beruntun tidak bikin PC ganda.
  const startHost = useCallback(async () => {
    if (startingRef.current) return;
    const id = myIdRef.current;
    const peer = peerIdRef.current;
    const local = streamRef.current;
    if (!id || !peer || !local || !enabledRef.current) {
      dbg("startHost skip", { id: !!id, peer: !!peer, local: !!local });
      return;
    }
    startingRef.current = true;
    try {
      setStatus("calling");
      offerIdRef.current = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const pc = makePc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      resendCountRef.current = 0;
      await sendOffer(pc);
    } catch (e) {
      dbg("offer fail", e);
      setStatus("failed");
    } finally {
      startingRef.current = false;
    }
  }, [makePc, sendOffer]);

  // Kirim ulang SDP SAMA; bila tak kunjung dijawab → handshake segar.
  const resendOffer = useCallback(() => {
    const pc = pcRef.current;
    const desc = pc?.localDescription;
    if (!pc || !desc) {
      void startHost();
      return;
    }
    resendCountRef.current += 1;
    if (resendCountRef.current > MAX_RESEND_SAME) {
      dbg("offer basi, handshake segar");
      void startHost();
      return;
    }
    dbg("resend same offer", resendCountRef.current);
    void sendOffer(pc).catch(() => {});
  }, [startHost, sendOffer]);

  const sayHello = useCallback(() => {
    const id = myIdRef.current;
    if (!id) return;
    // Debounce 2 dtk agar restart beruntun tidak storm.
    const now = Date.now();
    if (now - lastHelloRef.current < 2000) return;
    lastHelloRef.current = now;
    void sendRef.current({ event: "call_hello", from: id }).catch(() => {});
  }, []);

  const handleSignal = useCallback(
    (e: RoomBroadcastEvent) => {
      const id = myIdRef.current;
      if (!id || !("from" in e) || e.from === id) return;
      dbg("signal", e.event, "from", e.from.slice(0, 8));
      if (e.event === "call_hello") {
        if (isHostRef.current && enabledRef.current && statusRef.current !== "connected") {
          if (pcRef.current?.localDescription) resendOffer();
          else void startHost();
        }
        return;
      }
      if (e.event === "call_offer") {
        if (isHostRef.current) return;
        const offerId = e.offerId ?? e.sdp;
        if (statusRef.current === "connected" && offerId === answeredOfferIdRef.current) {
          dbg("offer duplikat saat connected, abaikan");
          return;
        }
        if (offerId === answeredOfferIdRef.current && lastAnswerRef.current) {
          // Offer duplikat = jawaban kami kemungkinan hilang di jalan.
          // Kirim ulang jawaban tersimpan (tanpa PC baru).
          dbg("offer duplikat, kirim ulang jawaban tersimpan");
          const my = myIdRef.current;
          if (my) {
            void sendRef
              .current({ event: "call_answer", from: my, sdp: lastAnswerRef.current.sdp, offerId: lastAnswerRef.current.offerId })
              .catch(() => {});
          }
          return;
        }
        // Offer baru (atau belum pernah dijawab) → jawab segar.
        setPendingOffer({ from: e.from, sdp: e.sdp, offerId });
        return;
      }
      if (e.event === "call_answer") {
        if (!isHostRef.current) return;
        const answerOfferId = e.offerId ?? null;
        if (answerOfferId && offerIdRef.current && answerOfferId !== offerIdRef.current) {
          // Jawaban untuk handshake lama (PC sudah diganti) → tolak agar
          // tidak meracuni PC baru.
          dbg("jawaban basi ditolak", answerOfferId, offerIdRef.current);
          return;
        }
        const pc = pcRef.current;
        if (!pc) {
          // Jawaban datang tapi PC sudah tidak ada (mis. remount) →
          // handshake segar agar guest menjawab SDP baru.
          dbg("answer tanpa pc, handshake segar");
          void startHost();
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

  // Host mulai saat siap; loop kirim ulang SDP SAMA tiap 4 dtk
  // (resendOffer menyegarkan sendiri bila basi).
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi status koneksi eksternal, sah */
  useEffect(() => {
    if (!enabled || !myId || !stream) return;
    sayHello();
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
    }, RESEND_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, myId, peerId, stream, isHost, startHost, resendOffer, sayHello]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Guest menjawab offer tertunda; jawaban disimpan untuk resend.
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
        const sdp = JSON.stringify(answer);
        await sendRef.current({ event: "call_answer", from: myId, sdp, offerId: pendingOffer.offerId });
        dbg("answer sent", pendingOffer.offerId);
        answeredOfferIdRef.current = pendingOffer.offerId;
        answeredSdpRef.current = pendingOffer.sdp;
        lastAnswerRef.current = { offerId: pendingOffer.offerId, sdp };
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

  // Watchdog: calling terlalu lama → restart otomatis (maks 2x),
  // lalu "failed" agar tombol Coba Lagi muncul (tidak spinner selamanya).
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (statusRef.current !== "calling") return;
      if (!enabledRef.current || !streamRef.current || !myIdRef.current) return;
      const since = callingSinceRef.current;
      if (since === null || Date.now() - since < CALLING_TIMEOUT_MS) return;
      if (autoAttemptsRef.current >= MAX_AUTO_ATTEMPTS) {
        dbg("watchdog menyerah → failed");
        setStatus("failed");
        return;
      }
      autoAttemptsRef.current += 1;
      dbg("watchdog restart", autoAttemptsRef.current);
      callingSinceRef.current = Date.now();
      closePc(true);
      setPendingOffer(null);
      setStatus("calling");
      sayHello();
      if (isHostRef.current) void startHost();
      // Guest: refs jawaban direset oleh closePc → offer berikutnya
      // (bahkan SDP sama) dijawab segar.
    }, WATCHDOG_MS);
    return () => clearInterval(id);
  }, [enabled, closePc, sayHello, startHost]);

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
    autoAttemptsRef.current = 0;
    callingSinceRef.current = Date.now();
    setStatus("calling");
    const id = myIdRef.current;
    if (!id) {
      setStatus("idle");
      return;
    }
    sayHello();
    if (isHostRef.current) void startHost();
  }, [closePc, sayHello, startHost]);

  useEffect(() => closePc, [closePc]);

  return { status, remoteStream, retry, handleSignal };
}
