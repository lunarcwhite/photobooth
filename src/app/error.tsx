"use client";

import { useEffect } from "react";
import { Btn, GhostBtn, Card } from "@/components/ui";
import { AlertIcon } from "@/components/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error untuk kebutuhan pemantauan
    console.error("[BoothError]", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-12">
      <Card className="flex flex-col items-center text-center p-6 sm:p-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 shadow-inner">
          <AlertIcon size={28} />
        </div>

        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-1">
          Terjadi Kendala
        </span>

        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-booth-ink dark:text-booth-cream">
          Kamera tersandung sejenak
        </h1>

        <p className="mt-2.5 text-xs sm:text-sm text-booth-muted dark:text-booth-creamdim leading-relaxed">
          {error.message && error.message.length < 120
            ? error.message
            : "Terjadi kesalahan yang tidak terduga saat memproses bilik foto. Jangan khawatir, Anda bisa mencoba memuat ulang sesi ini."}
        </p>

        {error.digest && (
          <span className="mt-2 text-[10px] font-mono text-booth-muted/60 dark:text-booth-creamdim/50">
            Kode: {error.digest}
          </span>
        )}

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Btn tone="accent" onClick={() => reset()}>
            Muat Ulang Bilik
          </Btn>
          <GhostBtn onClick={() => (window.location.href = "/")}>
            Kembali ke Beranda
          </GhostBtn>
        </div>
      </Card>

      <p className="text-[11px] font-medium text-booth-muted/80 dark:text-booth-creamdim/60">
        Jika kendala berlanjut, periksa izin kamera pada browser Anda.
      </p>
    </main>
  );
}
