"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/room/session";
import { loadRoomBundle, loadShotsBundle, clearCaptureBundle, type RoomBundle, type ShotsBundle } from "@/lib/room/bundle";
import { downloadShot } from "@/lib/storage/exchange";
import { composeFinal } from "@/lib/canvas/compose";
import { track } from "@/lib/analytics/events";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import type { RoomBroadcastEvent } from "@/types/realtime";
import {
  TEMPLATES,
  PHOTO_STYLES,
  PHOTO_DECORS,
  SOLO_LAYOUTS,
  REMOTE_LAYOUTS,
  type PhotoDecor,
  type PhotoStyle,
  type SoloLayout,
  type RemoteLayout,
} from "@/types/template";
import { Btn, GhostBtn, ErrorMsg, StepBadge, Segmented, Field } from "@/components/ui";
import { CheckIcon, ClockIcon, DownloadIcon, RefreshIcon, ShareIcon } from "@/components/icons";

export default function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const [shots, setShots] = useState<ShotsBundle | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tplIndex, setTplIndex] = useState(0);
  const [soloLayout, setSoloLayout] = useState<SoloLayout>("single");
  const [remoteLayout, setRemoteLayout] = useState<RemoteLayout>("seamless");
  const [partnerShots, setPartnerShots] = useState<(string | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState<boolean[]>([false, false, false, false]);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [style, setStyle] = useState<PhotoStyle>("original");
  const [decor, setDecor] = useState<PhotoDecor>("none");
  const [caption, setCaption] = useState("");
  const [backHome, setBackHome] = useState(false);
  const [mobileTab, setMobileTab] = useState<"layout" | "frame" | "filter">("layout");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Ambil ulang sinkron: salah satu menekan → kedua HP kembali ke booth.
  const mePresence = useMemo(
    () =>
      bundle
        ? { participantId: bundle.participantId, displayName: bundle.displayName, cameraReady: false }
        : null,
    [bundle],
  );
  const sendRef = useRef<(e: RoomBroadcastEvent) => Promise<void>>(async () => {});
  const onEvent = useCallback((e: RoomBroadcastEvent) => {
    if (e.event === "retake") {
      clearCaptureBundle(code);
      router.push(`/room/${code}`);
    }
  }, [code, router]);
  const { send } = useRoomChannel(code, mePresence, onEvent);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Baca storage setelah mount: sinkronisasi React ↔ browser storage.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ storage browser, sah */
  useEffect(() => {
    const s = loadShotsBundle(code);
    setShots(s);
    if (s) {
      setPartnerShots(s.partnerShots);
      setMobileTab("layout");
    }
    setBundle(loadRoomBundle(code));
    setMounted(true);
  }, [code]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!mounted) return;
    if (!shots) router.replace(`/room/${code}`);
  }, [mounted, shots, code, router]);

  // Unduh foto teman via signed URL; gagal = placeholder + retry (§10).
  const loadPartner = useCallback(
    async (index: number) => {
      if (!shots || !shots.partnerId) return;
      const path = shots.partnerPaths[index];
      if (!path) return;
      setLoading((l) => {
        const n = [...l];
        n[index] = true;
        return n;
      });
      try {
        const blob = await downloadShot(shots.sessionDbId, index + 1, shots.partnerId);
        const url = URL.createObjectURL(blob);
        setPartnerShots((prev) => {
          const n = [...prev];
          n[index] = url;
          return n;
        });
      } catch {
        setError(`Foto teman ${index + 1} belum bisa dimuat. Coba muat ulang.`);
      } finally {
        setLoading((l) => {
          const n = [...l];
          n[index] = false;
          return n;
        });
      }
    },
    [shots],
  );

  // Auto-load semua foto teman saat halaman dibuka (mode remote saja).
  useEffect(() => {
    if (!shots || shots.solo) return;
    shots.partnerPaths.forEach((p, i) => {
      if (p) void loadPartner(i);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots?.sessionDbId]);

  const tpl = TEMPLATES[tplIndex];
  // Slot order: jika solo, cukup 4 foto unik. Jika remote: [A1,B1,A2,B2,...] A = host, B = guest (§13).
  const slots = useMemo(() => {
    if (!shots) return Array(8).fill(null) as (string | null)[];
    if (shots.solo) {
      return shots.myShots.slice(0, 4);
    }
    const mine = shots.myRole === "host" ? shots.myShots : partnerShots;
    const theirs = shots.myRole === "host" ? partnerShots : shots.myShots;
    return [mine[0], theirs[0], mine[1], theirs[1], mine[2], theirs[2], mine[3], theirs[3]];
  }, [shots, partnerShots]);

  useEffect(() => {
    if (!shots) return;
    // Re-compose tiap template/gaya/dekor/caption/partner-photo/layout berubah.
    let cancelled = false;
    (async () => {
      setComposing(true);
      setError(null);
      try {
        const names = shots.solo
          ? (shots.myName || "Kamu & Teman")
          : [
              shots.myRole === "host" ? shots.myName : shots.partnerName,
              shots.myRole === "host" ? shots.partnerName : shots.myName,
            ]
              .filter(Boolean)
              .join(" & ") || "Kalian Berdua";

        const blob = await composeFinal(tpl, slots, {
          names,
          date: shots.date,
          style,
          decor,
          caption,
          isSolo: Boolean(shots.solo),
          soloLayout,
          remoteLayout,
        });
        if (cancelled) return;
        setFinalUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setFinalBlob(blob);
        track("result_generated", shots.roomId);
      } catch {
        if (!cancelled) setError("Gagal menyusun foto. Coba lagi.");
      } finally {
        if (!cancelled) setComposing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shots, tpl, slots, style, decor, caption, soloLayout, remoteLayout]);

  // Ambil ulang: broadcast retake → kedua HP kembali ke booth.
  const retake = async () => {
    clearCaptureBundle(code);
    if (bundle && !shots?.solo) {
      try {
        await sendRef.current({ event: "retake", from: bundle.participantId });
      } catch {
        /* offline — navigasi lokal tetap jalan */
      }
    }
    router.push(shots?.solo ? "/sama" : `/room/${code}`);
  };

  const download = () => {
    if (!finalBlob) return;
    const a = document.createElement("a");
    a.href = finalUrl!;
    a.download = `photobooth-${code}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track("result_downloaded", shots?.roomId);
  };

  const share = async () => {
    if (!finalBlob) return;
    if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
      const file = new File([finalBlob], `photobooth-${code}.jpg`, { type: "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "Photobooth Online" });
          track("result_shared", shots?.roomId);
          setShared(true);
          return;
        } catch {
          /* user membatalkan — tetap tawarkan unduhan */
        }
      }
    }
    download();
  };

  if (!mounted || !shots) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-booth-muted dark:text-booth-creamdim">
          <ClockIcon size={16} /> Menyiapkan hasil…
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh w-full flex-col gap-3 overflow-hidden px-4 py-3 md:px-8 lg:gap-4 lg:px-12 xl:mx-auto xl:max-w-[1500px] xl:px-14">
      {/* Top Bar Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-booth-line/60 pb-2 sm:pb-3 dark:border-booth-nightline/60">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <StepBadge
              step={shots.solo ? "2" : "4"}
              of={shots.solo ? "2" : "4"}
              label="Hasil Jadi"
            />
            <h1 className="font-display pt-0.5 text-lg sm:text-2xl font-bold tracking-tight text-booth-ink dark:text-booth-cream truncate">
              Kalian berhasil! ✦
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setBackHome(true)}
            className="rounded-xl border border-booth-line px-3.5 py-1.5 text-xs font-semibold text-booth-muted hover:text-booth-ink hover:bg-black/[0.04] transition dark:border-booth-nightline dark:text-booth-creamdim dark:hover:text-white"
          >
            Selesai
          </button>
        </div>
      </header>

      <ErrorMsg msg={error} />

      {/* Main Studio Grid: Left Print Stage & Right Customization Panel */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:grid md:grid-cols-[1.15fr_0.85fr] md:items-stretch lg:grid-cols-[1.1fr_360px] lg:gap-6 xl:grid-cols-[1.2fr_380px]">
        {/* Photostrip Print Stage */}
        <div className="booth-card relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#EDE8DC]/50 p-2 sm:p-3 md:p-5 dark:bg-black/30 shadow-inner">
          {composing && !finalUrl ? (
            <div className="flex flex-col items-center gap-2 text-center text-booth-muted">
              <ClockIcon size={20} className="animate-spin text-booth-accent" />
              <p className="text-xs font-semibold">Menyusun photostrip kualitas cetak…</p>
            </div>
          ) : finalUrl ? (
            <div className="relative flex h-full w-full min-h-0 min-w-0 items-center justify-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finalUrl}
                alt="Hasil photobooth siap unduh"
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  height: "auto",
                  width: "auto",
                  objectFit: "contain",
                }}
                className="rounded-xl shadow-print border border-[#E2DDD0] dark:border-[#382E24] select-none cursor-pointer transition-transform duration-200 active:scale-[0.99]"
                onClick={() => setLightboxOpen(true)}
              />
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="Perbesar hasil foto"
                className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white hover:bg-black/80 transition"
              >
                🔍 Perbesar
              </button>
            </div>
          ) : null}
        </div>

        {/* MOBILE Customization Console (< md) */}
        <div className="flex shrink-0 flex-col gap-2 md:hidden">
          {/* Mobile Tab Switcher */}
          <div className="flex items-center rounded-xl bg-booth-line/30 dark:bg-booth-nightline/50 p-1 gap-1 border border-booth-line/60 dark:border-booth-nightline/60">
            <button
              type="button"
              onClick={() => setMobileTab("layout")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                mobileTab === "layout"
                  ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                  : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
              }`}
            >
              📐 Layout
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("frame")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                mobileTab === "frame"
                  ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                  : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
              }`}
            >
              🖼️ Bingkai
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("filter")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                mobileTab === "filter"
                  ? "bg-booth-card dark:bg-booth-nightcard text-booth-ink dark:text-booth-cream shadow-xs"
                  : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim"
              }`}
            >
              ✨ Filter & Teks
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="booth-card rounded-2xl p-2.5 sm:p-3">
            {mobileTab === "layout" && (
              <div className="space-y-1.5">
                {shots.solo ? (
                  <>
                    <Segmented
                      label="Pilih tata letak"
                      value={soloLayout}
                      onChange={(v) => setSoloLayout(v as SoloLayout)}
                      options={SOLO_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
                    />
                    <p className="text-[10px] text-booth-muted dark:text-booth-creamdim text-center font-medium">
                      {SOLO_LAYOUTS.find((l) => l.value === soloLayout)?.desc}
                    </p>
                  </>
                ) : (
                  <>
                    <Segmented
                      label="Pilih tata letak berdua"
                      value={remoteLayout}
                      onChange={(v) => setRemoteLayout(v as RemoteLayout)}
                      options={REMOTE_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
                    />
                    <p className="text-[10px] text-booth-muted dark:text-booth-creamdim text-center font-medium">
                      {REMOTE_LAYOUTS.find((l) => l.value === remoteLayout)?.desc}
                    </p>
                  </>
                )}
              </div>
            )}

            {mobileTab === "frame" && (
              <div>
                <Segmented
                  label="Pilih bingkai"
                  value={String(tplIndex)}
                  onChange={(v) => setTplIndex(Number(v))}
                  options={TEMPLATES.map((t, i) => ({ value: String(i), label: t.name }))}
                />
              </div>
            )}

            {mobileTab === "filter" && (
              <div className="space-y-2">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim block mb-1">
                    Filter Warna
                  </span>
                  <Segmented
                    label="Pilih gaya"
                    value={style}
                    onChange={setStyle}
                    options={PHOTO_STYLES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim block mb-1">
                    Hiasan
                  </span>
                  <Segmented
                    label="Pilih hiasan"
                    value={decor}
                    onChange={setDecor}
                    options={PHOTO_DECORS.map((d) => ({ value: d.value, label: d.label }))}
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim block mb-1">
                    Tulisan / Tanggal (Opsional)
                  </span>
                  <Field
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="cth. Malam Minggu di Bandung"
                    maxLength={60}
                    aria-label="Caption hasil foto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="grid grid-cols-2 gap-2">
              <Btn tone="accent" onClick={download} disabled={!finalBlob} className="text-xs sm:text-sm font-bold py-2.5 shadow-md">
                <DownloadIcon size={16} />
                Unduh Foto
              </Btn>
              <GhostBtn onClick={share} disabled={!finalBlob} className="text-xs sm:text-sm font-bold py-2.5">
                {shared ? <CheckIcon size={16} className="text-emerald-500" /> : <ShareIcon size={16} />}
                {shared ? "Tersimpan" : "Bagikan"}
              </GhostBtn>
            </div>
            <div className="flex items-center justify-between px-1 text-xs">
              <button
                type="button"
                onClick={retake}
                className="text-xs font-semibold text-booth-muted hover:text-booth-ink py-1 transition dark:text-booth-creamdim"
              >
                🔄 {shots.solo ? "Ambil Ulang Foto" : "Ambil Ulang Bersama"}
              </button>
              <button
                type="button"
                onClick={() => setBackHome(true)}
                className="text-xs font-semibold text-booth-muted hover:text-booth-ink py-1 transition dark:text-booth-creamdim"
              >
                {shots.solo ? "← Beranda" : "← Ruang Tunggu"}
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP Customization Console (>= md) */}
        <div className="hidden md:flex shrink-0 flex-col gap-3 overflow-y-auto md:min-h-0 md:justify-start lg:gap-3.5 pr-0.5">
          {/* Group 0: Layout Selection */}
          <div className="booth-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block">
                Tata Letak (Layout)
              </label>
              <span className="text-[10px] font-bold text-booth-accent">
                {shots.solo
                  ? SOLO_LAYOUTS.find((l) => l.value === soloLayout)?.label
                  : REMOTE_LAYOUTS.find((l) => l.value === remoteLayout)?.label}
              </span>
            </div>
            {shots.solo ? (
              <>
                <Segmented
                  label="Pilih tata letak"
                  value={soloLayout}
                  onChange={(v) => setSoloLayout(v as SoloLayout)}
                  options={SOLO_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
                />
                <p className="mt-2 text-[11px] text-booth-muted dark:text-booth-creamdim leading-tight">
                  {SOLO_LAYOUTS.find((l) => l.value === soloLayout)?.desc}
                </p>
              </>
            ) : (
              <>
                <Segmented
                  label="Pilih tata letak"
                  value={remoteLayout}
                  onChange={(v) => setRemoteLayout(v as RemoteLayout)}
                  options={REMOTE_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
                />
                <p className="mt-2 text-[11px] text-booth-muted dark:text-booth-creamdim leading-tight">
                  {REMOTE_LAYOUTS.find((l) => l.value === remoteLayout)?.desc}
                </p>
              </>
            )}
          </div>

          {/* Group 1: Template Selection */}
          <div className="booth-card rounded-2xl p-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block mb-2">
              Bingkai Photostrip
            </label>
            <Segmented
              label="Pilih bingkai"
              value={String(tplIndex)}
              onChange={(v) => setTplIndex(Number(v))}
              options={TEMPLATES.map((t, i) => ({ value: String(i), label: t.name }))}
            />
          </div>

          {/* Group 2: Style & Decor */}
          <div className="booth-card rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block mb-2">
                Efek Warna / Filter
              </label>
              <Segmented
                label="Pilih gaya"
                value={style}
                onChange={setStyle}
                options={PHOTO_STYLES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block mb-2">
                Hiasan
              </label>
              <Segmented
                label="Pilih hiasan"
                value={decor}
                onChange={setDecor}
                options={PHOTO_DECORS.map((d) => ({ value: d.value, label: d.label }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim block mb-1.5">
                Tulisan / Tanggal (Opsional)
              </label>
              <Field
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="cth. Malam Minggu di Bandung"
                maxLength={60}
                aria-label="Caption hasil foto"
              />
            </div>
          </div>

          {/* Group 3: Primary Actions */}
          <div className="mt-auto pt-1 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Btn tone="accent" onClick={download} disabled={!finalBlob} className="text-sm font-bold shadow-md">
                <DownloadIcon size={16} />
                Unduh Foto
              </Btn>
              <GhostBtn onClick={share} disabled={!finalBlob} className="text-sm font-bold">
                {shared ? <CheckIcon size={16} className="text-emerald-500" /> : <ShareIcon size={16} />}
                {shared ? "Tersimpan" : "Bagikan"}
              </GhostBtn>
            </div>

            <GhostBtn onClick={retake} className="text-xs font-semibold py-2.5">
              <RefreshIcon size={15} />
              {shots.solo ? "Ambil Ulang Foto" : "Ambil Ulang Bersama"}
            </GhostBtn>

            <button
              onClick={() => setBackHome(true)}
              className="text-center text-xs font-semibold text-booth-muted hover:text-booth-ink py-1 transition dark:text-booth-creamdim dark:hover:text-white"
            >
              {shots.solo ? "Kembali ke Beranda" : "Kembali ke ruang tunggu booth"}
            </button>
          </div>

          {/* Partner Photo Status */}
          {!shots.solo && (
            <div className="rounded-xl border border-booth-line/70 p-3 bg-black/[0.02] dark:border-booth-nightline/70 dark:bg-white/[0.03]">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-booth-muted dark:text-booth-creamdim">
                Foto Teman ({partnerShots.filter(Boolean).length}/4)
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {partnerShots.map((s, i) => {
                  const ar = shots?.ratio === "1:1" ? "aspect-square" : shots?.ratio === "9:16" ? "aspect-[9/16]" : "aspect-[3/4]";
                  return s ? (
                    <div key={i} className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s} alt={`Foto teman ${i + 1}`} className={`h-11 ${ar} max-w-full rounded-md border border-emerald-500/50 object-cover`} />
                    </div>
                  ) : (
                    <div key={i} className="flex justify-center">
                      <button
                        onClick={() => loadPartner(i)}
                        disabled={loading[i] || !shots.partnerPaths[i]}
                        aria-label={loading[i] ? `Memuat foto teman ${i + 1}` : `Muat ulang foto teman ${i + 1}`}
                        className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-booth-line text-[9px] font-semibold text-booth-muted disabled:opacity-40 dark:border-booth-nightline dark:text-booth-creamdim"
                      >
                        <RefreshIcon size={12} />
                        <span>{loading[i] ? "…" : shots.partnerPaths[i] ? "Muat" : "Tunggu"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {backHome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-booth-line p-4 text-center bg-booth-card shadow-2xl dark:border-booth-nightline dark:bg-booth-nightcard">
            <p className="text-sm font-semibold text-booth-ink dark:text-booth-cream">
              Foto sudah diunduh? Lanjut keluar dari studio foto ini?
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <GhostBtn onClick={() => setBackHome(false)} className="min-h-[38px] text-xs font-semibold">
                Tetap di sini
              </GhostBtn>
              <Btn onClick={() => router.push(shots?.solo ? "/" : `/room/${code}`)} className="min-h-[38px] text-xs font-bold">
                Ya, keluar
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Zoom Modal */}
      {lightboxOpen && finalUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-[95vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={finalUrl}
              alt="Ukuran penuh hasil photobooth"
              className="max-h-[78vh] w-auto rounded-2xl shadow-2xl object-contain border border-white/10"
            />
            <div className="mt-3 flex items-center gap-3">
              <Btn tone="accent" onClick={download} className="text-xs sm:text-sm font-bold px-4 py-2 shadow-lg">
                <DownloadIcon size={16} />
                Unduh Foto
              </Btn>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
