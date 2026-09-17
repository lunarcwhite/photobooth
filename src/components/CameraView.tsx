"use client";

import { memo, useEffect, useState } from "react";
import type { PhotoRatio } from "@/hooks/useCamera";
import { IconBtn, Btn } from "@/components/ui";
import { CameraIcon, LockIcon, MirrorIcon } from "@/components/icons";
import { CameraTroubleshootModal } from "@/components/CameraTroubleshootModal";

// Local preview. File output always matches preview (center crop in captureShot).
// memo: parent ticks `now` 1–10x/detik — video element must not re-render on tick.
export const CameraView = memo(function CameraView({
  videoRef,
  stream,
  ready,
  label,
  mirrored,
  onToggleMirror,
  ratio,
  onCycleRatio,
  onStartCamera,
  message,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  ready: boolean;
  label: string;
  mirrored: boolean;
  onToggleMirror?: () => void;
  ratio?: PhotoRatio;
  onCycleRatio?: () => void;
  onStartCamera?: () => void;
  message?: string | null;
}) {
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const r = ratio ?? "3:4";
  // Two-dimensional fit via container query: width = min(100%, cell height x ratio).
  const size =
    r === "1:1"
      ? "aspect-square w-[min(100%,100cqh)]"
      : r === "9:16"
        ? "aspect-[9/16] w-[min(100%,56.25cqh)]"
        : "aspect-[3/4] w-[min(100%,75cqh)]";

  // Re-attach + replay on every stream/ready change — fixes mount/start race.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.muted = true;
    const tryPlay = () => {
      v.play().catch(() => {
        /* autoplay denied — user taps video to play */
      });
    };
    tryPlay();
    v.addEventListener("loadedmetadata", tryPlay);
    return () => v.removeEventListener("loadedmetadata", tryPlay);
  }, [videoRef, stream, ready]);

  const tapPlay = () => {
    videoRef.current?.play().catch(() => {});
  };

  return (
    <div className={`relative ${size} max-h-full max-w-full shrink-0 overflow-hidden rounded-2xl border-2 border-booth-line bg-booth-night shadow-print dark:border-booth-nightline`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onClick={tapPlay}
        title="Ketuk jika video hitam"
        className={`h-full w-full cursor-pointer object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-6 text-center bg-booth-night text-booth-creamdim z-10">
          <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 text-white shadow-inner">
            <CameraIcon size={20} className="sm:hidden" />
            <CameraIcon size={28} className="hidden sm:block" />
          </div>
          <div className="w-full max-w-[240px] px-1">
            <p className="font-display text-sm sm:text-lg font-bold text-white tracking-wide">Kamera Belum Aktif</p>
            <p className="text-[11px] sm:text-xs text-white/60 mt-0.5 sm:mt-1 leading-snug">
              {message ?? "Izinkan akses kamera untuk melangkah masuk ke booth"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5 mt-0.5 sm:mt-1">
            {onStartCamera && (
              <Btn
                tone="accent"
                onClick={onStartCamera}
                className="min-h-[36px] sm:min-h-[42px] w-auto px-3.5 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold shadow-lg"
              >
                Aktifkan Kamera
              </Btn>
            )}
            <button
              type="button"
              onClick={() => setShowTroubleshoot(true)}
              className="text-[10px] sm:text-[11px] font-semibold text-white/70 hover:text-white underline underline-offset-2 transition cursor-pointer py-0.5"
            >
              Kamera diblokir? Bantuan izin
            </button>
          </div>
        </div>
      )}
      <CameraTroubleshootModal
        isOpen={showTroubleshoot}
        onClose={() => setShowTroubleshoot(false)}
      />
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 rounded-lg bg-black/75 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold tracking-wider text-white backdrop-blur-xs flex items-center gap-1.5 shadow-sm max-w-[70%] truncate">
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="truncate">{label}</span>
      </div>
      {onCycleRatio ? (
        <IconBtn
          variant="overvideo"
          label={`Rasio foto ${r} — ketuk untuk ganti`}
          onClick={onCycleRatio}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 h-7 min-w-7 sm:h-8 sm:min-w-8 px-1.5 sm:px-2 text-[10px] sm:text-xs font-bold tabular-nums rounded-lg"
        >
          {r}
        </IconBtn>
      ) : (
        <div
          title="Rasio mengikuti host"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 rounded-lg bg-black/75 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white/90 backdrop-blur-xs shadow-sm"
        >
          <LockIcon size={11} />
          <span className="tabular-nums">{r}</span>
        </div>
      )}
      {onToggleMirror && ready && (
        <IconBtn
          variant="overvideo"
          label={mirrored ? "Mode cermin aktif — ketuk untuk normal" : "Mode normal — ketuk untuk cermin"}
          onClick={onToggleMirror}
          className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 h-7 min-w-7 sm:h-8 sm:min-w-8 px-1.5 sm:px-2 rounded-lg"
        >
          <MirrorIcon size={14} className="sm:hidden" />
          <MirrorIcon size={16} className="hidden sm:block" />
        </IconBtn>
      )}
    </div>
  );
});
