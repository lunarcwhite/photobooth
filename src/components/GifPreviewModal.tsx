"use client";

import { useEffect, useState } from "react";
import { Btn, GhostBtn } from "@/components/ui";
import { DownloadIcon, ShareIcon, CheckIcon } from "@/components/icons";

interface GifPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  gifBlob: Blob | null;
  code: string;
}

export function GifPreviewModal({ isOpen, onClose, gifBlob, code }: GifPreviewModalProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!gifBlob) {
      setGifUrl(null);
      return;
    }
    const url = URL.createObjectURL(gifBlob);
    setGifUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [gifBlob]);

  if (!isOpen) return null;

  const downloadGif = () => {
    if (!gifUrl) return;
    const a = document.createElement("a");
    a.href = gifUrl;
    a.download = `photobooth-${code}-animated.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareGif = async () => {
    if (!gifBlob) return;
    if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
      const file = new File([gifBlob], `photobooth-${code}.gif`, { type: "image/gif" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Photobooth GIF Animasi" });
          setShared(true);
          return;
        } catch {
          /* user membatalkan */
        }
      }
    }
    downloadGif();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gif-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-booth-line p-5 text-center bg-booth-card shadow-2xl dark:border-booth-nightline dark:bg-booth-nightcard flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between border-b border-booth-line/60 pb-3 mb-4 dark:border-booth-nightline/60">
          <div className="text-left">
            <h2 id="gif-modal-title" className="font-display text-lg font-bold text-booth-ink dark:text-booth-cream flex items-center gap-2">
              <span>🎞️</span> GIF Bergerak (Boomerang)
            </h2>
            <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
              Siap diunggah ke Instagram Story atau TikTok
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau GIF"
            className="rounded-lg p-1 text-booth-muted hover:text-booth-ink hover:bg-black/5 dark:text-booth-creamdim dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* GIF Preview Display */}
        <div className="relative flex max-h-[50vh] w-full items-center justify-center overflow-hidden rounded-xl border border-booth-line/80 bg-black/40 p-1 dark:border-booth-nightline/80 shadow-inner">
          {gifUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={gifUrl}
              alt="Animasi GIF Photobooth"
              className="max-h-[46vh] w-auto rounded-lg object-contain shadow-md select-none"
            />
          ) : (
            <div className="py-16 text-xs text-booth-muted">Menyusun animasi GIF…</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 w-full space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Btn tone="accent" onClick={downloadGif} disabled={!gifUrl} className="py-2.5 text-xs font-bold shadow-md">
              <DownloadIcon size={15} />
              Unduh GIF
            </Btn>
            <GhostBtn onClick={shareGif} disabled={!gifUrl} className="py-2.5 text-xs font-bold">
              {shared ? <CheckIcon size={15} className="text-emerald-500" /> : <ShareIcon size={15} />}
              {shared ? "Tersimpan" : "Bagikan"}
            </GhostBtn>
          </div>
          <GhostBtn onClick={onClose} className="w-full py-2 text-xs font-medium text-booth-muted">
            Kembali ke Strip Foto
          </GhostBtn>
        </div>
      </div>
    </div>
  );
}
