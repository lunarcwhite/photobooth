"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";

// Camera hook (FR-03). Preview is mirrored via CSS; capture is NOT mirrored.
// Stream is stopped on unmount or via stop().
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setMessage("Browser ini tidak mendukung kamera. Coba Chrome atau Safari terbaru.");
      return false;
    }
    setStatus("requesting");
    setMessage(null);
    stop();
    const tries: MediaStreamConstraints[] = [
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false },
    ];
    for (const constraints of tries) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
        return true;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setMessage("Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.");
          return false;
        }
        // try next fallback
      }
    }
    setStatus("error");
    setMessage("Kamera tidak bisa dibuka. Pastikan tidak dipakai aplikasi lain, lalu coba lagi.");
    return false;
  }, [stop]);

  useEffect(() => stop, [stop]);

  // Grab current frame → JPEG blob. Long side capped, no mirror, no stretch.
  const captureShot = useCallback(async (maxSide = 1280, quality = 0.85): Promise<Blob> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) throw new Error("kamera belum siap");
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) throw new Error("gagal mengambil foto");
    return blob;
  }, []);

  return { videoRef, status, message, start, stop, captureShot };
}
