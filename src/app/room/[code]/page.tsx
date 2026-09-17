"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roomApi, RoomApiError, type Member } from "@/lib/room/api";
import { normalizeCode, validateDisplayName } from "@/lib/room/session";
import { loadRoomBundle, saveRoomBundle, clearRoomBundle, saveCaptureBundle, loadCaptureBundle, clearCaptureBundle, type RoomBundle } from "@/lib/room/bundle";
import { useCamera } from "@/hooks/useCamera";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { usePeerCall } from "@/hooks/usePeerCall";
import { track } from "@/lib/analytics/events";
import type { RoomBroadcastEvent } from "@/types/realtime";
import { Btn, GhostBtn, Field, Card, ErrorMsg, Dot, StepBadge } from "@/components/ui";
import { CameraView } from "@/components/CameraView";
import { RemoteView } from "@/components/RemoteView";
import { CheckIcon, ClockIcon, CopyIcon, MicIcon, MicOffIcon } from "@/components/icons";
import { QRCodeModal } from "@/components/QRCodeModal";

function initial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

const TIMER_OPTIONS = [
  { val: 0, label: "0s", desc: "Langsung jepret (khusus manual)" },
  { val: 3, label: "3s", desc: "Hitung mundur 3 detik" },
  { val: 5, label: "5s", desc: "Hitung mundur 5 detik" },
  { val: 10, label: "10s", desc: "Hitung mundur 10 detik" },
];

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shareLink, setShareLink] = useState(`/room/${code}`);
  const [showQr, setShowQr] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  // Sesi aktif di server tapi user sengaja di ruang tunggu (tekan Kembali
  // dari capture). Tampilkan tombol rejoin manual, jangan auto-push agar
  // tidak bounce bolak-balik waiting ↔ capture.
  const [pendingSession, setPendingSession] = useState<{ sessionDbId: string } | null>(null);
  const [ending, setEnding] = useState(false);
  // Room diakhiri host / kedaluwarsa: tampilkan layar keluar resmi.
  const [ended, setEnded] = useState<null | { reason: "host" | "expired" | "completed" }>(null);

  // Konfigurasi Mode Jepret & Timer (diatur oleh Host)
  const [captureMode, setCaptureMode] = useState<"auto" | "manual">("auto");
  const [timerOption, setTimerOption] = useState<number>(3);

  const cam = useCamera();
  const cameraReady = cam.status === "ready";

  const me = useMemo(
    () =>
      bundle
        ? { participantId: bundle.participantId, displayName: bundle.displayName, cameraReady }
        : null,
    [bundle, cameraReady],
  );

  const goCapture = useCallback(
    (
      sessionDbId: string,
      targetTimes?: [number, number, number, number],
      mode?: "auto" | "manual",
      timer?: number,
    ) => {
      saveCaptureBundle(code, {
        sessionDbId,
        targetTimes,
        captureMode: mode ?? captureModeRef.current,
        timerOption: timer ?? timerOptionRef.current,
      });
      router.push(`/room/${code}/capture`);
    },
    [code, router],
  );

  const callSignalRef = useRef<(e: RoomBroadcastEvent) => void>(() => {});
  const sendRef = useRef<(e: RoomBroadcastEvent) => Promise<void>>(async () => {});

  // Refs agar onEvent (stable callback) selalu baca nilai terbaru tanpa
  // re-subscribe channel. Rasio & Mode dikunci ke host — guest hanya menerapkan.
  const isHostRef = useRef(false);
  const ratioRef = useRef(cam.ratio);
  const myPidRef = useRef("");
  const setRatioRef = useRef(cam.setRatio);
  const captureModeRef = useRef(captureMode);
  const timerOptionRef = useRef(timerOption);
  useEffect(() => {
    isHostRef.current = bundle?.role === "host";
    ratioRef.current = cam.ratio;
    myPidRef.current = bundle?.participantId ?? "";
    setRatioRef.current = cam.setRatio;
    captureModeRef.current = captureMode;
    timerOptionRef.current = timerOption;
  });

  const onEvent = useCallback(
    (e: RoomBroadcastEvent) => {
      if (e.event === "session_started") {
        track("session_started", bundle?.roomId);
        goCapture(e.sessionId, e.targetTimes, e.mode, e.timerOption);
      } else if (e.event === "retake") {
        // Teman minta ambil ulang dari hasil: bersihkan sesi lokal.
        clearCaptureBundle(code);
        setPendingSession(null);
      } else if (e.event === "room_ended") {
        // Host mengakhiri: hentikan kamera + call, tampilkan layar keluar.
        cam.stop();
        setEnded({ reason: "host" });
      } else if (e.event === "ratio_changed") {
        // Hanya guest yang menerapkan; host adalah sumber kebenaran.
        if (!isHostRef.current && (e.ratio === "3:4" || e.ratio === "1:1" || e.ratio === "9:16")) {
          setRatioRef.current(e.ratio);
        }
      } else if (e.event === "ratio_request") {
        // Guest telat gabung minta rasio terkini — host menjawab.
        if (isHostRef.current && myPidRef.current) {
          void sendRef.current({ event: "ratio_changed", from: myPidRef.current, ratio: ratioRef.current }).catch(() => {});
        }
      } else if (e.event === "config_changed") {
        // Guest menerapkan mode & timer terkini dari host
        if (!isHostRef.current) {
          setCaptureMode(e.mode);
          setTimerOption(e.timerOption);
        }
      } else if (e.event === "config_request") {
        // Guest minta konfigurasi terkini — host menjawab
        if (isHostRef.current && myPidRef.current) {
          void sendRef.current({
            event: "config_changed",
            from: myPidRef.current,
            mode: captureModeRef.current,
            timerOption: timerOptionRef.current,
          }).catch(() => {});
        }
      }
      callSignalRef.current(e);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle?.roomId, goCapture],
  );

  const { peers, connected, send } = useRoomChannel(code, me, onEvent);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // P2P call: host menawarkan, guest menjawab. Jalan saat kamera siap.
  const callPeerId =
    members.find((m) => m.id !== bundle?.participantId)?.id ??
    peers.find((p) => p.participantId !== bundle?.participantId)?.participantId ??
    null;
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

  // Baca storage + origin setelah mount: sinkronisasi React ↔ browser
  // storage setelah SSR. Server dan client render shell yang sama.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ storage browser, sah */
  useEffect(() => {
    setBundle(loadRoomBundle(code));
    setShareLink(`${window.location.origin}/room/${code}`);
    setMounted(true);
  }, [code]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Verifikasi keanggotaan. Sesi aktif di server tidak langsung push —
  // tampilkan tombol gabung ulang manual agar tidak bounce (user bisa
  // sengaja tekan Kembali dari capture).
  useEffect(() => {
    if (!bundle) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await roomApi.get(code);
        if (cancelled) return;
        setMembers(r.members);
        setExpiresAt(r.expiresAt);
        if (r.status === "expired" || r.status === "completed") {
          cam.stop();
          setEnded({ reason: r.status === "expired" ? "expired" : "completed" });
          return;
        }
        if (r.activeSession) {
          const existing = loadCaptureBundle(code);
          if (!existing || existing.sessionDbId !== r.activeSession.sessionDbId) {
            saveCaptureBundle(code, r.activeSession);
          }
          setPendingSession({ sessionDbId: r.activeSession.sessionDbId });
        } else {
          setPendingSession(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof RoomApiError && e.code === "SESSION_UNKNOWN") {
          // session_id tak dikenal → perlakukan sebagai pendatang baru.
          setBundle(null);
        } else {
          setError(e instanceof RoomApiError ? e.message : "Tidak bisa memuat room.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, bundle?.participantId]);

  // Segarkan daftar member saat presence berubah (tanpa postgres_changes).
  useEffect(() => {
    if (peers.length === 0 || !bundle) return;
    roomApi.get(code).then(
      (r) => setMembers(r.members),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers.length]);

  // Rasio dikunci ke host: host mengumumkan tiap berubah (termasuk saat
  // mount via effect di bawah), guest meminta sekali saat masuk agar yang
  // telat gabung sinkron.
  useEffect(() => {
    if (!mounted || !bundle || bundle.role === "host") return;
    void send({ event: "ratio_request", from: bundle.participantId }).catch(() => {});
    void send({ event: "config_request", from: bundle.participantId }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bundle?.participantId, bundle?.role]);

  useEffect(() => {
    if (!mounted || !bundle || bundle.role !== "host") return;
    void send({ event: "ratio_changed", from: bundle.participantId, ratio: cam.ratio }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bundle?.participantId, bundle?.role, cam.ratio]);

  useEffect(() => {
    if (!mounted || !bundle || bundle.role !== "host") return;
    void send({
      event: "config_changed",
      from: bundle.participantId,
      mode: captureMode,
      timerOption,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bundle?.participantId, bundle?.role, captureMode, timerOption]);

  const doJoin = async () => {
    setError(null);
    setJoining(true);
    try {
      const displayName = validateDisplayName(joinName);
      const r = await roomApi.join(code, displayName);
      const meRow = r.members.find((m) => m.id === r.participantId);
      const b = { roomId: r.roomId, participantId: r.participantId, displayName, role: meRow?.role ?? ("guest" as const) };
      saveRoomBundle(code, b);
      setBundle(b);
      setMembers(r.members);
      track("room_joined", r.roomId);
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa gabung. Periksa kode.");
    } finally {
      setJoining(false);
    }
  };

  const doStart = async () => {
    if (!bundle || bundle.role !== "host") return;
    setError(null);
    setStarting(true);
    try {
      const r = await roomApi.start(code);
      track("session_started", bundle.roomId);

      let targetTimes: [number, number, number, number] = r.targetTimes;
      if (captureMode === "auto") {
        // Hitung interval berdasarkan timerOption
        const delay = timerOption * 1000 + 4000;
        const t0 = Date.now() + (timerOption === 0 ? 1500 : timerOption * 1000 + 1000);
        targetTimes = [t0, t0 + delay, t0 + delay * 2, t0 + delay * 3];
      } else {
        // Manual: targetTimes dummy karena jepretan dipicu satu per satu oleh host
        targetTimes = [0, 0, 0, 0];
      }

      // Jadwal & mode ikut broadcast agar guest langsung pasang tanpa GET tambahan.
      await send({
        event: "session_started",
        sessionId: r.sessionDbId,
        totalShots: 4,
        targetTimes,
        mode: captureMode,
        timerOption,
      });
      goCapture(r.sessionDbId, targetTimes, captureMode, timerOption);
    } catch (e) {
      // 409 SESSION_ACTIVE: sesi capture lama belum di-finish (mis. host
      // refresh / tekan MULAI dua kali). Gabung ulang sesi itu, bukan error.
      if (e instanceof RoomApiError && e.code === "SESSION_ACTIVE") {
        try {
          const r = await roomApi.get(code);
          if (r.activeSession) {
            goCapture(r.activeSession.sessionDbId, r.activeSession.targetTimes, captureMode, timerOption);
            return;
          }
        } catch {
          /* abaikan — tampilkan pesan di bawah */
        }
        setError("Sesi sudah berjalan. Buka halaman sesi foto untuk lanjut.");
      } else {
        setError(e instanceof RoomApiError ? e.message : "Tidak bisa memulai sesi.");
      }
      setStarting(false);
    }
  };

  const doEnd = async () => {
    if (!bundle || bundle.role !== "host") return;
    setEnding(true);
    try {
      await roomApi.end(code);
      await send({ event: "room_ended" });
      router.push("/");
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa mengakhiri room.");
      setEnding(false);
    }
  };

  const bothCamerasReady = useMemo(() => {
    const ready = peers.filter((p) => p.cameraReady).map((p) => p.participantId);
    return bundle ? ready.includes(bundle.participantId) && peers.filter((p) => p.cameraReady).length >= 2 : false;
  }, [peers, bundle]);

  // Selebrasi halus saat teman gabung: deteksi transisi 1 → 2 member.
  const memberCount = members.length;
  const [celebrate, setCelebrate] = useState(false);
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (prevCountRef.current === 1 && memberCount >= 2) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2500);
      prevCountRef.current = memberCount;
      return () => clearTimeout(id);
    }
    prevCountRef.current = memberCount;
  }, [memberCount]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard diblokir — user bisa salin manual */
    }
  };

  if (!mounted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-booth-muted dark:text-booth-creamdim">
          <ClockIcon size={16} /> Memuat room…
        </p>
      </main>
    );
  }

  const leaveRoom = () => {
    clearRoomBundle(code);
    clearCaptureBundle(code);
    cam.stop();
    router.push("/");
  };

  if (ended) {
    const text =
      ended.reason === "host"
        ? "Host mengakhiri room ini. Terima kasih sudah mampir."
        : ended.reason === "expired"
          ? "Room sudah kedaluwarsa."
          : "Room sudah selesai.";
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <Card>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-display text-xl font-bold">Room {code} berakhir</h1>
            <p className="text-sm text-booth-muted dark:text-booth-creamdim">{text}</p>
            <Btn onClick={leaveRoom}>Kembali ke beranda</Btn>
          </div>
        </Card>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <StepBadge step="2" of="4" label="Ruang tunggu" />
        <div>
          <h1 className="font-display text-center text-2xl font-bold tabular-nums">{code}</h1>
          <p className="mt-1 text-center text-sm text-booth-muted dark:text-booth-creamdim">
            Masukkan namamu untuk gabung ke room ini.
          </p>
        </div>
        <ErrorMsg msg={error} />

        {pendingSession && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/60">
            <p className="text-sm font-semibold">Sesi foto masih berjalan.</p>
            <div className="mt-3">
              <Btn onClick={() => goCapture(pendingSession.sessionDbId)}>Kembali ke sesi foto</Btn>
            </div>
          </div>
        )}
        <Card>
          <div className="flex flex-col gap-3">
            <Field value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Namamu" maxLength={30} autoComplete="nickname" />
            <Btn onClick={doJoin} disabled={joining}>
              {joining ? "Menggabungkan…" : "Gabung"}
            </Btn>
            <GhostBtn onClick={() => router.push("/")}>Kembali</GhostBtn>
          </div>
        </Card>
      </main>
    );
  }

  const partner = members.find((m) => m.id !== bundle.participantId);
  const partnerPeer = peers.find((p) => p.participantId !== bundle.participantId);
  const iAmHost = bundle.role === "host";
  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <main className="flex h-dvh w-full flex-col gap-3 overflow-hidden px-4 py-3 md:px-8 lg:gap-4 lg:px-12 xl:mx-auto xl:max-w-[1500px] xl:px-14">
      {/* Top Bar Navigation */}
      <header className="flex shrink-0 items-center justify-between gap-2 sm:gap-4 border-b border-booth-line/60 pb-2 sm:pb-3 dark:border-booth-nightline/60">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="min-w-0">
            <StepBadge step="2" of="4" label="Ruang Tunggu" />
            <div className="flex items-baseline gap-1.5 sm:gap-2 mt-0.5">
              <span className="text-[11px] sm:text-xs font-semibold text-booth-muted dark:text-booth-creamdim">Kode:</span>
              <h1 className="font-display text-base sm:text-xl font-bold tracking-[0.15em] sm:tracking-[0.2em] text-booth-accent tabular-nums truncate">
                {code}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-booth-line bg-booth-card/60 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-booth-muted dark:border-booth-nightline dark:bg-booth-nightcard/60 dark:text-booth-creamdim">
            <Dot on={connected === "terhubung"} label={connected === "terhubung" ? "Aktif" : "Menghubungkan…"} />
          </span>
          <button
            onClick={leaveRoom}
            className="shrink-0 rounded-xl border border-booth-line px-2.5 sm:px-3 py-1 text-xs font-semibold text-booth-muted hover:text-booth-ink hover:bg-black/[0.04] transition dark:border-booth-nightline dark:text-booth-creamdim dark:hover:text-white"
          >
            Keluar
          </button>
        </div>
      </header>

      <ErrorMsg msg={error} />

      {pendingSession && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950/60">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Sesi foto masih berjalan.</p>
          <Btn onClick={() => goCapture(pendingSession.sessionDbId)} className="min-h-[38px] w-auto px-4 py-1.5 text-xs">
            Lanjut sesi foto
          </Btn>
        </div>
      )}

      {celebrate && (
        <p role="status" className="countdown-num shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-center text-xs sm:text-sm font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-sm">
          {partner?.displayName ?? "Temanmu"} telah masuk ke booth! ✦
        </p>
      )}

      {/* Main Booth Body: Dual Cameras & Right Console */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 sm:gap-3 md:flex-row lg:gap-6">
        {/* Dual Camera Stage: Side-by-Side on all viewports */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 gap-2 sm:gap-3 md:grid-cols-2 md:grid-rows-1 lg:gap-6">
          <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden [container-type:size]">
            <CameraView
              videoRef={cam.videoRef}
              stream={cam.stream}
              ready={cameraReady}
              label={`Kamu ${iAmHost ? "(Host)" : ""}`}
              mirrored={cam.mirrored}
              onToggleMirror={cam.toggleMirror}
              ratio={cam.ratio}
              onCycleRatio={iAmHost ? cam.cycleRatio : undefined}
              onStartCamera={() => cam.start().then((ok) => ok && track("camera_ready", bundle.roomId))}
              message={cam.message}
            />
          </div>
          <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden [container-type:size]">
            <RemoteView
              remoteStream={call.remoteStream}
              status={call.status}
              name={partner?.displayName ?? "Teman"}
              onRetry={call.retry}
              ratio={cam.ratio}
              roomCode={code}
              shareLink={shareLink}
              onCopyLink={copyLink}
              copied={copied}
              hasPartner={Boolean(partner)}
              onShowQr={() => setShowQr(true)}
            />
          </div>
        </div>

        {/* Control Console */}
        <div className="flex shrink-0 flex-col gap-2 sm:gap-3 landscape:min-h-0 landscape:w-64 landscape:justify-center landscape:overflow-y-auto md:min-h-0 md:w-72 md:justify-center md:overflow-y-auto lg:w-84 lg:overflow-visible">
          {/* Consolidated Participant & Invitation Card */}
          <div className="booth-card rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                Peserta di Booth (Maks. 2)
              </p>
              <span className="text-[10px] font-semibold text-booth-muted">
                {partner ? "2/2 Siap" : "1/2 Menunggu"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-3">
              {/* Host */}
              <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-0 rounded-xl bg-black/[0.02] sm:bg-transparent dark:bg-white/[0.02] sm:dark:bg-transparent">
                <div className="font-display flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-booth-ink text-xs sm:text-sm font-bold text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night" aria-hidden>
                  {initial(bundle.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold truncate text-booth-ink dark:text-booth-cream">
                    {bundle.displayName}{" "}
                    <span className="text-[10px] sm:text-xs font-normal text-booth-muted">({bundle.role})</span>
                  </p>
                  <Dot on={cameraReady} label={cameraReady ? "Kamera siap" : "Kamera mati"} />
                </div>
              </div>

              {/* Guest */}
              <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-0 rounded-xl bg-black/[0.02] sm:bg-transparent dark:bg-white/[0.02] sm:dark:bg-transparent">
                <div className="font-display flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-booth-line text-xs sm:text-sm font-bold text-booth-muted dark:border-booth-nightline dark:text-booth-creamdim" aria-hidden>
                  {partner ? initial(partner.displayName) : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold truncate text-booth-ink dark:text-booth-cream">
                    {partner ? partner.displayName : "Menunggu Teman…"}
                  </p>
                  <Dot on={Boolean(partnerPeer && partnerPeer.cameraReady)} label={partnerPeer ? (partnerPeer.cameraReady ? "Kamera siap" : "Kamera mati") : "Belum gabung"} />
                </div>
              </div>
            </div>

            {/* Quick Share Link Row */}
            <div className="mt-2.5 pt-2 border-t border-booth-line/60 dark:border-booth-nightline/60 flex items-center gap-1.5">
              <div className="min-w-0 flex-1 rounded-xl border border-booth-line bg-black/[0.02] px-2.5 py-1.5 text-xs font-semibold tabular-nums truncate dark:border-booth-nightline dark:bg-white/[0.04]">
                {shareLink}
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-booth-line bg-booth-card hover:bg-black/[0.04] transition active:scale-95 dark:border-booth-nightline dark:bg-booth-nightcard cursor-pointer"
                title={copied ? "Tautan tersalin" : "Salin tautan"}
              >
                {copied ? <CheckIcon size={14} className="text-emerald-500" /> : <CopyIcon size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="flex h-8 px-2.5 shrink-0 items-center justify-center gap-1 rounded-xl border border-booth-line bg-booth-card text-xs font-semibold text-booth-ink hover:bg-black/[0.04] transition active:scale-95 dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream cursor-pointer"
                title="Tampilkan QR Code untuk dipindai kamera HP teman"
              >
                <span>📱 QR</span>
              </button>
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.share({ title: `Photobooth Room ${code}`, url: shareLink }).catch(() => {});
                  }}
                  className="flex h-8 px-2.5 shrink-0 items-center justify-center gap-1 rounded-xl border border-booth-line bg-booth-card text-xs font-semibold text-booth-ink hover:bg-black/[0.04] transition active:scale-95 dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream cursor-pointer"
                  title="Bagikan tautan"
                >
                  <span>Bagikan</span>
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] sm:text-[11px] text-booth-muted dark:text-booth-creamdim">
              {copied ? "✓ Tautan berhasil disalin ke clipboard!" : "Kirim tautan ini atau perlihatkan QR code ke temanmu."}
            </p>
          </div>

          {/* Audio Controls */}
          {cameraReady && cam.audioOn && (
            <button
              type="button"
              onClick={cam.toggleMute}
              className="flex min-h-[40px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-booth-line bg-booth-card px-3 py-2 text-xs font-semibold text-booth-ink hover:bg-black/[0.04] transition active:translate-y-px dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream cursor-pointer"
            >
              {cam.muted ? <MicOffIcon size={16} className="text-red-500" /> : <MicIcon size={16} className="text-emerald-500" />}
              <span>{cam.muted ? "Mikrofon Bisu (Ketuk untuk Bicara)" : "Mikrofon Aktif (Bisa Mengobrol)"}</span>
            </button>
          )}

          {/* Mode Jepret & Timer Controls */}
          {iAmHost ? (
            <div className="booth-card rounded-2xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                  Mode Jepret
                </span>
                <span className="text-[10px] font-semibold text-booth-accent">
                  {captureMode === "auto" ? "✨ Otomatis" : "📸 Manual"}
                </span>
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-booth-line bg-black/[0.03] p-1 dark:border-booth-nightline dark:bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("auto");
                    if (timerOption === 0) setTimerOption(3);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${
                    captureMode === "auto"
                      ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                      : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
                  }`}
                >
                  <span>✨ Otomatis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode("manual")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${
                    captureMode === "manual"
                      ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                      : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
                  }`}
                >
                  <span>📸 Manual</span>
                </button>
              </div>

              {/* Timer Row */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <span className="text-[10px] font-semibold text-booth-muted dark:text-booth-creamdim shrink-0">
                  Timer:
                </span>
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {TIMER_OPTIONS.map((t) => {
                    const isSelected = timerOption === t.val;
                    const isDisabled = captureMode === "auto" && t.val === 0;
                    return (
                      <button
                        key={t.val}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setTimerOption(t.val)}
                        title={isDisabled ? "0s khusus mode manual" : `${t.label} - ${t.desc}`}
                        className={`rounded-lg py-1 px-1 text-center transition ${
                          isSelected
                            ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night font-bold"
                            : isDisabled
                              ? "opacity-30 cursor-not-allowed text-booth-muted font-medium"
                              : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim border border-booth-line/60 dark:border-booth-nightline/60 font-medium cursor-pointer"
                        }`}
                      >
                        <span className="text-[11px] tabular-nums block font-bold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-booth-line/60 bg-black/[0.02] px-3 py-2 text-center text-xs font-medium text-booth-muted dark:border-booth-nightline/60 dark:text-booth-creamdim space-y-0.5">
              <p>
                Mode:{" "}
                <strong className="text-booth-ink dark:text-booth-cream">
                  {captureMode === "auto" ? "✨ Otomatis" : "📸 Manual"} ({timerOption}s)
                </strong>
              </p>
              <p className="text-[10px]">Rasio ({cam.ratio}) & Mode diatur oleh Host</p>
            </div>
          )}

          {/* Action Launch Console */}
          <div className="mt-auto pt-0.5 flex flex-col gap-1.5 sm:gap-2">
            {iAmHost ? (
              <>
                <Btn
                  tone="accent"
                  onClick={doStart}
                  disabled={!bothCamerasReady || starting || !cameraReady}
                  className="text-sm sm:text-base py-3 sm:py-3.5 shadow-lg"
                >
                  {starting
                    ? "Menyiapkan Sesi…"
                    : bothCamerasReady
                      ? captureMode === "auto"
                        ? `Mulai Foto Otomatis (${timerOption}s)`
                        : `Mulai Foto Manual (${timerOption}s)`
                      : !cameraReady
                        ? "Nyalakan Kameramu Dulu"
                        : partner
                          ? "Menunggu Kamera Teman…"
                          : "Menunggu Teman Bergabung…"}
                </Btn>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] sm:text-[11px] text-booth-muted dark:text-booth-creamdim">
                    {bothCamerasReady ? "Kedua kamera siap jepret!" : "Tombol aktif saat berdua siap."}
                  </p>
                  <button
                    onClick={doEnd}
                    disabled={ending}
                    className="text-[10px] sm:text-[11px] font-semibold text-booth-muted hover:text-red-600 transition dark:text-booth-creamdim cursor-pointer"
                  >
                    {ending ? "Mengakhiri…" : "Akhiri Booth"}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-booth-line p-3 text-center bg-booth-card dark:border-booth-nightline dark:bg-booth-nightcard">
                <p className="text-xs font-semibold text-booth-ink dark:text-booth-cream">
                  {bothCamerasReady
                    ? "✦ Kalian berdua sudah siap! Menunggu host menekan mulai."
                    : "Menunggu kamera siap & host memulai sesi foto…"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={showQr}
        onClose={() => setShowQr(false)}
        value={typeof window !== "undefined" ? window.location.href : shareLink}
        code={code}
        title="Masuk ke Bilik Foto"
        subtitle="Arahkan kamera HP temanmu ke QR Code ini untuk langsung bergabung ke booth."
      />
    </main>
  );
}
