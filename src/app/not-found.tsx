import Link from "next/link";
import { Btn, GhostBtn, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-12">
      <Card className="flex flex-col items-center text-center p-6 sm:p-8">
        {/* Ilustrasi Frame Strip Kosong */}
        <div className="relative mb-5 flex h-32 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-booth-line bg-black/5 dark:border-booth-nightline dark:bg-white/5 shadow-inner">
          <span className="text-3xl">📷</span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-booth-muted dark:text-booth-creamdim">
            Kosong
          </span>
          <div className="absolute -top-2.5 rounded-full bg-booth-accent px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
            404
          </div>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-booth-muted dark:text-booth-creamdim mb-1">
          Halaman Tidak Ditemukan
        </span>

        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-booth-ink dark:text-booth-cream">
          Bilik fotonya tidak ketemu
        </h1>

        <p className="mt-2.5 text-xs sm:text-sm text-booth-muted dark:text-booth-creamdim leading-relaxed">
          Kode booth mungkin salah diketik, atau sesi foto ini sudah selesai dan kedaluwarsa secara otomatis.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Link href="/" className="w-full">
            <Btn tone="accent">Bikin Booth Baru</Btn>
          </Link>
          <Link href="/" className="w-full">
            <GhostBtn>Kembali ke Beranda</GhostBtn>
          </Link>
        </div>
      </Card>

      <p className="text-[11px] font-medium text-booth-muted/80 dark:text-booth-creamdim/60">
        Booth Kecil untuk Berdua • Tanpa Aplikasi, Tanpa Daftar
      </p>
    </main>
  );
}
