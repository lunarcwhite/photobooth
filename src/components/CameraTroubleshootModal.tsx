"use client";

import { useState } from "react";
import { GhostBtn, Btn } from "@/components/ui";

interface CameraTroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "chrome" | "safari" | "inapp";

export function CameraTroubleshootModal({ isOpen, onClose }: CameraTroubleshootModalProps) {
  const [tab, setTab] = useState<TabType>("chrome");

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-troubleshoot-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-booth-line p-5 text-left bg-booth-card shadow-2xl dark:border-booth-nightline dark:bg-booth-nightcard max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-booth-line/60 pb-3 dark:border-booth-nightline/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm font-bold">
                📷
              </span>
              <h2 id="camera-troubleshoot-title" className="font-display text-lg font-bold text-booth-ink dark:text-booth-cream">
                Kamera Terblokir?
              </h2>
            </div>
            <p className="text-xs text-booth-muted dark:text-booth-creamdim mt-1">
              Ikuti panduan cepat di bawah untuk mengaktifkan kembali izin kamera:
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan izin kamera"
            className="rounded-lg p-1 text-booth-muted hover:text-booth-ink hover:bg-black/5 dark:text-booth-creamdim dark:hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-xl bg-booth-line/30 dark:bg-booth-nightline/50 p-1 gap-1 my-3 border border-booth-line/60 dark:border-booth-nightline/60">
          <button
            type="button"
            onClick={() => setTab("chrome")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "chrome"
                ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
            }`}
          >
            Google Chrome
          </button>
          <button
            type="button"
            onClick={() => setTab("safari")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "safari"
                ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
            }`}
          >
            Safari (iPhone)
          </button>
          <button
            type="button"
            onClick={() => setTab("inapp")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "inapp"
                ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
            }`}
          >
            IG / WA / TikTok
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 text-xs text-booth-ink dark:text-booth-cream">
          {tab === "chrome" && (
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  1
                </span>
                <div>
                  <p className="font-semibold">Ketuk ikon gembok / slider</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Terletak di baris alamat URL (di sebelah kiri tautan website).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  2
                </span>
                <div>
                  <p className="font-semibold">Pilih &ldquo;Izin Situs&rdquo; (Permissions)</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Cari opsi <span className="font-semibold text-booth-ink dark:text-white">Kamera</span> dan ubah statusnya menjadi <span className="font-semibold text-emerald-600 dark:text-emerald-400">&ldquo;Izinkan&rdquo;</span>.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  3
                </span>
                <div>
                  <p className="font-semibold">Muat ulang (Refresh) halaman</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Kamera Anda akan langsung menyala otomatis setelah halaman dimuat ulang.
                  </p>
                </div>
              </li>
            </ol>
          )}

          {tab === "safari" && (
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  1
                </span>
                <div>
                  <p className="font-semibold">Ketuk ikon &ldquo;aA&rdquo; di URL bar Safari</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Pilih menu <span className="font-semibold text-booth-ink dark:text-white">&ldquo;Pengaturan Situs Web&rdquo;</span> (Website Settings).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  2
                </span>
                <div>
                  <p className="font-semibold">Ubah izin Kamera menjadi &ldquo;Izinkan&rdquo;</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Pilih opsi <span className="font-semibold text-emerald-600 dark:text-emerald-400">&ldquo;Tanya&rdquo;</span> atau <span className="font-semibold text-emerald-600 dark:text-emerald-400">&ldquo;Izinkan&rdquo;</span> pada Kamera & Mikrofon.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  3
                </span>
                <div>
                  <p className="font-semibold">Atau via Pengaturan iPhone (iOS)</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Buka <span className="font-semibold">Pengaturan (Settings) → Safari → Kamera</span> → pastikan tidak berada dalam status &ldquo;Tolak&rdquo;.
                  </p>
                </div>
              </li>
            </ol>
          )}

          {tab === "inapp" && (
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  1
                </span>
                <div>
                  <p className="font-semibold">Browser Aplikasi Terbatas</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Browser internal Instagram, TikTok, dan WhatsApp sering kali menonaktifkan fitur kamera WebRTC.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  2
                </span>
                <div>
                  <p className="font-semibold">Buka di Browser Asli HP</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Ketuk menu titik tiga (<span className="font-bold">⋮</span> atau <span className="font-bold">⋯</span>) di pojok atas layar aplikasi Anda.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-booth-line/50 dark:border-booth-nightline/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-booth-accent text-white text-[10px] font-bold">
                  3
                </span>
                <div>
                  <p className="font-semibold">Pilih &ldquo;Buka di Browser Luar&rdquo;</p>
                  <p className="text-[11px] text-booth-muted dark:text-booth-creamdim mt-0.5">
                    Pilih <span className="font-semibold text-booth-accent">&ldquo;Buka di Chrome&rdquo;</span> atau <span className="font-semibold text-booth-accent">&ldquo;Buka di Safari&rdquo;</span> untuk pengalaman terbaik.
                  </p>
                </div>
              </li>
            </ol>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-booth-line/60 dark:border-booth-nightline/60 flex items-center justify-between gap-2">
          <GhostBtn onClick={onClose} className="min-h-[38px] text-xs font-semibold">
            Tutup
          </GhostBtn>
          <Btn
            tone="accent"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="min-h-[38px] text-xs font-bold"
          >
            🔄 Muat Ulang Halaman
          </Btn>
        </div>
      </div>
    </div>
  );
}
