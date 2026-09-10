"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/room/session";
import { loadShotsBundle } from "@/lib/room/bundle";
import { downloadShot } from "@/lib/storage/exchange";
import { composeFinal } from "@/lib/canvas/compose";
import { track } from "@/lib/analytics/events";
import { TEMPLATES } from "@/types/template";
import { Btn, GhostBtn, Card, ErrorMsg } from "@/components/ui";

export default function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const shots = useMemo(() => loadShotsBundle(code), [code]);
  const [tplIndex, setTplIndex] = useState(0);
  const [partnerShots, setPartnerShots] = useState<(string | null)[]>(() => shots?.partnerShots ?? [null, null, null, null]);
  const [loading, setLoading] = useState<boolean[]>([false, false, false, false]);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!shots) router.replace(`/room/${code}`);
  }, [shots, code, router]);

  // Unduh foto pasangan via signed URL; gagal = placeholder + retry (§10).
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
        setError(`Foto pasangan ${index + 1} belum bisa dimuat. Coba Muat Ulang.`);
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

  // Auto-load semua foto pasangan saat halaman dibuka.
  useEffect(() => {
    if (!shots) return;
    shots.partnerPaths.forEach((p, i) => {
      if (p) void loadPartner(i);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots?.sessionDbId]);

  const tpl = TEMPLATES[tplIndex];
  // Slot order [A1,B1,A2,B2,...]: A = host, B = guest (§13).
  const slots = useMemo(() => {
    if (!shots) return Array(8).fill(null) as (string | null)[];
    const mine = shots.myRole === "host" ? shots.myShots : partnerShots;
    const theirs = shots.myRole === "host" ? partnerShots : shots.myShots;
    return [mine[0], theirs[0], mine[1], theirs[1], mine[2], theirs[2], mine[3], theirs[3]];
  }, [shots, partnerShots]);

  useEffect(() => {
    if (!shots) return;
    // Re-compose tiap template/partner-photo berubah — ini sinkronisasi
    // tampilan terhadap data, pola set-state-in-effect yang valid di sini.
    let cancelled = false;
    (async () => {
      setComposing(true);
      setError(null);
      try {
        const names = `${shots.myRole === "host" ? shots.myName : shots.partnerName} & ${shots.myRole === "host" ? shots.partnerName : shots.myName}`;
        const blob = await composeFinal(tpl, slots, { names, date: shots.date });
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
  }, [shots, tpl, slots]);

  const download = () => {
    if (!finalBlob) return;
    const a = document.createElement("a");
    a.href = finalUrl!;
    a.download = `ldr-photobooth-${code}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track("result_downloaded", shots?.roomId);
  };

  const share = async () => {
    if (!finalBlob) return;
    if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
      const file = new File([finalBlob], `ldr-photobooth-${code}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "LDR Photobooth" });
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

  if (!shots) return null;

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-center text-lg font-bold">Hasil Foto — {code}</h1>
      <ErrorMsg msg={error} />

      <div className="flex gap-2">
        {TEMPLATES.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTplIndex(i)}
            className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium ${i === tplIndex ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <Card>
        {composing && !finalUrl ? (
          <p className="py-10 text-center text-sm text-zinc-500">Menyusun foto...</p>
        ) : finalUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL hasil compose; next/image tidak bisa optimasi
          <img src={finalUrl} alt="Hasil photobooth" className="w-full rounded-xl" />
        ) : null}
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {partnerShots.map((s, i) =>
          s ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL unduhan pasangan; next/image tidak bisa optimasi
            <img key={i} src={s} alt={`Pasangan ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
          ) : (
            <button
              key={i}
              onClick={() => loadPartner(i)}
              disabled={loading[i] || !shots.partnerPaths[i]}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl bg-zinc-800 text-[11px] text-zinc-300 disabled:opacity-50"
            >
              {loading[i] ? "Memuat..." : shots.partnerPaths[i] ? "Muat Ulang" : "Menunggu..."}
            </button>
          ),
        )}
      </div>

      <Btn onClick={download} disabled={!finalBlob}>
        Unduh Hasil
      </Btn>
      <GhostBtn onClick={share} disabled={!finalBlob}>
        {shared ? "Sudah Dibagikan!" : "Bagikan"}
      </GhostBtn>
      {!canShare && (
        <p className="text-center text-xs text-zinc-500">Browser tidak mendukung berbagi langsung — gunakan Unduh.</p>
      )}

      <Card>
        <p className="text-sm font-medium">Suka hasilnya?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Apakah terasa benar-benar foto bersama?</li>
          <li>Apakah countdown terasa sinkron?</li>
          <li>Bagian mana yang paling membingungkan?</li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Kirim masukanmu ke penyelenggara beta 💕</p>
      </Card>

      <GhostBtn onClick={() => router.push("/")}>Buat Room Baru</GhostBtn>
    </main>
  );
}
