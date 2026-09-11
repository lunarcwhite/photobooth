"use client";

import { useEffect, useRef } from "react";

// Preview ikut mode mirror + tombol Cermin/Normal. File hasil selalu = preview.
export function CameraView({
  videoRef,
  ready,
  label,
  mirrored,
  onToggleMirror,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
  label: string;
  mirrored: boolean;
  onToggleMirror?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onOrient = () => {};
    window.addEventListener("orientationchange", onOrient);
    return () => window.removeEventListener("orientationchange", onOrient);
  }, []);

  return (
    <div ref={boxRef} className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border-[3px] border-white bg-zinc-900 shadow-[0_6px_16px_-6px_rgba(219,39,119,0.5)] dark:border-white/15">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900 text-sm text-zinc-400">
          <span className="text-3xl" aria-hidden>📷</span>
          Kamera belum aktif
        </div>
      )}
      <div className="font-display absolute bottom-2 left-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1 text-xs text-white shadow">
        {label}
      </div>
      {onToggleMirror && (
        <button
          type="button"
          onClick={onToggleMirror}
          className="font-display absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur transition active:scale-95"
        >
          {mirrored ? "🪞 Cermin" : "📷 Normal"}
        </button>
      )}
    </div>
  );
}
