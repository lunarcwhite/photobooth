"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFilterId } from "@/lib/filter/types";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { renderLiveFilter } from "@/lib/filter/renderer";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";

// Rasio foto pilihan user. captureShot crop tengah ke rasio ini agar
// file = preview (WYSIWYG). Tersimpan per-browser seperti mirror.
export type PhotoRatio = "3:4" | "1:1" | "9:16";
export const PHOTO_RATIOS: PhotoRatio[] = ["3:4", "1:1", "9:16"];
const RATIO_KEY = "pb_ratio";

function ratioValue(r: PhotoRatio): number {
  return r === "1:1" ? 1 : r === "9:16" ? 9 / 16 : 3 / 4;
}

// Camera hook (FR-03 + call). Video + mic untuk P2P call.
// Ada tombol Cermin/Normal: preview dan file selalu sama.
// Stream is stopped on unmount or via stop().
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  // Mirror selfie seperti cermin, tersimpan per-browser. Default nyala.
  // Dibaca di effect (bukan saat render) agar SSR dan client sama.
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [ratio, setRatio] = useState<PhotoRatio>("3:4");
  const lastLandmarksRef = useRef<NormalizedLandmark[][] | null>(null);

  const setLandmarks = useCallback((faces: NormalizedLandmark[][] | null) => {
    lastLandmarksRef.current = faces;
  }, []);

  const toggleMirror = useCallback(() => {
    setMirrored((m) => !m);
  }, []);

  const cycleRatio = useCallback(() => {
    setRatio((r) => PHOTO_RATIOS[(PHOTO_RATIOS.indexOf(r) + 1) % PHOTO_RATIOS.length]);
  }, []);

  // Dipakai guest untuk mengikuti rasio host (sudah divalidasi pengirim host).
  const setRatioExternal = useCallback((r: PhotoRatio) => {
    if (r === "3:4" || r === "1:1" || r === "9:16") setRatio(r);
  }, []);

  // Muat preferensi tersimpan setelah mount (sinkronisasi ↔ localStorage).
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ localStorage, sah */
  useEffect(() => {
    try {
      if (localStorage.getItem("ldr_mirror") === "off") setMirrored(false);
      const saved = localStorage.getItem(RATIO_KEY);
      if (saved === "1:1" || saved === "9:16" || saved === "3:4") setRatio(saved);
    } catch {
      /* abaikan */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist pilihan di luar updater agar tidak ganda saat StrictMode.
  useEffect(() => {
    try {
      localStorage.setItem("ldr_mirror", mirrored ? "on" : "off");
    } catch {
      /* abaikan */
    }
  }, [mirrored]);

  useEffect(() => {
    try {
      localStorage.setItem(RATIO_KEY, ratio);
    } catch {
      /* abaikan */
    }
  }, [ratio]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setAudioOn(false);
    setMuted(false);
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
    // Video + mic untuk saling lihat + bicara (P2P call). Preview 720p (§13).
    const tries: MediaStreamConstraints[] = [
      { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false },
    ];
    for (const constraints of tries) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setStream(stream);
        const hasAudio = stream.getAudioTracks().length > 0;
        setAudioOn(hasAudio);
        setMuted(false);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (!hasAudio) {
          setMessage("Mikrofon tidak tersedia — panggilan jalan tanpa suara. Video tetap tampil.");
        }
        setStatus("ready");
        return true;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setMessage("Izin kamera/mic ditolak. Izinkan akses di pengaturan browser, lalu coba lagi.");
          return false;
        }
        // try next fallback
      }
    }
    setStatus("error");
    setMessage("Kamera tidak bisa dibuka. Pastikan tidak dipakai aplikasi lain, lalu coba lagi.");
    return false;
  }, [stop]);

  // Mute mic lokal (track tetap hidup agar peer tidak renegosiasi).
  const toggleMute = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    setMuted((m) => {
      const next = !m;
      s.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  useEffect(() => stop, [stop]);

  // Tempel ulang stream ke elemen video tiap stream berubah — perbaiki
  // balapan mount ↔ start (preview hitam walau status ready).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.muted = true;
    v.play().catch(() => {
      /* autoplay ditolak — user ketuk video untuk putar */
    });
  }, [stream]);

  // Grab current frame → JPEG blob. Ikut mode mirror + crop tengah ke rasio
  // terpilih agar file = preview (WYSIWYG).
  const captureShot = useCallback(
    async (maxSide = 1280, quality = 0.85, activeFilter: LiveFilterId = "none"): Promise<Blob> => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) throw new Error("kamera belum siap");
      const target = ratioValue(ratio);
      let sw = video.videoWidth;
      let sh = video.videoHeight;
      const current = sw / sh;
      let sx = 0;
      let sy = 0;
      if (current > target) {
        // Terlalu lebar → potong kiri-kanan.
        sw = Math.round(sh * target);
        sx = Math.round((video.videoWidth - sw) / 2);
      } else if (current < target) {
        // Terlalu tinggi → potong atas-bawah.
        sh = Math.round(sw / target);
        sy = Math.round((video.videoHeight - sh) / 2);
      }
      const scale = Math.min(1, maxSide / Math.max(sw, sh));
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      if (mirrored) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);

      // Render filter aksesoris AR jika aktif (WYSIWYG ke foto fisik)
      if (activeFilter !== "none" && lastLandmarksRef.current && lastLandmarksRef.current.length > 0) {
        const adjustedLandmarks = lastLandmarksRef.current.map((face) =>
          face.map((pt) => ({
            ...pt,
            x: (pt.x * video.videoWidth - sx) / sw,
            y: (pt.y * video.videoHeight - sy) / sh,
          })),
        );
        renderLiveFilter(ctx, adjustedLandmarks, activeFilter, w, h);
      }

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob) throw new Error("gagal mengambil foto");
      return blob;
    },
    [mirrored, ratio],
  );

  return { videoRef, status, message, start, stop, captureShot, mirrored, toggleMirror, ratio, cycleRatio, setRatio: setRatioExternal, stream, muted, toggleMute, audioOn, setLandmarks };
}
