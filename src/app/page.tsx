"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roomApi, RoomApiError } from "@/lib/room/api";
import { validateDisplayName, normalizeCode, getSessionId } from "@/lib/room/session";
import { saveRoomBundle } from "@/lib/room/bundle";
import { track } from "@/lib/analytics/events";
import { Btn, GhostBtn, Field, Card, ErrorMsg } from "@/components/ui";

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Touch session id early so create/join share one browser slot (FR-02).
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
      setError(e instanceof RoomApiError ? e.message : "Room tidak bisa dibuat. Coba lagi.");
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10">
      <div className="text-center">
        <p className="text-4xl" aria-hidden>
          💕
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">LDR PHOTOBOOTH</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Foto bersama, walau sedang berjauhan. Tanpa daftar, langsung dari browser.
        </p>
      </div>

      <ErrorMsg msg={error} />

      <Card>
        <label className="text-sm font-medium">Nama tampilan (opsional)</label>
        <div className="mt-2 flex flex-col gap-3">
          <Field
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth. Kiba"
            maxLength={30}
            autoComplete="nickname"
          />
          <Btn onClick={doCreate} disabled={busy !== null}>
            {busy === "create" ? "Membuat room..." : "Buat Room"}
          </Btn>
        </div>
      </Card>

      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        atau gabung
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <Field
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Namamu"
            maxLength={30}
            autoComplete="nickname"
          />
          <Field
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kode room (cth. AB7K2P)"
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <GhostBtn onClick={doJoin} disabled={busy !== null || code.trim().length < 6}>
            {busy === "join" ? "Gabung..." : "Gabung Room"}
          </GhostBtn>
        </div>
      </Card>

      <p className="text-center text-xs text-zinc-500">
        Kamera hanya aktif saat sesi. Foto per-shot terhapus otomatis dalam 24 jam.
      </p>
    </main>
  );
}
