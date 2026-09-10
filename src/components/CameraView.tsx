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
    <div ref={boxRef} className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${mirrored ? "[-transform:scaleX(-1)]" : ""}`}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-sm text-zinc-400">
          Kamera belum aktif
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
        {label}
      </div>
      {onToggleMirror && (
        <button
          type="button"
          onClick={onToggleMirror}
          className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white"
        >
          {mirrored ? "🪞 Cermin" : "📷 Normal"}
        </button>
      )}
    </div>
  );
}
