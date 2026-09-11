"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/room/session";
import { loadRoomBundle, loadCaptureBundle, saveShotsBundle, type RoomBundle, type CaptureBundle } from "@/lib/room/bundle";
import { useCamera } from "@/hooks/useCamera";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { usePeerCall } from "@/hooks/usePeerCall";
import { uploadShot, blobToDataURL } from "@/lib/storage/exchange";
import { track } from "@/lib/analytics/events";
import type { RoomBroadcastEvent } from "@/types/realtime";
import { Btn, GhostBtn, ErrorMsg } from "@/components/ui";
import { CameraView } from "@/components/CameraView";
import { RemoteView } from "@/components/RemoteView";
import { getServerOffset, correctedNow } from "@/lib/realtime/clock";
import { supabase } from "@/lib/supabase/client";
import { roomApi } from "@/lib/room/api";

// Capture manual: host menekan tombol per foto → broadcast shot_armed
// dengan targetAt = correctedNow + 5000ms → kedua HP countdown 5→1 →
// jepret bareng. Guest hanya menunggu. Upload/ACK/result sama seperti dulu.
const COUNTDOWN_MS = 5000;

interface ShotState {
  armedAt: number | null; // targetAt dari shot_armed
  done: boolean;
  uploading: boolean;
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [capture, setCapture] = useState<CaptureBundle | null>(null);
  const [mounted, setMounted] = useState(false);

  const cam = useCamera();
  const cameraReady = cam.status === "ready";
  const [offset, setOffset] = useState(0);
  // Init 0 agar render server = client; jam nyata diisi effect setelah mount.
  const [now, setNow] = useState(0);
  const [shots, setShots] = useState<ShotState[]>([
    { armedAt: null, done: false, uploading: false },
    { armedAt: null, done: false, uploading: false },
    { armedAt: null, done: false, uploading: false },
    { armedAt: null, done: false, uploading: false },
  ]);
  const [myShots, setMyShots] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerPaths, setPartnerPaths] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [arming, setArming] = useState(false);
  const [partnerName, setPartnerName] = useState("Pasangan");
  const [callPeerId, setCallPeerId] = useState<string | null>(null);
  const callSignalRef = useRef<(e: RoomBroadcastEvent) => void>(() => {});
  const bgQueue = useRef<{ seq: number; blob: Blob; tries: number }[]>([]);
  const firedRef = useRef<boolean[]>([false, false, false, false]);

  const me = useMemo(
    () =>
      bundle
        ? { participantId: bundle.participantId, displayName: bundle.displayName, cameraReady }
        : null,
    [bundle, cameraReady],
  );

  const sessionDbId = capture?.sessionDbId ?? null;
  const isHost = bundle?.role === "host";

  // Plain function: baca state terbaru saat session_finished tiba / user selesai.
  function finishLocal() {
    if (!bundle || !capture) return;
    const date = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    saveShotsBundle(code, {
      code,
      sessionDbId: capture.sessionDbId,
      date,
      myRole: bundle.role,
      myName: bundle.displayName,
      partnerName,
      myShots,
      partnerShots: [null, null, null, null],
      partnerId,
      partnerPaths,
      roomId: bundle.roomId,
    });
    router.push(`/room/${code}/result`);
  }

  function onEvent(e: RoomBroadcastEvent) {
    if (e.event === "shot_armed" && e.sequence >= 1 && e.sequence <= 4) {
      setShots((prev) => {
        if (prev[e.sequence - 1].done) return prev;
        const next = [...prev];
        next[e.sequence - 1] = { ...next[e.sequence - 1], armedAt: e.targetAt };
        return next;
      });
    } else if (e.event === "capture_ack" && e.sequence >= 1 && e.sequence <= 4 && e.participantId !== bundle?.participantId) {
      setPartnerId(e.participantId);
      setPartnerPaths((prev) => {
        const next = [...prev];
        next[e.sequence - 1] = e.storagePath;
        return next;
      });
    } else if (e.event === "session_finished") {
      finishLocal();
    }
    callSignalRef.current(e);
  }

  const { send } = useRoomChannel(code, me, onEvent);

  // P2P call berlanjut dari ruang tunggu (peer id dikenali via presence/get).
  const call = usePeerCall({
    myId: bundle?.participantId ?? null,
    peerId: callPeerId,
    stream: cam.stream,
    isHost: bundle?.role === "host",
    send,
    enabled: mounted && !!bundle && cameraReady,
  });
  useEffect(() => {
    callSignalRef.current = call.handleSignal;
  });

  // Baca storage setelah mount: sinkronisasi React ↔ browser storage.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ storage browser, sah */
  useEffect(() => {
    setBundle(loadRoomBundle(code));
    setCapture(loadCaptureBundle(code));
    setMounted(true);
  }, [code]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Redirect ganda: tanpa bundle/capture → kembali ke ruang tunggu.
  useEffect(() => {
    if (!mounted) return;
    if (!bundle || !capture) router.replace(`/room/${code}`);
  }, [mounted, bundle, capture, code, router]);

  // Kamera auto-start (sudah ada konteks: user menekan MULAI di ruang tunggu).
  useEffect(() => {
    cam.start().then((ok) => ok && track("camera_ready", bundle?.roomId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offset jam server, hitung ulang tiap sesi (§9).
  useEffect(() => {
    getServerOffset(async () => {
      const { data } = await supabase.rpc("server_time_ms");
      return typeof data === "number" ? data : Date.now();
    }).then(setOffset, () => {});
    roomApi.get(code).then(
      (r) => {
        const other = r.members.find((m) => m.id !== bundle?.participantId);
        if (other) {
          setPartnerName(other.displayName);
          setCallPeerId(other.id);
        }
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick 100ms untuk countdown presisi (timer eksternal → state).
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi timer eksternal, sah */
  useEffect(() => {
    setNow(correctedNow(offset));
    const id = setInterval(() => setNow(correctedNow(offset)), 100);
    return () => clearInterval(id);
  }, [offset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const doUpload = useCallback(
    async (seq: number, blob: Blob, tries = 0) => {
      if (!bundle || !sessionDbId) return;
      setShots((s) => {
        const n = [...s];
        n[seq - 1] = { ...n[seq - 1], uploading: true };
        return n;
      });
      try {
        const path = await uploadShot(sessionDbId, seq, blob);
        setShots((s) => {
          const n = [...s];
          n[seq - 1] = { ...n[seq - 1], uploading: false };
          return n;
        });
        await send({
          event: "capture_ack",
          sessionId: sessionDbId,
          sequence: seq as 1 | 2 | 3 | 4,
          participantId: bundle.participantId,
          capturedAt: Date.now(),
          storagePath: path,
        });
        track("capture_completed", bundle.roomId, { shot: seq });
      } catch {
        if (tries < 1) {
          // Retry 1x; setelah itu slot pasangan jadi placeholder (§14).
          bgQueue.current.push({ seq, blob, tries: tries + 1 });
        }
        setShots((s) => {
          const n = [...s];
          n[seq - 1] = { ...n[seq - 1], uploading: false };
          return n;
        });
      }
    },
    [bundle, sessionDbId, send],
  );

  // Proses antrean background tanpa memblokir jadwal.
  useEffect(() => {
    if (bgQueue.current.length === 0) return;
    const q = [...bgQueue.current];
    bgQueue.current = [];
    if (q.length > 8) q.splice(0, q.length - 8);
    for (const item of q) void doUpload(item.seq, item.blob, item.tries);
  }, [now, doUpload]);

  const fireShot = useCallback(
    async (index: number) => {
      if (!bundle || !sessionDbId) return;
      if (firedRef.current[index]) return;
      firedRef.current[index] = true;
      try {
        const blob = await cam.captureShot();
        const url = await blobToDataURL(blob);
        setMyShots((prev) => {
          const n = [...prev];
          n[index] = url;
          return n;
        });
        setShots((s) => {
          const n = [...s];
          n[index] = { ...n[index], done: true };
          return n;
        });
        // Upload jalan di background; jadwal tidak menunggu (§10).
        void doUpload(index + 1, blob);
      } catch {
        firedRef.current[index] = false;
        setShots((s) => {
          const n = [...s];
          n[index] = { ...n[index], armedAt: null };
          return n;
        });
        setError(`Foto ${index + 1} gagal diambil, coba tekan lagi.`);
      }
    },
    [bundle, sessionDbId, cam, doUpload],
  );

  // Cek tiap tick: tembak shot yang targetAt-nya lewat dan belum fired.
  useEffect(() => {
    if (!cameraReady) return;
    shots.forEach((s, i) => {
      if (s.armedAt !== null && !s.done && now >= s.armedAt) void fireShot(i);
    });
  }, [now, shots, cameraReady, fireShot]);

  // Host memicu satu foto: target 5 detik dari jam terkoreksi.
  const armShot = async (index: number) => {
    if (!isHost || !sessionDbId || arming) return;
    if (shots[index].done || shots[index].armedAt !== null) return;
    setArming(true);
    setError(null);
    try {
      const targetAt = correctedNow(offset) + COUNTDOWN_MS;
      await send({
        event: "shot_armed",
        sessionId: sessionDbId,
        sequence: (index + 1) as 1 | 2 | 3 | 4,
        targetAt,
      });
      setShots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], armedAt: targetAt };
        return next;
      });
    } catch {
      setError("Gagal memicu foto. Coba lagi.");
    } finally {
      setArming(false);
    }
  };

  const doneCount = shots.filter((s) => s.done).length;
  const allDone = doneCount === 4;
  const armedIndex = shots.findIndex((s) => s.armedAt !== null && !s.done);
  const armedRemaining = armedIndex >= 0 && shots[armedIndex].armedAt !== null
    ? Math.max(0, (shots[armedIndex].armedAt as number) - now)
    : 0;
  const countdown = armedIndex >= 0 ? Math.ceil(armedRemaining / 1000) : 0;

  const finish = async () => {
    if (finishing || !sessionDbId || !bundle) return;
    setFinishing(true);
    try {
      await roomApi.finish(sessionDbId);
      await send({ event: "session_finished", sessionId: sessionDbId });
      track("session_completed", bundle.roomId);
    } catch {
      /* best-effort — halaman result tetap bisa dibuka */
    }
    finishLocal();
  };

  if (!mounted || !bundle || !capture) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <p className="text-center text-sm text-zinc-500">Menyiapkan sesi foto...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-center text-lg font-bold">Sesi Foto — {code}</h1>
      <ErrorMsg msg={error} />
      {tabHidden && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tab tidak aktif — kembali ke tab ini agar countdown tetap akurat.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <CameraView
          videoRef={cam.videoRef}
          ready={cameraReady}
          label="Kamu"
          mirrored={cam.mirrored}
          onToggleMirror={cam.toggleMirror}
        />
        <RemoteView
          remoteStream={call.remoteStream}
          status={call.status}
          name={partnerName}
          onRetry={call.retry}
        />
      </div>

      {cameraReady && cam.audioOn && (
        <button
          type="button"
          onClick={cam.toggleMute}
          className="w-full rounded-2xl border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
        >
          {cam.muted ? "🔇 Mic mati — ketuk untuk bicara" : "🎙️ Mic nyala — ketuk untuk bisu"}
        </button>
      )}

      <div className="rounded-3xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
        {!cameraReady ? (
          <p className="text-sm text-zinc-500">Menyiapkan kamera...</p>
        ) : armedIndex >= 0 ? (
          <>
            <p className="text-xs text-zinc-500">Foto {armedIndex + 1} dari 4</p>
            <p className="mt-1 text-6xl font-bold tabular-nums" aria-live="polite">
              {countdown}
            </p>
            <p className="mt-1 text-sm text-zinc-500">Bersiap... foto diambil otomatis</p>
          </>
        ) : allDone ? (
          <>
            <p className="text-lg font-semibold">Semua 4 foto selesai!</p>
            <p className="mt-1 text-sm text-zinc-500">
              Foto pasangan yang belum tiba tampil sebagai placeholder dan bisa dimuat ulang di halaman hasil.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {doneCount} dari 4 foto selesai {shots.some((s) => s.uploading) ? "· mengunggah..." : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {isHost ? "Tekan tombol foto berikutnya saat kalian siap berpose." : "Menunggu host menekan tombol foto..."}
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => {
          const s = shots[i];
          const label = s.done ? `Foto ${i + 1} ✓` : `Ambil Foto ${i + 1}`;
          return isHost ? (
            <Btn
              key={i}
              onClick={() => armShot(i)}
              disabled={!cameraReady || s.done || s.armedAt !== null || armedIndex >= 0 || arming}
            >
              {s.armedAt !== null && !s.done ? `${Math.ceil(Math.max(0, ((s.armedAt as number) - now)) / 1000)}...` : arming ? "..." : label}
            </Btn>
          ) : (
            <div
              key={i}
              className={`rounded-2xl px-5 py-3.5 text-center text-base font-semibold ${s.done ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}
            >
              {s.done ? `Foto ${i + 1} ✓` : `Foto ${i + 1}`}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ${shots[i].done ? "ring-2 ring-green-500" : ""}`}
          >
            {myShots[i] ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL jepretan lokal; next/image tidak bisa optimasi
              <img src={myShots[i]!} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>

      {allDone && (
        <GhostBtn onClick={finish} disabled={finishing}>
          {finishing ? "Menyiapkan hasil..." : "Lihat Hasil"}
        </GhostBtn>
      )}

      <button onClick={() => router.push(`/room/${code}`)} className="text-center text-sm text-zinc-500">
        Kembali ke ruang tunggu
      </button>
    </main>
  );
}
