"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roomApi, RoomApiError } from "@/lib/room/api";
import { validateDisplayName, normalizeCode, getSessionId } from "@/lib/room/session";
import { saveRoomBundle } from "@/lib/room/bundle";
import { track } from "@/lib/analytics/events";
import { Btn, GhostBtn, Field, Card, ErrorMsg } from "@/components/ui";

const STEPS = [
  { emoji: "🎟️", title: "Buat room", desc: "Dapat kode + link" },
  { emoji: "📩", title: "Kirim link", desc: "Pasangan gabung" },
  { emoji: "📸", title: "Foto bareng", desc: "Countdown sinkron" },
];

export default function Landing() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "join">("create");

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
      <div className="pop-in text-center">
        <div className="float-slow mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 text-4xl shadow-[0_6px_0_#9d174d]" aria-hidden>
          📸
        </div>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent">
            LDR PHOTOBOOTH
          </span>
        </h1>
        <p className="mt-2 font-semibold text-zinc-600 dark:text-zinc-300">
          Foto bersama, walau sedang berjauhan. Tanpa daftar, langsung dari browser.
        </p>
      </div>

      <div className="pop-in pop-in-1 grid grid-cols-3 gap-2">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl border-2 border-white bg-white/70 px-2 py-3 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
            <p className="text-2xl" aria-hidden>{s.emoji}</p>
            <p className="font-display mt-1 text-xs">{s.title}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{s.desc}</p>
          </div>
        ))}
      </div>

      <ErrorMsg msg={error} />

      <div className="pop-in pop-in-2">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-pink-200 bg-white/60 p-1.5 dark:border-pink-900 dark:bg-zinc-900/60">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`font-display rounded-xl px-4 py-2.5 text-base transition ${
                tab === t
                  ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-[0_3px_0_#9d174d]"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {t === "create" ? "✨ Buat Room" : "💌 Gabung"}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <Card className="pop-in mt-3">
            <label className="font-display text-sm" htmlFor="create-name">Namamu (opsional)</label>
            <div className="mt-2 flex flex-col gap-3">
              <Field
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth. Kiba"
                maxLength={30}
                autoComplete="nickname"
              />
              <Btn onClick={doCreate} disabled={busy !== null}>
                {busy === "create" ? "Membuat room... 🎟️" : "Buat Room 🎟️"}
              </Btn>
            </div>
          </Card>
        ) : (
          <Card className="pop-in mt-3">
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-display text-sm" htmlFor="join-name">Namamu</label>
                <Field
                  id="join-name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Namamu"
                  maxLength={30}
                  autoComplete="nickname"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="font-display text-sm" htmlFor="join-code">Kode room</label>
                <Field
                  id="join-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="cth. AB7K2P"
                  maxLength={8}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-display mt-1.5 text-center text-xl tracking-[0.3em]"
                />
              </div>
              <GhostBtn onClick={doJoin} disabled={busy !== null || code.trim().length < 6}>
                {busy === "join" ? "Gabung... 💌" : "Gabung Room 💌"}
              </GhostBtn>
            </div>
          </Card>
        )}
      </div>

      <p className="pop-in pop-in-3 text-center text-xs font-semibold text-zinc-500">
        🔒 Kamera hanya aktif saat sesi · Foto per-shot terhapus otomatis dalam 24 jam.
      </p>
    </main>
  );
}
