"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { roomApi, RoomApiError, type Member } from "@/lib/room/api";
import { normalizeCode, validateDisplayName } from "@/lib/room/session";
import { loadRoomBundle, saveRoomBundle, saveCaptureBundle, loadCaptureBundle, type RoomBundle } from "@/lib/room/bundle";
import { useCamera } from "@/hooks/useCamera";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { track } from "@/lib/analytics/events";
import type { RoomBroadcastEvent } from "@/types/realtime";
import { Btn, GhostBtn, Field, Card, ErrorMsg, Dot } from "@/components/ui";
import { CameraView } from "@/components/CameraView";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);
  const router = useRouter();

  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shareLink, setShareLink] = useState(`/room/${code}`);
  const [members, setMembers] = useState<Member[]>([]);
  const [roomStatus, setRoomStatus] = useState<string>("memuat...");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  const cam = useCamera();
  const cameraReady = cam.status === "ready";

  const me = useMemo(
    () =>
      bundle
        ? { participantId: bundle.participantId, displayName: bundle.displayName, cameraReady }
        : null,
    [bundle, cameraReady],
  );

  const goCapture = useCallback(
    (sessionDbId: string) => {
      saveCaptureBundle(code, { sessionDbId });
      router.push(`/room/${code}/capture`);
    },
    [code, router],
  );

  const onEvent = useCallback(
    (e: RoomBroadcastEvent) => {
      if (e.event === "session_started") {
        track("session_started", bundle?.roomId);
        goCapture(e.sessionId);
      } else if (e.event === "room_ended") {
        setError("Host mengakhiri room ini.");
      }
    },
    [bundle?.roomId, goCapture],
  );

  const { peers, connected, send } = useRoomChannel(code, me, onEvent);

  // Baca storage + origin setelah mount: sinkronisasi React ↔ browser
  // storage setelah SSR. Server dan client render shell yang sama.
  /* eslint-disable react-hooks/set-state-in-effect -- sinkronisasi mount ↔ storage browser, sah */
  useEffect(() => {
    setBundle(loadRoomBundle(code));
    setShareLink(`${window.location.origin}/room/${code}`);
    setMounted(true);
  }, [code]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Verifikasi keanggotaan + pulihkan sesi aktif (refresh mid-session).
  useEffect(() => {
    if (!bundle) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await roomApi.get(code);
        if (cancelled) return;
        setMembers(r.members);
        setRoomStatus(r.status);
        setExpiresAt(r.expiresAt);
        if (r.status === "expired" || r.status === "completed") {
          setError(r.status === "expired" ? "Room sudah kedaluwarsa." : "Room sudah selesai.");
          return;
        }
        // Refresh di tengah sesi → langsung kembali ke capture.
        if (r.activeSession) {
          const existing = loadCaptureBundle(code);
          if (!existing || existing.sessionDbId !== r.activeSession.sessionDbId) {
            saveCaptureBundle(code, r.activeSession);
          }
          router.push(`/room/${code}/capture`);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof RoomApiError && e.code === "SESSION_UNKNOWN") {
          // session_id tak dikenal → perlakukan sebagai pendatang baru.
          setBundle(null);
        } else {
          setError(e instanceof RoomApiError ? e.message : "Tidak bisa memuat room.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, bundle?.participantId]);

  // Segarkan daftar member saat presence berubah (tanpa postgres_changes).
  useEffect(() => {
    if (peers.length === 0 || !bundle) return;
    roomApi.get(code).then(
      (r) => setMembers(r.members),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers.length]);

  const doJoin = async () => {
    setError(null);
    setJoining(true);
    try {
      const displayName = validateDisplayName(joinName);
      const r = await roomApi.join(code, displayName);
      const meRow = r.members.find((m) => m.id === r.participantId);
      const b = { roomId: r.roomId, participantId: r.participantId, displayName, role: meRow?.role ?? ("guest" as const) };
      saveRoomBundle(code, b);
      setBundle(b);
      setMembers(r.members);
      track("room_joined", r.roomId);
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa gabung. Periksa kode.");
    } finally {
      setJoining(false);
    }
  };

  const doStart = async () => {
    if (!bundle || bundle.role !== "host") return;
    setError(null);
    setStarting(true);
    try {
      const r = await roomApi.start(code);
      track("session_started", bundle.roomId);
      // Sinyal masuk capture saja; tiap foto dipicu manual per tombol host.
      await send({ event: "session_started", sessionId: r.sessionDbId, totalShots: 4 });
      goCapture(r.sessionDbId);
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa memulai sesi.");
      setStarting(false);
    }
  };

  const [ending, setEnding] = useState(false);
  const doEnd = async () => {
    if (!bundle || bundle.role !== "host") return;
    setEnding(true);
    try {
      await roomApi.end(code);
      await send({ event: "room_ended" });
      router.push("/");
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "Tidak bisa mengakhiri room.");
      setEnding(false);
    }
  };

  const bothCamerasReady = useMemo(() => {
    const ready = peers.filter((p) => p.cameraReady).map((p) => p.participantId);
    return bundle ? ready.includes(bundle.participantId) && peers.filter((p) => p.cameraReady).length >= 2 : false;
  }, [peers, bundle]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard diblokir — user bisa salin manual */
    }
  };

  if (!mounted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <p className="text-center text-sm text-zinc-500">Memuat room...</p>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <h1 className="text-center text-2xl font-bold">Room {code}</h1>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Masukkan namamu untuk gabung ke room ini.
        </p>
        <ErrorMsg msg={error} />
        <Card>
          <div className="flex flex-col gap-3">
            <Field value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Namamu" maxLength={30} autoComplete="nickname" />
            <Btn onClick={doJoin} disabled={joining}>
              {joining ? "Gabung..." : "Gabung"}
            </Btn>
            <GhostBtn onClick={() => router.push("/")}>Kembali</GhostBtn>
          </div>
        </Card>
      </main>
    );
  }

  const partner = members.find((m) => m.id !== bundle.participantId);
  const partnerPeer = peers.find((p) => p.participantId !== bundle.participantId);
  const iAmHost = bundle.role === "host";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">ROOM {code}</h1>
        <span className="text-xs text-zinc-500">{connected}</span>
      </div>

      <ErrorMsg msg={error} />

      <Card>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span>
              👤 {bundle.displayName} {iAmHost ? "(host)" : ""}
            </span>
            <Dot on={cameraReady} label={cameraReady ? "Kamera siap" : "Kamera belum"} />
          </div>
          <div className="flex items-center justify-between">
            <span>👤 {partner ? partner.displayName : "Menunggu pasangan..."}</span>
            <Dot on={Boolean(partnerPeer)} label={partnerPeer ? "Online" : "Offline"} />
          </div>
          <p className="text-xs text-zinc-500">
            Status: {roomStatus}
            {expiresAt ? ` · kedaluwarsa ${new Date(expiresAt).toLocaleString("id-ID")}` : ""}
          </p>
        </div>
      </Card>

      <CameraView
        videoRef={cam.videoRef}
        ready={cameraReady}
        label="Kamu"
        mirrored={cam.mirrored}
        onToggleMirror={cam.toggleMirror}
      />

      {cam.status === "requesting" ? (
        <p className="text-center text-sm text-zinc-500">Membuka kamera...</p>
      ) : cam.status === "idle" || cam.status === "error" || cam.status === "denied" || cam.status === "unsupported" ? (
        <Card>
          <div className="flex flex-col gap-3">
            {cam.message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{cam.message}</p>}
            <Btn onClick={() => cam.start().then((ok) => ok && track("camera_ready", bundle.roomId))}>
              {cam.status === "idle" ? "Aktifkan Kamera" : "Coba Lagi"}
            </Btn>
            <p className="text-xs text-zinc-500">Kamera hanya dipakai selama sesi dan tidak merekam video.</p>
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="text-sm font-medium">Bagikan link ini ke pasanganmu:</p>
        <p className="mt-1 break-all rounded-xl bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900">{shareLink}</p>
        <div className="mt-3">
          <GhostBtn onClick={copyLink}>{copied ? "Tersalin!" : "Salin Link"}</GhostBtn>
        </div>
      </Card>

      {iAmHost ? (
        <>
          <Btn onClick={doStart} disabled={!bothCamerasReady || starting || !cameraReady}>
            {starting ? "Memulai..." : bothCamerasReady ? "MULAI SESI FOTO" : "Menunggu pasangan siap..."}
          </Btn>
          <button onClick={doEnd} disabled={ending} className="text-center text-sm text-zinc-500 disabled:opacity-50">
            {ending ? "Mengakhiri..." : "Akhiri room"}
          </button>
        </>
      ) : (
        <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-center text-sm dark:bg-zinc-900">
          {bothCamerasReady ? "Siap! Menunggu host menekan mulai..." : "Menunggu host memulai sesi..."}
        </p>
      )}
    </main>
  );
}
