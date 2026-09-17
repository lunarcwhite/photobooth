"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function QRCodeModal({
  isOpen,
  onClose,
  value,
  title = "Pindai QR Code",
  subtitle = "Arahkan kamera HP temanmu ke QR Code ini untuk langsung bergabung.",
  code,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  title?: string;
  subtitle?: string;
  code?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !value) return;
    QRCode.toDataURL(value, {
      width: 320,
      margin: 1.5,
      color: {
        dark: "#171310",
        light: "#FFFDF8",
      },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [isOpen, value]);

  // Tutup dengan tombol Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* abaikan */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="booth-card relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center border border-booth-line dark:border-booth-nightline"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup modal"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-booth-muted hover:text-booth-ink hover:bg-black/5 dark:text-booth-creamdim dark:hover:text-white dark:hover:bg-white/10 transition cursor-pointer"
        >
          ✕
        </button>

        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-booth-accent mb-1">
          Bilik Foto
        </span>

        <h2 id="qr-modal-title" className="font-display text-xl sm:text-2xl font-bold text-booth-ink dark:text-booth-cream">
          {title}
        </h2>

        <p className="mt-1 text-xs text-booth-muted dark:text-booth-creamdim leading-relaxed max-w-[260px]">
          {subtitle}
        </p>

        {/* Kotak QR Code */}
        <div className="mt-5 p-3 rounded-2xl bg-[#FFFDF8] border-2 border-booth-line shadow-inner dark:border-booth-nightline flex items-center justify-center min-h-[220px] min-w-[220px]">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR Code untuk memindai room"
              className="h-52 w-52 rounded-xl object-contain select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-xs font-semibold text-booth-muted animate-pulse">
              <span>Membuat QR Code…</span>
            </div>
          )}
        </div>

        {code && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-booth-muted dark:text-booth-creamdim">Kode Booth:</span>
            <span className="font-display text-sm font-bold tracking-[0.18em] text-booth-accent bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-md tabular-nums">
              {code}
            </span>
          </div>
        )}

        <div className="mt-5 flex w-full gap-2">
          <button
            type="button"
            onClick={copyUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-booth-line bg-booth-card/80 py-2.5 px-3 text-xs font-semibold text-booth-ink hover:bg-black/5 active:scale-95 transition dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream cursor-pointer"
          >
            {copied ? <CheckIcon size={14} className="text-emerald-500" /> : <CopyIcon size={14} />}
            <span>{copied ? "Link Tersalin!" : "Salin Link"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-booth-ink py-2.5 px-3 text-xs font-semibold text-booth-paper hover:bg-black active:scale-95 transition dark:bg-booth-cream dark:text-booth-night cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
