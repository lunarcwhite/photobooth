"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/room/session";
import { loadRoomBundle, loadCaptureBundle, clearRoomBundle, clearCaptureBundle, saveShotsBundle, type RoomBundle, type CaptureBundle } from "@/lib/room/bundle";
import { useCamera } from "@/hooks/useCamera";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { usePeerCall } from "@/hooks/usePeerCall";
import { uploadShot, blobToDataURL } from "@/lib/storage/exchange";
import { track } from "@/lib/analytics/events";
import type { RoomBroadcastEvent } from "@/types/realtime";
import { Btn, GhostBtn, Card, ErrorMsg, StepBadge } from "@/components/ui";
import { CameraView } from "@/components/CameraView";
import { RemoteView } from "@/components/RemoteView";
import { getServerOffset, correctedNow } from "@/lib/realtime/clock";
import { supabase } from "@/lib/supabase/client";
import { roomApi } from "@/lib/room/api";
import { AlertIcon, BackIcon, CameraIcon, CheckIcon, ClockIcon, MicIcon, MicOffIcon } from "@/components/icons";
import { POSE_GUIDES } from "@/types/template";

// Capture otomatis: jadwal 4 targetTimes jam server dari room-api.start.
// Host: after session_started kirim mismo ke guest. Guest: bundle lama
// tanpa targetTimes → ambil via room-api.get lalu pasang. Kedua HP
// countdown lokal 3-2-1 per target + jepret bareng (PRD §6).
interface ShotState {
  done: boolean;
  uploading: boolean;
}

const TIMER_OPTIONS = [
  { val: 0, label: "0s", desc: "Langsung jepret (khusus manual)" },
  { val: 3, label: "3s", desc: "Hitung mundur 3 detik" },
  { val: 5, label: "5s", desc: "Hitung mundur 5 detik" },
  { val: 10, label: "10s", desc: "Hitung mundur 10 detik" },
];

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
    { done: false, uploading: false },
    { done: false, uploading: false },
    { done: false, uploading: false },
    { done: false, uploading: false },
  ]);
  const [targetTimes, setTargetTimes] = useState<[number, number, number, number] | null>(null);
  const [captureMode, setCaptureMode] = useState<"auto" | "manual">("auto");
  const [timerOption, setTimerOption] = useState<number>(3);
  const [armedShot, setArmedShot] = useState<{ sequence: number; targetAt: number } | null>(null);

  const [flash, setFlash] = useState(false);
  const [myShots, setMyShots] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerPaths, setPartnerPaths] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [partnerName, setPartnerName] = useState("Teman");
  const [callPeerId, setCallPeerId] = useState<string | null>(null);
  const [endedByHost, setEndedByHost] = useState(false);
  const callSignalRef = useRef<(e: RoomBroadcastEvent) => void>(() => {});
  const sendRef = useRef<(e: RoomBroadcastEvent) => Promise<void>>(async () => {});

  // Rasio & Mode dikunci ke host — refs agar handler selalu baca nilai terbaru.
  const isHostRef = useRef(false);
  const ratioRef = useRef(cam.ratio);
  const myPidRef = useRef("");
  const setRatioRef = useRef(cam.setRatio);
  const captureModeRef = useRef(captureMode);
  const timerOptionRef = useRef(timerOption);
  const armedShotRef = useRef(armedShot);
  useEffect(() => {
    isHostRef.current = bundle?.role === "host";
    ratioRef.current = cam.ratio;
    myPidRef.current = bundle?.participantId ?? "";
    setRatioRef.current = cam.setRatio;
    captureModeRef.current = captureMode;
    timerOptionRef.current = timerOption;
    armedShotRef.current = armedShot;
  });
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
      ratio: cam.ratio,
    });
    router.push(`/room/${code}/result`);
  }

  function onEvent(e: RoomBroadcastEvent) {
    if (e.event === "ratio_changed") {
      if (!isHostRef.current && (e.ratio === "3:4" || e.ratio === "1:1" || e.ratio === "9:16")) {
        setRatioRef.current(e.ratio);
      }
    } else if (e.event === "ratio_request") {
      if (isHostRef.current && myPidRef.current) {
        void sendRef.current({ event: "ratio_changed", from: myPidRef.current, ratio: ratioRef.current }).catch(() => {});
      }
    } else if (e.event === "session_started") {
      if (Array.isArray(e.targetTimes) && e.targetTimes.length === 4) {
        setTargetTimes(e.targetTimes);
      }
      if (e.mode) setCaptureMode(e.mode);
      if (typeof e.timerOption === "number") setTimerOption(e.timerOption);
    } else if (e.event === "config_changed") {
      if (!isHostRef.current) {
        setCaptureMode(e.mode);
        setTimerOption(e.timerOption);
        if (e.mode === "manual") {
          setArmedShot(null);
        }
      }
    } else if (e.event === "config_request") {
      if (isHostRef.current && myPidRef.current) {
        void sendRef.current({
          event: "config_changed",
          from: myPidRef.current,
          mode: captureModeRef.current,
          timerOption: timerOptionRef.current,
        }).catch(() => {});
      }
    } else if (e.event === "shot_armed") {
      setArmedShot({ sequence: e.sequence, targetAt: e.targetAt });
    } else if (e.event === "shot_cancelled") {
      setArmedShot(null);
    } else if (e.event === "capture_ack" && e.sequence >= 1 && e.sequence <= 4 && e.participantId !== bundle?.participantId) {
      setPartnerId(e.participantId);
      setPartnerPaths((prev) => {
        const next = [...prev];
        next[e.sequence - 1] = e.storagePath;
        return next;
      });
    } else if (e.event === "session_finished") {
      finishLocal();
    } else if (e.event === "room_ended") {
      cam.stop();
      setEndedByHost(true);
    }
    callSignalRef.current(e);
  }

  const { send } = useRoomChannel(code, me, onEvent);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Rasio dikunci ke host: guest minta sekali saat masuk, host mengumumkan
  // tiap berubah (termasuk mount) agar pindah waiting→capture tetap sinkron.
  useEffect(() => {
    if (!mounted || !bundle) return;
    if (bundle.role !== "host") {
      void send({ event: "ratio_request", from: bundle.participantId }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bundle?.participantId, bundle?.role]);

  useEffect(() => {
    if (!mounted || !bundle || bundle.role !== "host") return;
    void send({ event: "ratio_changed", from: bundle.participantId, ratio: cam.ratio }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bundle?.participantId, bundle?.role, cam.ratio]);

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
  // Jadwal dipasang berlapis: bundle → room-api.get (untuk bundle lama).
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ storage browser, sah */
  useEffect(() => {
    const b = loadRoomBundle(code);
    const c = loadCaptureBundle(code);
    setBundle(b);
    setCapture(c);
    if (c?.captureMode) setCaptureMode(c.captureMode);
    if (typeof c?.timerOption === "number") setTimerOption(c.timerOption);
    if (c?.targetTimes) setTargetTimes(c.targetTimes);
    else if (c && (!c.captureMode || c.captureMode === "auto")) {
      roomApi.get(code).then(
        (r) => {
          if (r.activeSession && r.activeSession.sessionDbId === c.sessionDbId) {
            setTargetTimes(r.activeSession.targetTimes);
          }
        },
        () => {
          track("session_failed", b?.roomId, { reason: "no_schedule" });
          setError("Jadwal foto tidak ketemu. Kembali ke booth dan mulai lagi.");
        },
      );
    }
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

  // Tick untuk countdown presisi (timer eksternal → state).
  // 100ms saat jadwal live / armed shot aktif; idle 1 dtk untuk antrean.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi timer eksternal, sah */
  const sessionLive =
    shots.some((s) => !s.done) &&
    ((captureMode === "auto" && targetTimes !== null) ||
      (captureMode === "manual" && armedShot !== null));
  useEffect(() => {
    setNow(correctedNow(offset));
    const id = setInterval(() => setNow(correctedNow(offset)), sessionLive ? 100 : 1000);
    return () => clearInterval(id);
  }, [offset, sessionLive]);
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
          // Retry 1x; setelah itu slot teman jadi placeholder (§14).
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
      // Shutter flash langsung — umpan balik fisik booth (DESIGN §8).
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
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
        setError(`Foto ${index + 1} gagal diambil — sesi tetap lanjut.`);
        track("session_failed", bundle.roomId, { shot: index + 1 });
      }
    },
    [bundle, sessionDbId, cam, doUpload],
  );

  // Cek tiap tick: tembak shot yang targetAt-nya lewat dan belum fired.
  useEffect(() => {
    if (!cameraReady) return;
    if (captureMode === "auto" && targetTimes) {
      shots.forEach((s, i) => {
        if (!s.done && targetTimes[i] > 0 && now >= targetTimes[i]) void fireShot(i);
      });
    }
    if (captureMode === "manual" && armedShot) {
      const idx = armedShot.sequence - 1;
      if (idx >= 0 && idx < 4 && !shots[idx].done && now >= armedShot.targetAt) {
        void fireShot(idx);
        setArmedShot(null);
      }
    }
  }, [now, shots, cameraReady, captureMode, targetTimes, armedShot, fireShot]);

  const doneCount = shots.filter((s) => s.done).length;
  const allDone = doneCount === 4;
  const nextUnfinishedIndex = shots.findIndex((s) => !s.done);

  // Foto aktif & hitung mundur dinamis
  const activeIndex =
    captureMode === "auto" && targetTimes
      ? targetTimes.findIndex((t, i) => !shots[i].done && t > 0 && now < t)
      : captureMode === "manual" && armedShot
        ? armedShot.sequence - 1
        : -1;

  const countdown =
    captureMode === "auto" && activeIndex >= 0 && targetTimes && targetTimes[activeIndex] > 0
      ? Math.max(0, Math.ceil((targetTimes[activeIndex] - now) / 1000))
      : captureMode === "manual" && armedShot
        ? Math.max(0, Math.ceil((armedShot.targetAt - now) / 1000))
        : 0;

  // Aksi Shutter Manual oleh Host
  const triggerManualShot = useCallback(async () => {
    if (!bundle || !sessionDbId || armedShotRef.current || shots.every((s) => s.done)) return;
    const nextIdx = shots.findIndex((s) => !s.done);
    if (nextIdx === -1) return;

    const currentTimer = timerOptionRef.current;
    const buffer = currentTimer === 0 ? 250 : 200;
    const targetAt = correctedNow(offset) + currentTimer * 1000 + buffer;
    const seq = (nextIdx + 1) as 1 | 2 | 3 | 4;

    setArmedShot({ sequence: seq, targetAt });
    await sendRef.current({
      event: "shot_armed",
      sessionId: sessionDbId,
      sequence: seq,
      targetAt,
    });
  }, [bundle, sessionDbId, shots, offset]);

  const cancelManualCountdown = useCallback(async () => {
    if (!bundle || !sessionDbId || !armedShotRef.current) return;
    const seq = armedShotRef.current.sequence as 1 | 2 | 3 | 4;
    setArmedShot(null);
    await sendRef.current({
      event: "shot_cancelled",
      sessionId: sessionDbId,
      sequence: seq,
    });
  }, [bundle, sessionDbId]);

  // Penggantian live Mode & Timer oleh Host saat sesi berlangsung
  const switchMode = useCallback(
    async (newMode: "auto" | "manual") => {
      if (newMode === captureModeRef.current || !isHostRef.current || !sessionDbId) return;
      setCaptureMode(newMode);
      setArmedShot(null);

      let newTargetTimes: [number, number, number, number] = [0, 0, 0, 0];
      if (newMode === "auto") {
        const delay = timerOptionRef.current * 1000 + 4000;
        let t = Date.now() + (timerOptionRef.current === 0 ? 1500 : timerOptionRef.current * 1000 + 1000);
        const times: [number, number, number, number] = [0, 0, 0, 0];
        shots.forEach((s, i) => {
          if (!s.done) {
            times[i] = t;
            t += delay;
          }
        });
        newTargetTimes = times;
        setTargetTimes(times);
      } else {
        setTargetTimes([0, 0, 0, 0]);
      }

      await sendRef.current({
        event: "config_changed",
        from: myPidRef.current,
        mode: newMode,
        timerOption: timerOptionRef.current,
      });
      if (newMode === "auto") {
        await sendRef.current({
          event: "session_started",
          sessionId: sessionDbId,
          totalShots: 4,
          targetTimes: newTargetTimes,
          mode: "auto",
          timerOption: timerOptionRef.current,
        });
      }
    },
    [sessionDbId, shots],
  );

  const switchTimer = useCallback(
    async (newTimer: number) => {
      if (!isHostRef.current || newTimer === timerOptionRef.current || !sessionDbId) return;
      setTimerOption(newTimer);
      await sendRef.current({
        event: "config_changed",
        from: myPidRef.current,
        mode: captureModeRef.current,
        timerOption: newTimer,
      });
    },
    [sessionDbId],
  );

  // Shortcut spasi untuk host di mode manual
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && isHost && captureMode === "manual" && !armedShot && !allDone) {
        e.preventDefault();
        void triggerManualShot();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHost, captureMode, armedShot, allDone, triggerManualShot]);

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
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-booth-muted dark:text-booth-creamdim">
          <ClockIcon size={16} /> Menyiapkan sesi foto…
        </p>
      </main>
    );
  }

  if (endedByHost) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <Card>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-display text-xl font-bold">Room {code} berakhir</h1>
            <p className="text-sm text-booth-muted dark:text-booth-creamdim">
              Host mengakhiri room ini. Terima kasih sudah mampir.
            </p>
            <GhostBtn
              onClick={() => {
                clearRoomBundle(code);
                clearCaptureBundle(code);
                cam.stop();
                router.push("/");
              }}
            >
              Kembali ke beranda
            </GhostBtn>
          </div>
        </Card>
      </main>
    );
  }

  const activePoseIndex = armedShot
    ? armedShot.sequence - 1
    : activeIndex >= 0
      ? activeIndex
      : nextUnfinishedIndex;
  const currentPose = POSE_GUIDES[Math.min(3, Math.max(0, activePoseIndex))];

  const statusLine = !cameraReady
    ? "Menyiapkan kamera…"
    : allDone
      ? "Dapat! Semua 4 foto jadi."
      : captureMode === "manual"
        ? armedShot
          ? `Bersiap — foto ${armedShot.sequence} (${currentPose?.emoji} ${currentPose?.title})…`
          : isHost
            ? `Foto ${nextUnfinishedIndex + 1}: ${currentPose?.emoji} ${currentPose?.title} — tekan jepret.`
            : `Menunggu host foto ${nextUnfinishedIndex + 1}: ${currentPose?.emoji} ${currentPose?.title}…`
        : activeIndex >= 0
          ? `Bersiap foto ${activeIndex + 1}: ${currentPose?.emoji} ${currentPose?.title}…`
          : "Menyiapkan…";
  const uploading = shots.some((s) => s.uploading);

  return (
    <main className="flex h-dvh w-full flex-col gap-3 overflow-hidden px-4 py-3 md:px-8 lg:gap-4 lg:px-12 xl:mx-auto xl:max-w-[1500px] xl:px-14">
      {/* Top Bar Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-booth-line/60 pb-3 dark:border-booth-nightline/60">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <StepBadge step="3" of="4" label="Sesi Foto" />
            <h1 className="font-display mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-booth-ink dark:text-booth-cream truncate">
              {statusLine}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {uploading && (
            <span className="text-xs font-semibold text-booth-muted dark:text-booth-creamdim animate-pulse">
              Mengunggah foto…
            </span>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-booth-line bg-booth-card/60 px-3.5 py-1.5 dark:border-booth-nightline dark:bg-booth-nightcard/60" aria-label={`Progres ${doneCount} dari 4 foto`}>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`h-2.5 w-6 sm:w-8 rounded-full transition-all duration-300 ${
                    shots[i].done
                      ? "bg-emerald-500 shadow-xs"
                      : i === activeIndex
                        ? "bg-booth-accent scale-y-125 animate-pulse"
                        : "bg-booth-line dark:bg-booth-nightline"
                  }`}
                />
              ))}
            </div>
            <span className="ml-1.5 text-xs font-bold tabular-nums text-booth-ink dark:text-booth-cream">{doneCount}/4</span>
          </div>
        </div>
      </header>

      <ErrorMsg msg={error} />

      {tabHidden && (
        <p role="alert" className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 shadow-xs">
          <AlertIcon size={16} className="text-amber-600 shrink-0" />
          Tab tidak aktif — silakan kembali ke tab ini agar sinkronisasi hitung mundur tetap presisi.
        </p>
      )}

      {/* Dual Camera Stage & Filmstrip Console */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row lg:gap-6">
        {/* Stage Area */}
        <div className="relative grid min-h-0 flex-1 grid-cols-2 grid-rows-1 gap-2 sm:gap-3 md:grid-cols-2 md:grid-rows-1 lg:gap-6">
          <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden [container-type:size]">
            <CameraView
              videoRef={cam.videoRef}
              stream={cam.stream}
              ready={cameraReady}
              label={`Kamu ${isHost ? "(Host)" : ""}`}
              mirrored={cam.mirrored}
              onToggleMirror={cam.toggleMirror}
              ratio={cam.ratio}
              onCycleRatio={isHost ? cam.cycleRatio : undefined}
            />
          </div>
          <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden [container-type:size]">
            <RemoteView
              remoteStream={call.remoteStream}
              status={call.status}
              name={partnerName}
              onRetry={call.retry}
              ratio={cam.ratio}
              hasPartner={true}
            />
          </div>

          {/* Non-Intrusive Countdown Overlay (Does not block faces / viewfinder preview) */}
          {cameraReady && (countdown > 0 || (captureMode === "manual" && armedShot && countdown === 0)) && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-2.5 sm:p-4 z-20">
              {/* Sleek Top Floating Pill (Above eye/head level) */}
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/65 px-3 py-1 sm:px-4 sm:py-1.5 text-white backdrop-blur-md border border-white/20 shadow-md">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/90">
                  Foto {armedShot ? armedShot.sequence : activeIndex + 1}: {currentPose?.emoji} {currentPose?.title}
                </span>
                <span className="text-white/30">•</span>
                <span className="text-[10px] sm:text-xs font-medium text-amber-300">
                  {countdown > 0 ? "Pasang pose!" : "Jepret!"}
                </span>
              </div>

              {/* Compact Center Countdown Badge (Fits between dual camera columns, leaves faces visible) */}
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm border border-white/25 shadow-xl">
                <span
                  key={`${activeIndex}-${countdown}`}
                  className="countdown-num font-display text-2xl sm:text-4xl font-extrabold tabular-nums text-white"
                  aria-live="polite"
                >
                  {countdown > 0 ? countdown : "✦"}
                </span>
              </div>

              {/* Bottom Cue Badge: Specific pose instruction for Host vs Guest */}
              <div className="rounded-full bg-black/65 px-3.5 py-1 text-white backdrop-blur-md border border-white/20 shadow-md max-w-[92%] text-center">
                <p className="text-[11px] sm:text-xs font-medium text-white/95 truncate">
                  <span className="text-amber-300 font-bold">Tips kamu:</span> {isHost ? currentPose?.hostTip : currentPose?.guestTip}
                </p>
              </div>
            </div>
          )}

          {flash && (
            <div className="pointer-events-none absolute inset-0 bg-white z-30 transition-opacity duration-150" aria-hidden />
          )}
        </div>

        {/* Sidebar Filmstrip Console */}
        <div className="flex shrink-0 flex-col gap-2.5 sm:gap-3 landscape:min-h-0 landscape:w-56 landscape:justify-center landscape:overflow-y-auto md:min-h-0 md:w-64 md:justify-center md:overflow-y-auto lg:w-76 lg:overflow-visible">
          {/* Couple Pose Guide Card */}
          {!allDone && currentPose && (
            <div className="booth-card rounded-2xl p-2.5 sm:p-3 border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base shrink-0">{currentPose.emoji}</span>
                  <span className="text-xs font-bold text-booth-ink dark:text-booth-cream truncate">
                    Pose #{currentPose.id}: {currentPose.title}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                  Ide Pose Berdua
                </span>
              </div>
              <p className="mt-1 text-[11px] text-booth-ink/80 dark:text-booth-cream/80 leading-snug">
                {currentPose.desc}
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                <span>Tips kamu:</span>
                <span className="font-medium text-booth-ink dark:text-booth-cream">
                  {isHost ? currentPose.hostTip : currentPose.guestTip}
                </span>
              </div>
            </div>
          )}
          {/* Filmstrip Card */}
          <div className="booth-card rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                Strip Foto ({doneCount}/4)
              </p>
              <span className="text-[10px] font-semibold text-booth-accent">
                {captureMode === "auto" ? "✨ Auto" : "📸 Manual"} ({timerOption}s)
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 landscape:grid-cols-2 md:grid-cols-2 lg:gap-2.5">
              {[0, 1, 2, 3].map((i) => {
                const ar = cam.ratio === "1:1" ? "aspect-square" : cam.ratio === "9:16" ? "aspect-[9/16]" : "aspect-[3/4]";
                const done = shots[i].done;
                const isActive = i === activeIndex;

                return (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className={`relative w-full ${ar} overflow-hidden rounded-xl border-2 transition-all duration-200 bg-booth-night shadow-sm ${
                        done
                          ? "border-emerald-500 shadow-emerald-500/10"
                          : isActive
                            ? "border-booth-accent ring-2 ring-booth-accent/30"
                            : "border-booth-line/70 dark:border-booth-nightline/70"
                      }`}
                    >
                      {myShots[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={myShots[i]!}
                          alt={`Foto ${i + 1} berhasil diambil`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/40" aria-hidden>
                          {isActive ? (
                            <CameraIcon size={20} className="text-booth-accent animate-pulse" />
                          ) : (
                            <span className="text-xs font-bold tabular-nums">#{i + 1}</span>
                          )}
                        </div>
                      )}

                      {done && (
                        <span className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs" aria-hidden>
                          <CheckIcon size={12} strokeWidth={2.5} />
                        </span>
                      )}

                      {isActive && !done && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span key={countdown} className="countdown-num font-display text-2xl font-bold text-white tabular-nums">
                            {countdown > 0 ? countdown : "✦"}
                          </span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-booth-muted dark:text-booth-creamdim mt-1 tabular-nums">
                      Foto {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Mode & Timer Switcher (Host only, when not finished) */}
          {isHost && !allDone && (
            <div className="booth-card rounded-xl p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-booth-muted">
                  Atur Mode Jepret
                </span>
                <span className="text-[9px] text-booth-muted">Spasi = Jepret</span>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <div className="inline-flex rounded-lg border border-booth-line bg-black/[0.04] p-0.5 dark:border-booth-nightline dark:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => switchMode("auto")}
                    className={`rounded-md py-1 px-2 text-[10px] font-semibold transition cursor-pointer ${
                      captureMode === "auto"
                        ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                        : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
                    }`}
                  >
                    ✨ Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("manual")}
                    className={`rounded-md py-1 px-2 text-[10px] font-semibold transition cursor-pointer ${
                      captureMode === "manual"
                        ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                        : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
                    }`}
                  >
                    📸 Manual
                  </button>
                </div>

                {/* Timer Pills */}
                <div className="inline-flex rounded-lg border border-booth-line bg-black/[0.04] p-0.5 dark:border-booth-nightline dark:bg-white/[0.05]">
                  {TIMER_OPTIONS.map((t) => {
                    const isSelected = timerOption === t.val;
                    const isDisabled = captureMode === "auto" && t.val === 0;
                    return (
                      <button
                        key={t.val}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => switchTimer(t.val)}
                        className={`rounded-md py-1 px-1.5 text-[10px] font-bold tabular-nums transition ${
                          isSelected
                            ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                            : isDisabled
                              ? "opacity-30 cursor-not-allowed text-booth-muted"
                              : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim cursor-pointer"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Audio Mute Toggle */}
          {cameraReady && cam.audioOn && (
            <button
              type="button"
              onClick={cam.toggleMute}
              className="flex min-h-[38px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-booth-line bg-booth-card px-3 py-1.5 text-xs font-semibold text-booth-ink hover:bg-black/[0.04] transition active:translate-y-px dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream cursor-pointer"
            >
              {cam.muted ? <MicOffIcon size={15} className="text-red-500" /> : <MicIcon size={15} className="text-emerald-500" />}
              <span>{cam.muted ? "Mic Bisu (Ketuk Bicara)" : "Mic Aktif"}</span>
            </button>
          )}

          {/* Selesai / Action Console */}
          <div className="mt-auto pt-1 flex flex-col gap-2">
            {allDone ? (
              <Btn tone="accent" onClick={finish} disabled={finishing} className="text-base py-3.5 shadow-lg">
                {finishing ? "Menyusun Foto…" : "Lihat Hasil Foto ✦"}
              </Btn>
            ) : captureMode === "manual" ? (
              isHost ? (
                armedShot ? (
                  <button
                    type="button"
                    onClick={cancelManualCountdown}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-500/80 bg-red-50 py-2.5 px-4 text-xs font-bold text-red-700 hover:bg-red-100 transition active:scale-[0.98] dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-300 cursor-pointer"
                  >
                    <span>Batal Hitung Mundur Foto {armedShot.sequence}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={triggerManualShot}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-booth-accent py-3 px-4 text-sm font-bold text-white shadow-lg hover:brightness-105 active:scale-[0.98] transition cursor-pointer"
                  >
                    <CameraIcon size={18} />
                    <span>
                      {timerOption === 0
                        ? `Jepret Foto ${nextUnfinishedIndex + 1} Sekarang`
                        : `Jepret Foto ${nextUnfinishedIndex + 1} (${timerOption}s)`}
                    </span>
                  </button>
                )
              ) : (
                <div className="rounded-xl border border-booth-line/70 bg-black/[0.02] p-2.5 text-center text-xs text-booth-muted dark:border-booth-nightline/70 dark:text-booth-creamdim">
                  {armedShot
                    ? `✦ Bersiap! Foto ${armedShot.sequence} sedang dihitung mundur (${countdown}s)…`
                    : `Menunggu Host menekan tombol jepret foto ${nextUnfinishedIndex + 1}…`}
                </div>
              )
            ) : (
              <div className="rounded-xl border border-booth-line/70 bg-black/[0.02] p-2.5 text-center text-xs text-booth-muted dark:border-booth-nightline/70 dark:text-booth-creamdim">
                Hitung mundur berjalan otomatis ({timerOption}s) per foto.
              </div>
            )}

            <button
              onClick={() => router.push(`/room/${code}`)}
              className="flex items-center justify-center gap-1.5 py-1 text-center text-xs font-semibold text-booth-muted hover:text-booth-ink transition dark:text-booth-creamdim dark:hover:text-white cursor-pointer"
            >
              <BackIcon size={13} />
              Kembali ke ruang tunggu
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
