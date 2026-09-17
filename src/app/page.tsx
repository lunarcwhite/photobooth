"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CameraTroubleshootModal } from "@/components/CameraTroubleshootModal";
import { roomApi, RoomApiError } from "@/lib/room/api";
import { validateDisplayName, normalizeCode, getSessionId } from "@/lib/room/session";
import { saveRoomBundle } from "@/lib/room/bundle";
import { track } from "@/lib/analytics/events";
import { Btn, GhostBtn, Field, Card, ErrorMsg, StepBadge, Segmented } from "@/components/ui";
import { FilmIcon, LockIcon, CameraIcon, CheckIcon, UserIcon } from "@/components/icons";
import { TEMPLATES } from "@/types/template";

const STEPS = [
  {
    num: "1",
    title: "Buat booth & dapatkan kode",
    desc: "Satu klik untuk membuat room privat 2 orang.",
  },
  {
    num: "2",
    title: "Kirim tautan ke temanmu",
    desc: "Teman gabung langsung dari browser HP atau laptop.",
  },
  {
    num: "3",
    title: "Jepret 4 foto sinkron",
    desc: "Hitung mundur 3-2-1 jalan serentak di kedua layar.",
  },
];

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [showCameraHelp, setShowCameraHelp] = useState(false);

  const ensureSession = () => {
    try {
      getSessionId();
    } catch {
      /* SSR — ignore */
    }
  };

  const doCreate = async () => {
    setError(null);
    setBusy("create");
    try {
      ensureSession();
      const displayName = validateDisplayName(name);
      const r = await roomApi.create(displayName);
      saveRoomBundle(r.code, {
        roomId: r.roomId,
        participantId: r.participantId,
        displayName,
        role: "host",
      });
      track("room_created", r.roomId);
      router.push(`/room/${r.code}`);
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Booth tidak bisa dibuat. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const doJoin = async () => {
    setError(null);
    setBusy("join");
    try {
      ensureSession();
      const cleanCode = normalizeCode(code);
      const displayName = validateDisplayName(joinName);
      const r = await roomApi.join(cleanCode, displayName);
      const me = r.members.find((m) => m.id === r.participantId);
      saveRoomBundle(cleanCode, {
        roomId: r.roomId,
        participantId: r.participantId,
        displayName,
        role: me?.role ?? "guest",
      });
      track("room_joined", r.roomId);
      router.push(`/room/${cleanCode}`);
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa gabung. Periksa kode.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Top Bar Navigation */}
      <header className="w-full border-b border-booth-line/60 bg-booth-paper/80 backdrop-blur-md sticky top-0 z-30 dark:border-booth-nightline/60 dark:bg-booth-night/80">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-10 lg:px-14">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night">
              <FilmIcon size={18} />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight block leading-tight">
                Booth Berdua
              </span>
              <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block">
                Made for Two
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/sama")}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-booth-line px-3.5 py-1.5 text-xs font-semibold text-booth-ink hover:bg-black/[0.04] transition dark:border-booth-nightline dark:text-booth-cream dark:hover:bg-white/[0.06]"
            >
              <CameraIcon size={14} />
              Satu HP Berdua
            </button>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-booth-muted dark:text-booth-creamdim">
              <LockIcon size={12} />
              Tanpa akun
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section: Intentional Desktop Layout */}
      <main className="w-full flex-1">
        <section className="relative overflow-hidden pt-8 pb-14 md:pt-12 md:pb-20 lg:pt-16 lg:pb-24 border-b border-booth-line/40 dark:border-booth-nightline/40">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10 lg:px-14">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center xl:gap-16">
              {/* Left Column: Editorial & Value Prop */}
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-booth-accent/10 px-3 py-1 text-xs font-bold text-booth-accent uppercase tracking-wider">
                    Dua Orang · Satu Kenangan
                  </span>
                  <StepBadge step="1" of="4" label="Mulai" />
                </div>

                <div>
                  <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance leading-[1.06]">
                    Booth kecil untuk kamu + seseorang.
                  </h1>
                  <p className="mt-4 text-base sm:text-lg text-booth-muted dark:text-booth-creamdim leading-relaxed max-w-xl">
                    Masuk booth berdua dari browser tanpa unduh aplikasi dan tanpa daftar akun.
                    Dua HP berjauhan atau satu perangkat barengan — hitung mundur 4 jepretan berjalan serentak.
                  </p>
                </div>

                {/* Steps List */}
                <div className="grid gap-3 pt-2">
                  {STEPS.map((s) => (
                    <div
                      key={s.num}
                      className="flex items-start gap-3.5 rounded-xl border border-booth-line/70 bg-booth-card/40 p-3.5 transition hover:bg-booth-card dark:border-booth-nightline/70 dark:bg-booth-nightcard/40 dark:hover:bg-booth-nightcard"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-booth-accent/10 text-xs font-bold text-booth-accent tabular-nums">
                        {s.num}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-booth-ink dark:text-booth-cream">
                          {s.title}
                        </p>
                        <p className="text-xs text-booth-muted dark:text-booth-creamdim mt-0.5">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-booth-muted dark:text-booth-creamdim pt-1">
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon size={14} className="text-emerald-600" />
                    Bebas biaya
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon size={14} className="text-emerald-600" />
                    Kualitas cetak 1080p
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon size={14} className="text-emerald-600" />
                    Privasi lokal di browser
                  </span>
                </div>
              </div>

              {/* Right Column: Interactive Form + Sample Photostrip Showcase */}
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-6 lg:gap-8">
                {/* Visual Sample Photostrip (DESIGN §9) */}
                <div className="relative shrink-0 group perspective-1000 hidden md:block">
                  <div className="relative rounded-2xl p-2.5 bg-white shadow-print border border-[#E3DEC3] rotate-[-2deg] transition-all duration-300 hover:rotate-0 hover:scale-[1.02] dark:bg-[#1C1814] dark:border-[#382E24]">
                    {/* Washi tape visual detail */}
                    <div
                      aria-hidden
                      className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-amber-100/85 border border-amber-200/90 shadow-sm rotate-1 backdrop-blur-xs rounded-xs"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/sample_photostrip.jpg"
                      alt="Contoh hasil cetak strip photobooth untuk berdua"
                      className="w-48 xl:w-52 max-h-[440px] rounded-lg object-cover"
                    />
                    <div className="mt-2 text-center">
                      <p className="font-display text-[13px] font-bold tracking-widest text-booth-muted dark:text-booth-creamdim uppercase">
                        ★ PREVIEW CETAK ★
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Action Card */}
                <div className="w-full max-w-md flex flex-col gap-3">
                  <ErrorMsg msg={error} />

                  <Segmented
                    label="Pilih buat atau gabung booth"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "create", label: "Buat booth baru" },
                      { value: "join", label: "Gabung booth" },
                    ]}
                  />

                  {tab === "create" ? (
                    <Card className="shadow-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <UserIcon size={16} className="text-booth-accent" />
                        <label className="text-xs font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim" htmlFor="create-name">
                          Namamu <span className="font-normal lowercase">(opsional)</span>
                        </label>
                      </div>
                      <div className="mt-2 flex flex-col gap-3">
                        <Field
                          id="create-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="cth. Rian, Dhea, atau panggilanmu"
                          maxLength={30}
                          autoComplete="nickname"
                        />
                        <Btn tone="accent" onClick={doCreate} disabled={busy !== null} className="text-base py-3.5">
                          {busy === "create" ? "Membuat booth…" : "Masuk ke Booth"}
                        </Btn>
                      </div>
                      <p className="mt-3 text-center text-xs text-booth-muted dark:text-booth-creamdim">
                        Kode unik 6 digit akan langsung dibuat untuk dibagikan ke temanmu.
                      </p>
                    </Card>
                  ) : (
                    <Card className="shadow-lg">
                      <div className="flex flex-col gap-3.5">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim" htmlFor="join-name">
                            Namamu
                          </label>
                          <Field
                            id="join-name"
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            placeholder="Nama atau inisialmu"
                            maxLength={30}
                            autoComplete="nickname"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim" htmlFor="join-code">
                            Kode Booth (6 Karakter)
                          </label>
                          <Field
                            id="join-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="cth. 75VWRY"
                            maxLength={8}
                            autoCapitalize="characters"
                            autoComplete="off"
                            className="font-display mt-1.5 text-center text-2xl font-bold tracking-[0.25em] tabular-nums"
                          />
                        </div>
                        <Btn
                          tone="accent"
                          onClick={doJoin}
                          disabled={busy !== null || code.trim().length < 6}
                          className="text-base py-3.5"
                        >
                          {busy === "join" ? "Menghubungkan…" : "Gabung ke Booth"}
                        </Btn>
                      </div>
                    </Card>
                  )}

                  <GhostBtn onClick={() => router.push("/sama")} className="text-xs font-semibold">
                    <CameraIcon size={16} />
                    Satu HP atau Laptop Bareng (Mode Sama)
                  </GhostBtn>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Templates Showcase Section */}
        <section className="py-12 md:py-16 border-b border-booth-line/40 dark:border-booth-nightline/40">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10 lg:px-14">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-widest text-booth-accent">
                Variasi Bingkai
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1.5">
                Pilih bingkai & gaya sesukamu.
              </h2>
              <p className="text-sm text-booth-muted dark:text-booth-creamdim mt-2">
                Empat template desain siap cetak yang bisa kamu kustomisasi dengan warna, filter film, dan hiasan stiker.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {TEMPLATES.map((t, idx) => {
                const isDark = t.id === "polaroid";
                const isRetro = t.id === "retro";
                const isMinimal = t.id === "minimal";
                return (
                  <div
                    key={t.id}
                    className="booth-card flex flex-col rounded-2xl p-5 transition-transform hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* Miniature photostrip visual representation */}
                    <div
                      className={`h-48 rounded-xl border p-2.5 flex flex-col items-center justify-between mb-4 shadow-inner ${
                        isDark
                          ? "bg-[#161616] border-[#333] text-white"
                          : isRetro
                            ? "bg-[#F4E9D8] border-[#DECDB5] text-[#4A3B2C]"
                            : isMinimal
                              ? "bg-white border-[#E0E0E0] text-black"
                              : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      <div className="w-full flex items-center justify-between px-1">
                        <span className="text-[9px] font-bold tracking-wider opacity-60">
                          {t.name.toUpperCase()}
                        </span>
                        <span className="text-[8px] opacity-40 font-mono">1080x1920</span>
                      </div>

                      {/* 4 miniature photo slots */}
                      <div className="grid grid-cols-2 gap-1.5 w-full my-auto px-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((slotIdx) => (
                          <div
                            key={slotIdx}
                            className={`h-6 rounded-xs border flex items-center justify-center text-[7px] font-bold opacity-75 ${
                              isDark
                                ? "bg-[#252525] border-[#444] text-white/50"
                                : "bg-black/5 border-black/10 text-black/40"
                            }`}
                          >
                            {slotIdx % 2 === 0 ? "A" : "B"}
                          </div>
                        ))}
                      </div>

                      <div className="text-center w-full">
                        <span className="font-display text-[10px] font-bold tracking-wider">
                          {t.text.title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold">{t.name}</h3>
                      <span className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-booth-muted dark:bg-white/[0.05] dark:text-booth-creamdim">
                        Varian {idx + 1}
                      </span>
                    </div>
                    <p className="text-xs text-booth-muted dark:text-booth-creamdim mt-1.5 leading-relaxed">
                      {isRetro
                        ? "Nuansa kertas hangat bernostalgia dengan efek butiran film vintage."
                        : isDark
                          ? "Bingkai hitam tebal modern bergaya studio polaroid malam."
                          : isMinimal
                            ? "Ruang kosong bersih editorial dengan garis tepi yang presisi."
                            : "Gaya strip photobooth klasik yang tak lekang oleh waktu."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Designed for Two: Feature Comparison */}
        <section className="py-12 md:py-16 border-b border-booth-line/40 dark:border-booth-nightline/40">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10 lg:px-14">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-widest text-booth-accent">
                Dua Cara Bermain
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1.5">
                Dua HP berjauhan atau satu perangkat bersama.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="booth-card rounded-2xl p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-booth-accent/10 text-booth-accent font-bold text-lg mb-4">
                    ✦
                  </div>
                  <h3 className="font-display text-2xl font-bold">Mode Jarak Jauh (Remote)</h3>
                  <p className="text-sm text-booth-muted dark:text-booth-creamdim mt-2 leading-relaxed">
                    Satu orang di Jakarta, satu orang di Bandung. Bagikan tautan booth, izinkan kamera,
                    dan hitung mundur 4 jepretan berjalan serempak lewat sinkronisasi jam server akurat.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs font-semibold text-booth-ink dark:text-booth-cream">
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Hitung mundur tersinkronisasi toleransi milidetik
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Live video preview teman saat bersiap pose
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Pilihan mikrofon suara untuk saling mengobrol
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-booth-line/60 dark:border-booth-nightline/60">
                  <Btn tone="accent" onClick={() => { setTab("create"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    Buat Booth Jarak Jauh
                  </Btn>
                </div>
              </div>

              <div className="booth-card rounded-2xl p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-booth-ink text-booth-paper dark:bg-booth-cream dark:text-booth-night font-bold text-lg mb-4">
                    ❤
                  </div>
                  <h3 className="font-display text-2xl font-bold">Mode Satu HP (Barengan)</h3>
                  <p className="text-sm text-booth-muted dark:text-booth-creamdim mt-2 leading-relaxed">
                    Sedang duduk bersebelahan di kafe atau kamar? Gunakan satu kamera HP atau webcam laptop.
                    Berpose bersama dalam 1 frame dengan 4 jepretan countdown otomatis.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs font-semibold text-booth-ink dark:text-booth-cream">
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Tanpa perlu koneksi internet dua arah
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Pilihan rasio 3:4, 1:1, dan 9:16
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckIcon size={14} className="text-emerald-600" />
                      Langsung unduh dan simpan di perangkat
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-booth-line/60 dark:border-booth-nightline/60">
                  <GhostBtn onClick={() => router.push("/sama")}>
                    Mulai Mode Satu HP
                  </GhostBtn>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-14 md:py-20 text-center">
          <div className="mx-auto max-w-xl px-5">
            <h2 className="font-display text-3xl md:text-5xl font-bold">
              Siap mengabadikan momen berdua?
            </h2>
            <p className="text-sm md:text-base text-booth-muted dark:text-booth-creamdim mt-3 leading-relaxed">
              Kurang dari 2 menit dari buat room sampai foto jadi siap unduh.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Btn
                tone="accent"
                onClick={() => { setTab("create"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="w-full sm:w-auto px-8 py-3.5 text-base"
              >
                Buat Booth Sekarang
              </Btn>
              <GhostBtn
                onClick={() => router.push("/sama")}
                className="w-full sm:w-auto px-6 py-3.5 text-base"
              >
                Coba Mode Satu HP
              </GhostBtn>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="w-full border-t border-booth-line/60 py-8 px-5 text-xs text-booth-muted dark:border-booth-nightline/60 dark:text-booth-creamdim">
        <div className="mx-auto max-w-[1400px] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p>
            Two-Person Photobooth · Dibuat dengan cinta untuk kamu & seseorang · Privasi terjaga, tanpa pelacakan
          </p>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/privacy" className="hover:text-booth-ink dark:hover:text-white transition">
              Kebijakan Privasi
            </Link>
            <span className="opacity-30">·</span>
            <button
              type="button"
              onClick={() => setShowCameraHelp(true)}
              className="hover:text-booth-ink dark:hover:text-white transition cursor-pointer"
            >
              Bantuan Izin Kamera
            </button>
          </div>
        </div>
      </footer>

      <CameraTroubleshootModal
        isOpen={showCameraHelp}
        onClose={() => setShowCameraHelp(false)}
      />
    </div>
  );
}
