"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCamera } from "@/hooks/useCamera";
import { blobToDataURL } from "@/lib/storage/exchange";
import { saveShotsBundle } from "@/lib/room/bundle";
import { track } from "@/lib/analytics/events";
import { Btn, GhostBtn, ErrorMsg, StepBadge, Segmented } from "@/components/ui";
import { CameraView } from "@/components/CameraView";
import { CameraIcon, CheckIcon, ClockIcon, RefreshIcon } from "@/components/icons";
import { POSE_GUIDES } from "@/types/template";

// Mode satu HP (PRD §5): satu kamera, berdua dalam satu bingkai,
// 4 jepretan strip. Mendukung mode Otomatis dan Manual (tombol shutter)
// dengan opsi waktu tunggu/timer (0s, 3s, 5s, 10s).
const CODE = "SAMA";

type CaptureMode = "auto" | "manual";
type TimerOption = 0 | 3 | 5 | 10;

const TIMER_OPTIONS: { val: TimerOption; label: string; desc: string }[] = [
  { val: 0, label: "0s", desc: "Instan" },
  { val: 3, label: "3s", desc: "Cepat" },
  { val: 5, label: "5s", desc: "Standar" },
  { val: 10, label: "10s", desc: "Santai" },
];

export default function SamaPage() {
  const router = useRouter();
  const cam = useCamera();
  const cameraReady = cam.status === "ready";

  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("auto");
  const [timerOption, setTimerOption] = useState<TimerOption>(3);
  const [shotIndex, setShotIndex] = useState(0);
  const [count, setCount] = useState<number>(3);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [shots, setShots] = useState<(string | null)[]>([null, null, null, null]);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Sync refs to avoid stale closures in async/timeout callbacks
  const captureModeRef = useRef(captureMode);
  captureModeRef.current = captureMode;

  const timerOptionRef = useRef(timerOption);
  timerOptionRef.current = timerOption;

  const shotIndexRef = useRef(shotIndex);
  shotIndexRef.current = shotIndex;

  // Kamera auto-start saat halaman dibuka.
  useEffect(() => {
    cam.start().then((ok) => ok && track("camera_ready", null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eksekusi pengambilan foto
  const executeCapture = useCallback(
    async (targetIndex: number) => {
      if (!cameraReady || isCapturing) return;
      setIsCapturing(true);
      setIsCountingDown(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);

      try {
        const blob = await cam.captureShot();
        const url = await blobToDataURL(blob);
        setShots((prev) => {
          const next = [...prev];
          next[targetIndex] = url;
          return next;
        });
        track("capture_completed", null, {
          shot: targetIndex + 1,
          solo: true,
          mode: captureModeRef.current,
          timer: timerOptionRef.current,
        });

        if (targetIndex >= 3) {
          setPhase("done");
          setIsCountingDown(false);
        } else {
          const nextIndex = targetIndex + 1;
          setShotIndex(nextIndex);
          if (captureModeRef.current === "auto") {
            const wait = timerOptionRef.current === 0 ? 3 : timerOptionRef.current;
            setCount(wait);
            setIsCountingDown(true);
          } else {
            setIsCountingDown(false);
            setCount(timerOptionRef.current);
          }
        }
      } catch {
        setError(`Foto ${targetIndex + 1} gagal diambil. Coba jepret lagi.`);
        setIsCountingDown(false);
      } finally {
        setIsCapturing(false);
      }
    },
    [cam, cameraReady, isCapturing],
  );

  // Mesin hitung mundur (countdown runner)
  useEffect(() => {
    if (phase !== "running" || !cameraReady || !isCountingDown || isCapturing) return;

    if (count > 0) {
      const id = setTimeout(() => setCount((c) => c - 1), 1000);
      return () => clearTimeout(id);
    }

    // count === 0: waktu habis, jepret foto!
    void executeCapture(shotIndexRef.current);
  }, [phase, cameraReady, isCountingDown, count, isCapturing, executeCapture]);

  // Handler memicu jepretan di mode manual
  const triggerManualShot = useCallback(() => {
    if (phase !== "running" || !cameraReady || isCapturing || isCountingDown) return;
    setError(null);
    if (timerOptionRef.current === 0) {
      void executeCapture(shotIndexRef.current);
    } else {
      setCount(timerOptionRef.current);
      setIsCountingDown(true);
    }
  }, [phase, cameraReady, isCapturing, isCountingDown, executeCapture]);

  // Handler membatalkan hitung mundur
  const cancelCountdown = useCallback(() => {
    setIsCountingDown(false);
    setCount(timerOptionRef.current === 0 ? 3 : timerOptionRef.current);
  }, []);

  // Handler ganti mode jepret
  const switchMode = useCallback((newMode: CaptureMode) => {
    setCaptureMode(newMode);
    if (newMode === "manual") {
      setIsCountingDown(false);
      setCount(timerOptionRef.current);
    } else {
      const wait = timerOptionRef.current === 0 ? 3 : timerOptionRef.current;
      setCount(wait);
      setIsCountingDown(true);
    }
  }, []);

  // Handler ganti waktu tunggu
  const changeTimer = useCallback((sec: TimerOption) => {
    setTimerOption(sec);
    setCount(sec);
  }, []);

  // Keyboard shortcut: Spacebar / Enter untuk shutter manual
  useEffect(() => {
    if (phase !== "running" || captureMode !== "manual" || isCountingDown || isCapturing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        triggerManualShot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, captureMode, isCountingDown, isCapturing, triggerManualShot]);

  const start = () => {
    setError(null);
    setShots([null, null, null, null]);
    setShotIndex(0);
    setPhase("running");
    if (captureMode === "auto") {
      const wait = timerOption === 0 ? 3 : timerOption;
      setCount(wait);
      setIsCountingDown(true);
    } else {
      setCount(timerOption);
      setIsCountingDown(false);
    }
    track("session_started", null, { solo: true, mode: captureMode, timer: timerOption });
  };

  const resetSession = () => {
    setIsCountingDown(false);
    setIsCapturing(false);
    setShots([null, null, null, null]);
    setShotIndex(0);
    setCount(timerOption === 0 ? 3 : timerOption);
    setPhase("idle");
    setError(null);
  };

  const finish = () => {
    if (finishing || phase !== "done") return;
    setFinishing(true);
    const n1 = name1.trim();
    const n2 = name2.trim();
    const myName = n1 && n2 ? `${n1} & ${n2}` : n1 || n2 || "Kamu & Teman";
    const date = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    saveShotsBundle(CODE, {
      code: CODE,
      sessionDbId: `solo-${Date.now()}`,
      date,
      myRole: "host",
      myName,
      partnerName: "",
      myShots: shots,
      partnerShots: shots,
      partnerId: null,
      partnerPaths: [null, null, null, null],
      roomId: null,
      ratio: cam.ratio,
      solo: true,
    });
    track("session_completed", null, { solo: true });
    router.push("/room/sama/result");
  };

  const doneCount = shots.filter(Boolean).length;
  const currentPose = POSE_GUIDES[Math.min(3, Math.max(0, shotIndex))];

  return (
    <main className="flex h-dvh w-full flex-col gap-2.5 overflow-hidden px-3 py-2 sm:px-6 sm:py-3 md:px-8 lg:gap-4 lg:px-12 xl:mx-auto xl:max-w-[1400px] xl:px-14">
      {/* Top Bar Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-booth-line/60 pb-2.5 dark:border-booth-nightline/60">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim">
              <span className="text-booth-accent font-bold">1/2</span>
              <span className="opacity-40">·</span>
              <span className="truncate">Satu HP Berdua</span>
            </div>
            <h1 className="font-display pt-1 truncate text-sm sm:text-base font-bold tracking-tight text-booth-ink dark:text-booth-cream">
              {phase === "done"
                ? "Dapat! Semua 4 foto jadi ✦"
                : phase === "running"
                  ? `Foto ${shotIndex + 1}: ${currentPose.emoji} ${currentPose.title}`
                  : "Berdua dalam satu kamera"}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Progress Indicator */}
          <div
            className="flex items-center gap-1.5 rounded-xl border border-booth-line bg-booth-card/60 px-2.5 py-1 sm:px-3.5 sm:py-1.5 dark:border-booth-nightline dark:bg-booth-nightcard/60"
            aria-label={`Progres ${doneCount} dari 4 foto`}
          >
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`h-2 w-2 sm:w-6 rounded-full transition-all duration-300 ${
                    shots[i]
                      ? "bg-emerald-500 shadow-xs"
                      : i === shotIndex && phase === "running"
                        ? "bg-booth-accent scale-110 animate-pulse"
                        : "bg-booth-line dark:bg-booth-nightline"
                  }`}
                />
              ))}
            </div>
            <span className="ml-1 text-[11px] sm:text-xs font-bold tabular-nums text-booth-ink dark:text-booth-cream">
              {doneCount}/4
            </span>
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-booth-line px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-booth-muted hover:text-booth-ink hover:bg-black/[0.04] transition dark:border-booth-nightline dark:text-booth-creamdim dark:hover:text-white shrink-0"
          >
            Keluar
          </button>
        </div>
      </header>

      <ErrorMsg msg={error} />

      {/* Main Studio Area */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:flex-row lg:gap-6 overflow-hidden">
        {/* Central Camera Stage */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden [container-type:size]">
          <CameraView
            videoRef={cam.videoRef}
            stream={cam.stream}
            ready={cameraReady}
            label={
              !cameraReady
                ? "Kamera Belum Aktif"
                : phase === "running"
                  ? `Foto ${shotIndex + 1}/4 · ${captureMode === "auto" ? "Auto" : "Manual"}`
                  : "Kalian Berdua"
            }
            mirrored={cam.mirrored}
            onToggleMirror={cam.toggleMirror}
            ratio={cam.ratio}
            onCycleRatio={cam.cycleRatio}
            onStartCamera={() => cam.start().then((ok) => ok && track("camera_ready", null))}
            message={cam.message}
          />

          {/* Non-Intrusive Countdown Overlay (Does not block faces / viewfinder preview) */}
          {cameraReady && phase === "running" && isCountingDown && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-between p-2.5 sm:p-4 z-20">
              {/* Sleek Top Floating Pill (Above eye/head level) */}
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/65 px-3 py-1 sm:px-4 sm:py-1.5 text-white backdrop-blur-md border border-white/20 shadow-md">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/90">
                  Foto {shotIndex + 1}: {currentPose?.emoji} {currentPose?.title}
                </span>
                <span className="text-white/30">•</span>
                <span className="text-[10px] sm:text-xs font-medium text-amber-300">
                  {count > 0 ? "Pasang pose kalian!" : "Jepret!"}
                </span>
              </div>

              {/* Compact Center Countdown Badge */}
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm border border-white/25 shadow-xl">
                <span
                  key={`${shotIndex}-${count}`}
                  className="countdown-num font-display text-2xl sm:text-4xl font-extrabold tabular-nums text-white"
                  aria-live="polite"
                >
                  {count > 0 ? count : "✦"}
                </span>
              </div>

              {/* Bottom Cancel Pill */}
              <button
                type="button"
                onClick={cancelCountdown}
                className="rounded-full bg-black/60 px-3.5 py-1 text-[11px] font-semibold text-white/90 hover:text-white backdrop-blur-md border border-white/20 shadow-md cursor-pointer transition hover:bg-black/80 active:scale-95"
              >
                Batal / Pose Ulang
              </button>
            </div>
          )}

          {flash && (
            <div className="pointer-events-none absolute inset-0 bg-white z-30 transition-opacity duration-150" aria-hidden />
          )}
        </div>

        {/* Console & Controls Panel */}
        <div className="flex shrink-0 flex-col gap-2.5 landscape:min-h-0 landscape:w-56 landscape:justify-center landscape:overflow-y-auto md:min-h-0 md:w-64 md:justify-center md:overflow-y-auto lg:w-80 lg:overflow-visible">
          {/* Phase: IDLE (Pengaturan sebelum mulai) */}
          {phase === "idle" && (
            <div className="booth-card rounded-2xl p-3.5 sm:p-4 space-y-3">
              {/* Names input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block">
                  Nama Kalian (Opsional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={name1}
                    onChange={(e) => setName1(e.target.value)}
                    placeholder="Nama 1"
                    maxLength={15}
                    aria-label="Nama pertama"
                    className="w-full rounded-xl border border-booth-line bg-booth-card px-3 py-2 text-xs font-semibold outline-none placeholder:font-normal placeholder:text-booth-muted/70 focus:border-booth-accent dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream"
                  />
                  <input
                    value={name2}
                    onChange={(e) => setName2(e.target.value)}
                    placeholder="Nama 2"
                    maxLength={15}
                    aria-label="Nama kedua"
                    className="w-full rounded-xl border border-booth-line bg-booth-card px-3 py-2 text-xs font-semibold outline-none placeholder:font-normal placeholder:text-booth-muted/70 focus:border-booth-accent dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream"
                  />
                </div>
              </div>

              {/* Mode & Timer Controls */}
              <div className="space-y-2 pt-1.5 border-t border-booth-line/50 dark:border-booth-nightline/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                    Mode Jepret
                  </span>
                  <span className="text-[10px] font-medium text-booth-muted">
                    {captureMode === "auto" ? "Otomatis 4 Foto" : "Manual (Shutter)"}
                  </span>
                </div>

                <Segmented
                  label="Pilih mode jepret"
                  value={captureMode}
                  onChange={(v) => {
                    const mode = v as CaptureMode;
                    setCaptureMode(mode);
                    if (mode === "auto" && timerOption === 0) {
                      setTimerOption(3);
                    }
                  }}
                  options={[
                    { value: "auto", label: "✨ Otomatis" },
                    { value: "manual", label: "📸 Manual" },
                  ]}
                />

                {/* Timer row */}
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
                          className={`rounded-lg py-1.5 px-1 text-center transition ${
                            isSelected
                              ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night font-bold"
                              : isDisabled
                                ? "opacity-30 cursor-not-allowed text-booth-muted font-medium"
                                : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim border border-booth-line/60 dark:border-booth-nightline/60 font-medium"
                          }`}
                        >
                          <span className="text-[11px] tabular-nums block font-bold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase: RUNNING & DONE (Live Filmstrip Progress) */}
          {(phase === "running" || phase === "done") && (
            <div className="booth-card rounded-2xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                  Strip Foto ({doneCount}/4)
                </span>
                <span className="text-[10px] font-medium text-booth-muted">
                  Rasio: {cam.ratio}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const done = Boolean(shots[i]);
                  const isActive = i === shotIndex && phase === "running";
                  const ar =
                    cam.ratio === "1:1"
                      ? "aspect-square"
                      : cam.ratio === "9:16"
                        ? "aspect-[9/16]"
                        : "aspect-[3/4]";
                  return (
                    <div
                      key={i}
                      className={`relative w-full ${ar} max-h-16 overflow-hidden rounded-xl border-2 transition-all duration-200 bg-booth-night shadow-sm ${
                        done
                          ? "border-emerald-500 shadow-emerald-500/10"
                          : isActive
                            ? "border-booth-accent ring-2 ring-booth-accent/40"
                            : "border-booth-line/60 dark:border-booth-nightline/60"
                      }`}
                    >
                      {shots[i] ? (
                        <img
                          src={shots[i]!}
                          alt={`Foto ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/40">
                          {isActive ? (
                            <CameraIcon size={18} className="text-booth-accent animate-pulse" />
                          ) : (
                            <span className="text-[10px] font-bold tabular-nums">#{i + 1}</span>
                          )}
                        </div>
                      )}
                      {done && (
                        <span className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <CheckIcon size={10} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phase: RUNNING (Couple Pose Guide Card) */}
          {phase === "running" && currentPose && (
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
            </div>
          )}

          {/* Phase: RUNNING (Quick Mode & Timer Switcher) */}
          {phase === "running" && (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="inline-flex rounded-xl border border-booth-line bg-black/[0.04] p-0.5 dark:border-booth-nightline dark:bg-white/[0.05]">
                <button
                  type="button"
                  onClick={() => switchMode("auto")}
                  className={`rounded-lg py-1 px-2.5 text-[11px] font-semibold transition ${
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
                  className={`rounded-lg py-1 px-2.5 text-[11px] font-semibold transition ${
                    captureMode === "manual"
                      ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                      : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
                  }`}
                >
                  📸 Manual
                </button>
              </div>

              <div className="flex items-center gap-1">
                {TIMER_OPTIONS.map((t) => {
                  const isSelected = timerOption === t.val;
                  const isDisabled = captureMode === "auto" && t.val === 0;
                  return (
                    <button
                      key={t.val}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => changeTimer(t.val)}
                      className={`rounded-lg py-1 px-2 text-[10px] font-bold tabular-nums transition ${
                        isSelected
                          ? "bg-booth-accent text-white shadow-xs"
                          : isDisabled
                            ? "opacity-30 cursor-not-allowed text-booth-muted"
                            : "border border-booth-line/60 text-booth-muted dark:border-booth-nightline/60 dark:text-booth-creamdim"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Launch Buttons */}
          <div className="mt-auto pt-1 flex flex-col gap-2">
            {!cameraReady ? (
              <Btn
                tone="accent"
                onClick={() => cam.start().then((ok) => ok && track("camera_ready", null))}
                className="text-sm sm:text-base py-3 shadow-lg"
              >
                <CameraIcon size={18} />
                Nyalakan Kamera
              </Btn>
            ) : phase === "idle" ? (
              <Btn tone="accent" onClick={start} className="text-sm sm:text-base py-3 sm:py-3.5 shadow-lg">
                <CameraIcon size={18} />
                Mulai Sesi Foto
              </Btn>
            ) : phase === "done" ? (
              <div className="flex flex-col gap-2">
                <Btn tone="accent" onClick={finish} disabled={finishing} className="text-sm sm:text-base py-3 sm:py-3.5 shadow-lg">
                  {finishing ? "Menyiapkan Hasil…" : "Lihat Hasil Foto ✦"}
                </Btn>
                <GhostBtn onClick={resetSession} className="text-xs font-semibold py-2">
                  <RefreshIcon size={14} />
                  Ulangi Sesi Foto
                </GhostBtn>
              </div>
            ) : captureMode === "manual" ? (
              <div className="flex flex-col gap-2">
                {isCountingDown ? (
                  <>
                    <Btn tone="accent" disabled className="text-sm sm:text-base py-3 animate-pulse">
                      <ClockIcon size={18} />
                      Hitung Mundur… ({count}s)
                    </Btn>
                    <GhostBtn onClick={cancelCountdown} className="text-xs font-semibold py-1.5">
                      Batal / Pose Ulang
                    </GhostBtn>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={triggerManualShot}
                    disabled={isCapturing}
                    className="flex min-h-[48px] sm:min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-booth-accent text-white px-5 py-3 font-bold text-sm sm:text-base shadow-[0_2px_12px_rgba(255,92,53,0.35)] hover:bg-booth-accent-deep active:scale-98 transition disabled:opacity-50 cursor-pointer"
                  >
                    <CameraIcon size={20} />
                    {isCapturing
                      ? "Mengambil Foto…"
                      : `Jepret Foto ${shotIndex + 1} (${timerOption === 0 ? "Instan" : `${timerOption}s`})`}
                    <span className="hidden sm:inline text-xs font-normal opacity-75">· Spasi</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-booth-accent/30 bg-booth-accent/10 p-2.5 text-center text-xs font-semibold text-booth-accent">
                  Otomatis — foto {shotIndex + 1} dalam {count}s…
                </div>
                <GhostBtn onClick={() => switchMode("manual")} className="text-xs font-semibold py-1.5">
                  Beralih ke Jepret Manual
                </GhostBtn>
              </div>
            )}

            {phase === "idle" && doneCount === 0 && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="hidden sm:block text-center text-xs font-medium text-booth-muted hover:text-booth-ink dark:text-booth-creamdim py-1 transition"
              >
                Kembali ke Beranda
              </button>
            )}

            {phase === "running" && (
              <button
                type="button"
                onClick={resetSession}
                className="text-center text-xs font-semibold text-booth-muted hover:text-booth-ink dark:text-booth-creamdim py-1 transition"
              >
                Batalkan Sesi Foto
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
