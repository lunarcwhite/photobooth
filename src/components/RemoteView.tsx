"use client";

import { memo, useEffect, useRef } from "react";
import type { CallStatus } from "@/hooks/usePeerCall";
import type { PhotoRatio } from "@/hooks/useCamera";
import { IconBtn } from "@/components/ui";
import { ClockIcon, RefreshIcon, UserIcon, CopyIcon, CheckIcon } from "@/components/icons";

// Partner video over WebRTC P2P. Remote is NOT mirrored — shown as the owner sees it.
// memo: same tick reason as CameraView — skip re-render while status/stream stable.
export const RemoteView = memo(function RemoteView({
  remoteStream,
  status,
  name,
  onRetry,
  ratio,
  roomCode,
  onCopyLink,
  copied,
  hasPartner,
}: {
  remoteStream: MediaStream | null;
  status: CallStatus;
  name: string;
  onRetry: () => void;
  ratio?: PhotoRatio;
  roomCode?: string;
  shareLink?: string;
  onCopyLink?: () => void;
  copied?: boolean;
  hasPartner?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const r = ratio ?? "3:4";
  // Two-dimensional fit via container query, same as CameraView.
  const size =
    r === "1:1"
      ? "aspect-square w-[min(100%,100cqh)]"
      : r === "9:16"
        ? "aspect-[9/16] w-[min(100%,56.25cqh)]"
        : "aspect-[3/4] w-[min(100%,75cqh)]";

  useEffect(() => {
    const v = ref.current;
    if (!v || !remoteStream) return;
    if (v.srcObject !== remoteStream) v.srcObject = remoteStream;
    const tryPlay = () => {
      v.play().catch(() => {
        /* autoplay denied — user taps video to play */
      });
    };
    tryPlay();
    v.addEventListener("loadedmetadata", tryPlay);
    return () => v.removeEventListener("loadedmetadata", tryPlay);
  }, [remoteStream, status]);

  const tapPlay = () => {
    ref.current?.play().catch(() => {});
  };

  const showVideo = remoteStream !== null && status === "connected";

  return (
    <div className={`relative ${size} max-h-full max-w-full shrink-0 overflow-hidden rounded-2xl border-2 border-booth-line bg-booth-night shadow-print dark:border-booth-nightline`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        onClick={tapPlay}
        title="Ketuk jika video hitam"
        className={`h-full w-full cursor-pointer object-cover ${showVideo ? "" : "hidden"}`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-6 text-center text-booth-creamdim z-10">
          {!hasPartner && roomCode ? (
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 w-full max-w-[260px] px-1">
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl border border-dashed border-white/25 text-white/60 bg-white/5">
                <UserIcon size={18} className="sm:hidden" />
                <UserIcon size={26} className="hidden sm:block" />
              </div>
              <div>
                <p className="font-display text-sm sm:text-xl font-bold text-white tracking-wide">Menunggu Teman</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">Bagikan kode booth ini:</p>
              </div>
              <div className="font-display text-base sm:text-2xl font-bold tracking-[0.15em] sm:tracking-[0.25em] text-booth-accent bg-black/50 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl border border-white/10 tabular-nums shadow-inner">
                {roomCode}
              </div>
              {onCopyLink && (
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="mt-0.5 sm:mt-1 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold text-white hover:bg-white/20 active:scale-95 transition cursor-pointer"
                >
                  {copied ? <CheckIcon size={14} className="text-emerald-400" /> : <CopyIcon size={14} />}
                  <span>{copied ? "Tersalin!" : "Salin Link"}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-2.5 w-full max-w-[240px] px-1">
              <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-white/10 text-white">
                {status === "calling" ? <ClockIcon size={20} /> : <UserIcon size={20} />}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-white leading-snug">
                {status === "calling"
                  ? "Menyambungkan video teman…"
                  : status === "failed"
                    ? "Video teman gagal tersambung."
                    : `${name} sedang menyiapkan kamera…`}
              </p>
              {status === "failed" && (
                <IconBtn variant="overvideo" label="Coba sambungkan video lagi" onClick={onRetry} className="h-8 sm:h-9 text-xs px-2.5 sm:px-3">
                  <RefreshIcon size={14} />
                  Coba lagi
                </IconBtn>
              )}
            </div>
          )}
        </div>
      )}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 rounded-lg bg-black/75 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold tracking-wider text-white backdrop-blur-xs flex items-center gap-1.5 shadow-sm max-w-[70%] truncate">
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${showVideo ? "bg-emerald-400" : hasPartner ? "bg-amber-400" : "bg-white/40"}`} />
        <span className="truncate">{name}</span>
      </div>
    </div>
  );
});
