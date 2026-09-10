"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/room/session";
import { loadRoomBundle, loadCaptureBundle, saveShotsBundle } from "@/lib/room/bundle";
import { useCamera } from "@/hooks/useCamera";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { uploadShot, blobToDataURL } from "@/lib/storage/exchange";
import { track } from "@/lib/analytics/events";
import type { RoomBroadcastEvent } from "@/types/realtime";
import { GhostBtn, ErrorMsg } from "@/components/ui";
import { CameraView } from "@/components/CameraView";
import { getServerOffset } from "@/lib/realtime/clock";
import { supabase } from "@/lib/supabase/client";
import { roomApi } from "@/lib/room/api";

interface State {
  done: boolean[];
  acked: boolean[];
  uploading: boolean[];
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const bundle = useMemo(() => loadRoomBundle(code), [code]);
  const capture = useMemo(() => loadCaptureBundle(code), [code]);

  const cam = useCamera();
  const cameraReady = cam.status === "ready";
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [fired, setFired] = useState<boolean[]>([false, false, false, false]);
  const [st, setSt] = useState<State>({
    done: [false, false, false, false],
    acked: [false, false, false, false],
    uploading: [false, false, false, false],
  });
  const [myShots, setMyShots] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerPaths, setPartnerPaths] = useState<(string | null)[]>([null, null, null, null]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [partnerName, setPartnerName] = useState("Pasangan");
  const bgQueue = useRef<{ seq: number; blob: Blob; tries: number }[]>([]);

  const me = useMemo(
    () =>
      bundle
        ? { participantId: bundle.participantId, displayName: bundle.displayName, cameraReady }
        : null,
    [bundle, cameraReady],
  );

  const targetTimes = capture?.targetTimes ?? null;

  // Plain function (not memoized): reads latest state when partner's
  // session_finished arrives or user taps "Lihat Hasil". Defined before
  // onEvent so the broadcast handler always sees a fresh closure.
  function finishLocal() {
    if (!bundle || !capture) return;
    const date = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    saveShotsBundle(code, {
      code,
      sessionDbId: capture.sessionDbId,
      date,
      myRole: bundle.role,
      myName: bundle.displayName,
      partnerName,
      myShots,
      partnerShots: [null, null, null, null],
      partnerId,
      partnerPaths,
      roomId: bundle.roomId,
    });
    router.push(`/room/${code}/result`);
  }

  function onEvent(e: RoomBroadcastEvent) {
    if (e.event === "capture_ack" && e.sequence >= 1 && e.sequence <= 4 && e.participantId !== bundle?.participantId) {
      setPartnerId(e.participantId);
      setPartnerPaths((prev) => {
        const next = [...prev];
        next[e.sequence - 1] = e.storagePath;
        return next;
      });
    } else if (e.event === "session_finished") {
      finishLocal();
    }
  }

  const { send } = useRoomChannel(code, me, onEvent);

  // Redirect ganda: tanpa bundle/capture → kembali ke ruang tunggu.
  useEffect(() => {
    if (!bundle || !capture) router.replace(`/room/${code}`);
  }, [bundle, capture, code, router]);

  // Kamera auto-start (sudah ada konteks: user menekan MULAI di ruang tunggu).
  useEffect(() => {
    cam.start().then((ok) => ok && track("camera_ready", bundle?.roomId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offset jam server, hitung ulang tiap sesi (§9).
  useEffect(() => {
    getServerOffset(async () => {
      const { data } = await supabase.rpc("server_time_ms");
      return typeof data === "number" ? data : Date.now();
    }).then(setOffset, () => {});
    roomApi.get(code).then(
      (r) => {
        const other = r.members.find((m) => m.id !== bundle?.participantId);
        if (other) setPartnerName(other.displayName);
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick 100ms untuk countdown presisi.
  useEffect(() => {
    if (!targetTimes) return;
    const id = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(id);
  }, [targetTimes, offset]);

  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const doUpload = useCallback(
    async (seq: number, blob: Blob, tries = 0) => {
      if (!bundle || !capture) return;
      setSt((s) => {
        const uploading = [...s.uploading];
        uploading[seq - 1] = true;
        return { ...s, uploading };
      });
      try {
        const path = await uploadShot(capture.sessionDbId, seq, blob);
        setSt((s) => {
          const uploading = [...s.uploading];
          uploading[seq - 1] = false;
          return { ...s, uploading };
        });
        await send({
          event: "capture_ack",
          sessionId: capture.sessionDbId,
          sequence: seq as 1 | 2 | 3 | 4,
          participantId: bundle.participantId,
          capturedAt: Date.now(),
          storagePath: path,
        });
        track("capture_completed", bundle.roomId, { shot: seq });
      } catch {
        if (tries < 1) {
          // Retry 1x; setelah itu slot pasangan jadi placeholder (§14).
          bgQueue.current.push({ seq, blob, tries: tries + 1 });
        }
        setSt((s) => {
          const uploading = [...s.uploading];
          uploading[seq - 1] = false;
          return { ...s, uploading };
        });
      }
    },
    [bundle, capture, send],
  );

  // Proses antrean background tanpa memblokir jadwal.
  useEffect(() => {
    if (bgQueue.current.length === 0) return;
    const q = [...bgQueue.current];
    bgQueue.current = [];
    if (q.length > 8) q.splice(0, q.length - 8);
    for (const item of q) void doUpload(item.seq, item.blob, item.tries);
  }, [now, doUpload]);

  const fireShot = useCallback(
    async (index: number) => {
      if (!bundle || !capture) return;
      setFired((f) => {
        if (f[index]) return f;
        const n = [...f];
        n[index] = true;
        return n;
      });
      try {
        const blob = await cam.captureShot();
        const url = await blobToDataURL(blob);
        setMyShots((prev) => {
          const n = [...prev];
          n[index] = url;
          return n;
        });
        setSt((s) => {
          const done = [...s.done];
          done[index] = true;
          return { ...s, done };
        });
        // Upload jalan di background; jadwal tidak menunggu (§10).
        void doUpload(index + 1, blob);
      } catch {
        setSt((s) => {
          const done = [...s.done];
          done[index] = true;
          return { ...s, done };
        });
        setError(`Foto ${index + 1} gagal diambil, lanjut ke berikutnya.`);
      }
    },
    [bundle, capture, cam, doUpload],
  );

  // Cek tiap tick: tembak shot yang targetTimes-nya lewat dan belum fired.
  useEffect(() => {
    if (!targetTimes || !cameraReady) return;
    targetTimes.forEach((t, i) => {
      if (now >= t && !fired[i]) void fireShot(i);
    });
  }, [now, targetTimes, fired, cameraReady, fireShot]);

  const allDone = st.done.every(Boolean);
  const nextIndex = targetTimes ? targetTimes.findIndex((t) => t > now) : -1;
  const remainingMs = nextIndex >= 0 && targetTimes ? Math.max(0, targetTimes[nextIndex] - now) : 0;
  // Jeda antar-shot 7 dtk; 3 dtk terakhir tampil sebagai hitung mundur.
  const countdown = nextIndex >= 0 ? Math.ceil(remainingMs / 1000) : 0;
  const showNumber = nextIndex >= 0 && remainingMs <= 3500;

  const finish = async () => {
    if (finishing || !capture || !bundle) return;
    setFinishing(true);
    try {
      await roomApi.finish(capture.sessionDbId);
      await send({ event: "session_finished", sessionId: capture.sessionDbId });
      track("session_completed", bundle.roomId);
    } catch {
      /* best-effort — halaman result tetap bisa dibuka */
    }
    finishLocal();
  };

  if (!bundle || !capture) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-center text-lg font-bold">Sesi Foto — {code}</h1>
      <ErrorMsg msg={error} />
      {tabHidden && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Tab tidak aktif — kembali ke tab ini agar countdown tetap akurat.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <CameraView
          videoRef={cam.videoRef}
          ready={cameraReady}
          label="Kamu"
          mirrored={cam.mirrored}
          onToggleMirror={cam.toggleMirror}
        />
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-900">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-zinc-400">
            <span className="text-2xl">📷</span>
            <span className="px-3 text-center text-xs">{partnerName} — foto muncul setelah tiap shot</span>
          </div>
          <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {partnerName}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
        {!cameraReady ? (
          <p className="text-sm text-zinc-500">Menyiapkan kamera...</p>
        ) : nextIndex >= 0 ? (
          <>
            <p className="text-xs text-zinc-500">
              Foto {nextIndex + 1} dari 4 {st.uploading.some(Boolean) ? "· mengunggah..." : ""}
            </p>
            {showNumber ? (
              <p className="mt-1 text-6xl font-bold tabular-nums" aria-live="polite">
                {countdown}
              </p>
            ) : (
              <p className="mt-1 text-2xl font-semibold" aria-live="polite">
                Bersiap...
              </p>
            )}
            <p className="mt-1 text-sm text-zinc-500">Bersiap... foto diambil otomatis</p>
          </>
        ) : allDone ? (
          <>
            <p className="text-lg font-semibold">Semua 4 foto selesai!</p>
            <p className="mt-1 text-sm text-zinc-500">
              Foto pasangan yang belum tiba tampil sebagai placeholder dan bisa dimuat ulang di halaman hasil.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Menyelesaikan...</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ${st.done[i] ? "ring-2 ring-green-500" : ""}`}
          >
            {myShots[i] ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL jepretan lokal; next/image tidak bisa optimasi
              <img src={myShots[i]!} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>

      {allDone && (
        <GhostBtn onClick={finish} disabled={finishing}>
          {finishing ? "Menyiapkan hasil..." : "Lihat Hasil"}
        </GhostBtn>
      )}

      <button onClick={() => router.push(`/room/${code}`)} className="text-center text-sm text-zinc-500">
        Kembali ke ruang tunggu
      </button>
    </main>
  );
}
