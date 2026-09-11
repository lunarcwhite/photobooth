"use client";

import { useEffect, useRef } from "react";
import type { CallStatus } from "@/hooks/usePeerCall";

// Video pasangan via WebRTC P2P. Remote TIDAK di-mirror (tampil apa adanya
// seperti dilihat pemilik kamera) — beda dari preview lokal yang seperti cermin.
export function RemoteView({
  remoteStream,
  status,
  name,
  onRetry,
}: {
  remoteStream: MediaStream | null;
  status: CallStatus;
  name: string;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = remoteStream;
      ref.current.play().catch(() => {});
    }
  }, [remoteStream]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-900">
      {remoteStream && status === "connected" ? (
        <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center text-zinc-400">
          <span className="text-2xl">📷</span>
          <span className="text-xs">
            {status === "calling" ? "Menghubungkan video..." : status === "failed" ? "Video gagal tersambung." : "Menunggu video pasangan..."}
          </span>
          {status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-full bg-zinc-700 px-3 py-1 text-xs font-medium text-white"
            >
              Coba Lagi
            </button>
          )}
        </div>
      )}
      {/* video tetap di-mount saat calling agar track langsung tampil */}
      {remoteStream && status !== "connected" && (
        <video ref={ref} autoPlay playsInline muted className="hidden" />
      )}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
        {name}
      </div>
    </div>
  );
}
