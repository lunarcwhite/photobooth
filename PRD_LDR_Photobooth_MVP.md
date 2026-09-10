# Product Requirements Document (PRD)
# LDR Photobooth — MVP Private Beta

**Version:** 1.2
**Status:** Draft siap development
**Target beta:** 6–10 pengguna / beberapa pasangan
**Platform:** Web, mobile-first
**Deployment target:** Free-tier / serverless
**Recommended stack:** Next.js + TypeScript + Tailwind CSS + Supabase + Vercel

### Changelog 1.1 → 1.2
- Kunci penerbit `targetTimes`: `POST room-api/start` hitung dari jam server; host hanya broadcast hasilnya, bukan sumber waktu.
- Definisikan kontrak `room-api` (create/join/get/start/signed-url) + error code + lifecycle `session_id`.
- Kunci Storage: bucket 100% private, upload/download hanya via signed URL dari `room-api`; hapus opsi public bucket.
- Kunci state sync: Broadcast + Presence saja, tanpa `postgres_changes` untuk anon.
- Kunci cleanup: pg_cron + pg_net per jam panggil Edge Function `cleanup` (hapus room expired + file `sessions/*` > 24 jam).
- Kunci upload lambat (lanjut + antre background), komposer di kedua client, mirror selfie, bahasa UX Indonesia.
- Analytics beta: tabel `analytics_events` insert-only, tanpa backend tambahan.

### Changelog 1.0 → 1.1
- Hapus event `capture`/`retake` per-sequence; satu `session_started.targetTimes[4]` jadi satu-satunya jadwal.
- Definisikan photo exchange MVP: upload JPEG per-shot ke Storage temporer (TTL 24 jam), `capture_ack` hanya bawa `storagePath`.
- `NEXT` tidak menunggu ACK pasangan; slot kosong = placeholder + retry.
- Template JSON diperbaiki ke 8 slots; output dikunci `1080×1920` JPEG 0.9.
- Tabel `captures`/`templates` turun ke Post-MVP; tambah contoh RLS + `getServerTime` + aturan host-disconnect.

---

## 1. Product Overview

LDR Photobooth adalah aplikasi web yang memungkinkan dua orang di lokasi berbeda membuat foto bersama. Satu pengguna membuat room, membagikan link/kode, pasangan bergabung dari perangkatnya, lalu kedua kamera disinkronkan untuk mengambil beberapa foto. Hasil foto disusun menjadi satu layout photobooth di browser.

### Value Proposition

- Mengubah aktivitas video-call yang biasa menjadi kenangan visual yang dapat disimpan.
- Tidak membutuhkan aplikasi mobile native atau instalasi.
- Masuk ke room secepat mungkin: MVP tidak mewajibkan akun.
- Pemrosesan foto dilakukan di browser sejauh memungkinkan untuk menekan biaya server.
- Fokus pada pengalaman emosional: **membuat foto bersama walaupun sedang berjauhan**.

---

## 2. Problem Statement

Pasangan LDR dapat berkomunikasi secara real-time, tetapi membuat foto bersama yang terasa seperti hasil photobooth membutuhkan koordinasi manual, screenshot, atau aplikasi tambahan.

LDR Photobooth menyederhanakan proses menjadi satu alur:

> **Create Room → Join → Camera → Countdown → Capture → Result**

### Product Hypothesis

Jika pasangan dapat membuat foto bersama dalam kurang dari 2 menit tanpa registrasi, maka mereka akan menganggap pengalaman tersebut menyenangkan dan bersedia mengulanginya atau membagikan hasilnya.

---

## 3. Goals & Non-Goals

### 3.1 Goals MVP

1. Dua peserta dapat berada di satu room yang sama.
2. Kedua perangkat dapat mengaktifkan kamera melalui HTTPS.
3. Countdown dan perintah capture tersinkron.
4. Peserta dapat mengambil 4 foto per orang dalam satu sesi (4 sequence × 2 peserta = 8 slot).
5. Browser menghasilkan final photobooth image dari foto kedua peserta.
6. Pengguna dapat melihat preview.
7. Pengguna dapat mengunduh hasil.
8. Pengguna dapat membagikan hasil jika browser mendukung Web Share API.
9. Aplikasi nyaman digunakan pada mobile portrait dan desktop.
10. Operasional beta dapat berjalan tanpa VPS berbayar.

### 3.2 Non-Goals MVP

Tidak termasuk pada versi pertama:

- Video call penuh / live video pasangan.
- Login dan profil pengguna.
- Payment/subscription.
- Social feed atau komunitas.
- AI image generation/filter kompleks.
- Native Android/iOS app.
- Template marketplace.
- Galeri permanen pengguna.
- Sistem friend/follow.
- Chat antar peserta.

---

# 4. Target Users

| Persona | Kebutuhan | MVP Response |
|---|---|---|
| Pasangan LDR | Ingin membuat foto bersama | Room + synchronized capture |
| Teman yang ikut beta | Tidak ingin registrasi rumit | Anonymous session |
| Creator/owner | Ingin hasil mudah dibagikan | JPEG + download/share |

---

# 5. Core User Journey

1. User A membuka landing page.
2. User A memilih **Create Room**.
3. User A memasukkan nama tampilan opsional.
4. Sistem membuat room dengan kode pendek dan expiry.
5. User A mendapatkan share link dan menunggu peserta kedua.
6. User B membuka link atau memasukkan kode.
7. User B memasukkan nama tampilan.
8. Sistem mengizinkan maksimal dua participant aktif.
9. Kedua peserta memberikan izin kamera.
10. Room menampilkan status `Ready`.
11. Host menekan `Start`.
12. Host memicu `POST room-api/start`; server membuat capture session + menghitung `targetTimes` dari jam server.
13. Host broadcast `session_started`; kedua browser countdown lokal.
14. Kedua browser menjalankan countdown secara lokal.
15. Pada target time, masing-masing browser mengambil frame kamera ke Canvas.
16. Tiap hasil capture di-upload ke Storage temporer; pasangan menerima `capture_ack.storagePath` lalu download (§14).
17. Siklus diulang sampai 4 foto (jeda tetap, tanpa menunggu ACK pasangan).
18. Browser menyusun foto sesuai template.
19. Final image ditampilkan.
20. User dapat `Download` atau `Share`.

---

# 6. Information Architecture

## 6.1 Screens

| Screen | Route | Tujuan |
|---|---|---|
| Landing | `/` | Create/join room |
| Create Room | `/create` | Membuat room |
| Join Room | `/room/[code]` | Masuk room |
| Waiting Room | `/room/[code]` | Menunggu participant/kamera |
| Capture | `/room/[code]/capture` | Sesi pengambilan foto |
| Result | `/room/[code]/result` | Preview dan download |
| Expired/Error | `/room/[code]` | Menangani room invalid/expired |

## 6.2 UX Principles

- Mobile-first.
- Tombol utama mudah dijangkau.
- State selalu terlihat:
  - Waiting
  - Ready
  - Countdown
  - Captured
  - Processing
  - Result
- Jangan meminta permission kamera sebelum konteksnya jelas.
- Berikan instruksi singkat bila kamera gagal.
- Jangan mengandalkan audio sebagai satu-satunya indikator capture.
- Minimalkan jumlah input dan halaman.
- User harus dapat mencapai sesi capture dengan cepat.
- Bahasa UX: Indonesia untuk semua string user-facing (error, tombol, status).

---

# 7. Functional Requirements

## FR-01 — Room Creation

Sistem harus:

- Membuat internal `room_id` menggunakan UUID.
- Membuat public room code 6–8 karakter.
- Menjamin room code unik.
- Memberikan expiry time (`expires_at = now() + 24 jam`) dan status `completed` saat host end.
- Status DB (`rooms.status`) hanya: `waiting` → `capturing` → `completed`, plus `expired` saat TTL lewat.
  `ready` BUKAN status DB — itu state ephemeral di klien (2 anggota + dua kamera siap via Presence/Broadcast).
- Membatasi room menjadi maksimal dua participant aktif.
- Menyimpan host session (`host_session_id`).
- Memungkinkan host mengakhiri room (status → `completed`).

### Room Lifecycle (status DB — tanpa `ready`)

```text
waiting
   ↓  (POST /start)
capturing
   ↓  (POST /finish)
completed
```

`expired` bukan lanjutan `completed`: `cleanup` menandai `expired`
room yang `expires_at` lewat saat masih `waiting`/`capturing`,
lalu menghapus row + file Storage-nya. `ready` hanya state ephemeral
di klien (lihat FR-01).

---

## FR-02 — Join Room

User dapat masuk menggunakan:

```text
https://app.example.com/room/AB7K2P
```

atau:

```text
AB7K2P
```

### Requirements

- Join tidak membutuhkan akun.
- Nama tampilan 1–30 karakter.
- Jika nama kosong, gunakan fallback `Guest`.
- Participant ketiga harus ditolak oleh `room-api` (cek `count < 2` di dalam transaksi; klien tidak boleh mengandalkan hitungan Presence).
- Lifecycle `session_id`:
  - Dibuat klien sekali via `crypto.randomUUID()` saat create/join pertama, disimpan di `localStorage` key `ldr_session_id`.
  - Dikirim sebagai field `sessionId` di setiap request `room-api`; server cocokkan dengan `participants.session_id` / `rooms.host_session_id`.
  - Bukan secret kriptografis dan bukan auth — hanya pengenal sesi per-browser; jangan taruh data pribadi di dalamnya.
  - Refresh/reconnect: pakai `session_id` yang sama; tab/incognito baru = sesi baru = slot participant baru.
  - Anti-spoof: `participantId` dari broadcast TIDAK dipercaya; setiap aksi tulis (start/signed-url/end) dicek ulang server-side via `session_id`.

---

## FR-03 — Camera Access

Gunakan:

```javascript
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: false
});
```

### Requirements

- Kamera hanya diminta setelah user action.
- Prioritaskan kamera depan pada mobile:

```javascript
{
  video: {
    facingMode: "user"
  }
}
```

- Sediakan fallback jika constraint tidak tersedia: coba `facingMode: "user"` ideal → `video: true` polos → tampilkan error recovery.
- Jangan upload raw video stream.
- Preview menggunakan `<video autoplay playsInline muted>`.
- Stop `MediaStreamTrack` ketika meninggalkan halaman capture.
- Selfie mirror: preview di-mirror via CSS (`scaleX(-1)`), TAPI file capture TIDAK di-mirror (simpan apa adanya seperti kamera belakang) — konsisten di kedua client.
- Crop: `object-fit: cover` ke rasio slot template; jangan stretch.

---

## FR-04 — Realtime

Gunakan **Supabase Realtime Broadcast + Presence SAJA**.

Realtime digunakan untuk:

1. Presence (siapa online/offline).
2. Broadcast event (semua perpindahan state room/session).

LARANGAN: jangan subscribe `postgres_changes` dengan anon key di MVP —
klien anon tidak punya policy SELECT langsung (lihat §18.2), jadi semua
pembacaan state (room status, daftar participant) lewat `room-api`
atau payload Broadcast, bukan query DB langsung.

### Presence

Presence digunakan untuk mengetahui:

- participant online
- participant offline
- reconnect
- jumlah participant aktif

### Broadcast

Broadcast digunakan untuk:

- participant joined
- ready changed
- session started (dengan `targetTimes[4]`)
- capture acknowledgement (dengan `storagePath`, bukan image bytes)
- session finished
- room ended

Tidak ada event `capture` per-sequence dan tidak ada `retake` per-shot di MVP.

## FR-05 — Kontrak `room-api` (Edge Function, satu-satunya penulis DB)

Aturan keras: server TIDAK PERNAH publish Realtime. Pola tulis = klien → `room-api`
(tulis DB, hitung waktu, buat signed URL) → klien broadcast hasilnya.
Ephemeral tanpa DB (ready, ack) = Broadcast langsung antar-klien.

| Method + path | Body | Sukses → aksi klien | Error |
|---|---|---|---|
| `POST /create` | `{displayName, sessionId}` | `{roomId, code, expiresAt, participantId}` | INVALID_NAME, RATE_LIMITED |
| `POST /join` | `{code, displayName, sessionId}` | `{roomId, participantId, members}` | ROOM_NOT_FOUND, ROOM_EXPIRED, ROOM_FULL, INVALID_NAME |
| `GET /get?code=&sessionId=` | — | `{status, expiresAt, members, myRole}` (refresh/reconnect pakai ini) | ROOM_NOT_FOUND, SESSION_UNKNOWN |
| `POST /start` | `{code, sessionId}` host only | `{sessionDbId, targetTimes[4]}` → host broadcast `session_started` | NOT_HOST, NOT_MEMBER, ROOM_EXPIRED, SESSION_ACTIVE |
| `POST /signed-url` | `{sessionDbId, sessionId, sequence, op, participantId?}` — op salah satu: upload, download, final-upload; participantId wajib saat download | `{signedUrl, expiresIn:3600}` path dibangun server, klien tidak kirim path | NOT_MEMBER, BAD_PATH, RATE_LIMITED |
| `POST /finish` | `{sessionDbId, sessionId}` | `{ok:true}` → klien broadcast `session_finished` | NOT_MEMBER |
| `POST /end` | `{code, sessionId}` host only | `{ok:true}` → klien broadcast `room_ended` | NOT_HOST |

`SESSION_UNKNOWN` (sessionId tak dikenal saat `/get`) = perlakukan sebagai pendatang baru,
arahkan ke join ulang — bukan error fatal.

Semua error: HTTP 4xx + `{error: CODE, message: <Indonesia>}`.
Daftar CODE: ROOM_NOT_FOUND, ROOM_EXPIRED, ROOM_FULL, NOT_HOST, NOT_MEMBER,
SESSION_UNKNOWN, SESSION_ACTIVE, INVALID_NAME, BAD_PATH, RATE_LIMITED.

---

# 8. Synchronized Capture Architecture

Ini adalah bagian teknis paling penting.

## 8.1 Jangan melakukan ini

Jangan mengirim:

```text
"capture sekarang!"
```

tepat ketika foto harus diambil.

Network latency dapat menyebabkan:

```text
Device A → capture pada t=1000
Device B → capture pada t=1180
```

Hasil terasa tidak sinkron.

## 8.2 Gunakan Target Timestamp

Server membuat via `POST room-api/start` (jam server, `t0 = server_now + 3000ms`,
jeda antar-shot tetap 7000ms — lihat §11). Bentuknya `targetTimes[4]`, bukan
satu `targetAt` per event:

```json
{
  "sessionId": "uuid",
  "totalShots": 4,
  "targetTimes": [1789033200000, 1789033207000, 1789033214000, 1789033221000]
}
```

`POST /start` mengirim `targetTimes` beberapa detik sebelum `targetTimes[0]`.
```text
Sekarang (server): 12:00:00.000
t0 = targetTimes[0]: 12:00:03.000

Broadcast session_started dikirim:
12:00:00.xxx

Client (setelah koreksi offset §9):
3
2
1
CAPTURE (tepat di targetTimes[i])
```

Kedua client menggunakan `targetTimes` yang sama.

---

# 9. Clock Synchronization

Karena clock perangkat dapat berbeda, client perlu mengetahui offset terhadap waktu server.

Konsep:

```text
serverTime - clientTime = offset
```

Client dapat melakukan beberapa sampling untuk mengestimasi offset.

Contoh:

```javascript
const correctedNow = Date.now() + serverOffset;

const remaining = targetTimes[i] - correctedNow;
```

Implementasi offset (`lib/realtime/clock.ts`):

```typescript
// ponytail: median 5 sampel cukup untuk beta; upgrade ke filter Kalman jika toleransi <100ms.
export async function getServerOffset(
  fetchServerTime: () => Promise<number>, // RPC `select extract(epoch from now())*1000`
  samples = 5,
): Promise<number> {
  const offsets: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const serverNow = await fetchServerTime();
    const t1 = Date.now();
    const rtt = t1 - t0;
    offsets.push(serverNow - (t0 + rtt / 2)); // koreksi setengah RTT
  }
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)]; // median
}
```

```sql
-- RPC waktu server (wajib untuk §9); panggil via supabase.rpc('server_time_ms')
create or replace function server_time_ms()
returns bigint language sql stable as
  $$ select (extract(epoch from now()) * 1000)::bigint $$;
```

Hitung ulang offset tiap `session_started` dan tiap reconnect; tolak sampel RTT > 1000ms.

Countdown dan capture menggunakan `correctedNow`.

### Target Beta

Toleransi sinkronisasi:

> ±150–250 ms

Untuk photobooth, toleransi ini sudah cukup untuk MVP.

---

# 10. Capture Flow

Setiap session terdiri dari 4 sequence dengan jadwal tunggal dari `session_started.targetTimes[4]`.
Tidak ada event `capture` per-sequence — kedua client countdown lokal menuju `targetTimes[i]`.

Untuk setiap sequence:

```text
COUNTDOWN (menuju targetTimes[i])
  ↓
CAPTURE (lokal, Canvas → JPEG blob)
  ↓
UPLOAD (minta signed URL ke room-api, upload JPEG; path DIBANGUN server: sessions/<captureSessionDbId>/<participantId>/<sequence>.jpg)
  ↓
ACK (kirim capture_ack berisi storagePath, bukan image bytes)
  ↓
NEXT (berdasar timer lokal + jeda antar-shot, TIDAK menunggu ACK pasangan)
```

Aturan NEXT:
- Jeda antar-shot tetap 7 detik (`targetTimes[i+1] - targetTimes[i]`, dihitung server).
- Jika foto pasangan belum tiba saat compose, slot diisi placeholder gelap + tombol `Retry load`.
- Retake per-shot tidak ada di MVP; retake = ulangi seluruh session baru.

Aturan upload lambat (mis. 4G lemot, upload > jeda 7 detik):
- Capture berikutnya TETAP jalan sesuai `targetTimes` — jadwal tidak pernah mundur menunggu upload.
- Upload yang belum selesai masuk antrean background (maks. 8 file); lanjutkan selagi sesi berjalan.
- Jika antrean penuh / upload gagal 2x: slot pasangan jadi placeholder, foto lokal sendiri tetap disimpan; tombol `Retry load` / `Retry upload` coba lagi via `room-api/signed-url`.
- Komposer final JALAN di KEDUA client (bukan hanya host); tiap client compose dari foto lokal sendiri + foto pasangan yang berhasil diunduh.

Contoh:

```text
Sequence 1
3 → 2 → 1 → 📸

Sequence 2
3 → 2 → 1 → 📸

Sequence 3
3 → 2 → 1 → 📸

Sequence 4
3 → 2 → 1 → 📸
```

---

# 11. Capture Event Protocol

Gunakan satu Supabase channel per room:

```text
room:<room-id>
```

## Event: `session_started`

`targetTimes` DIHITUNG server di `POST room-api/start` (dari jam server,
bukan clock host), lalu DITERBITKAN via Broadcast oleh host client
(server tidak publish Realtime — lihat FR-05):

```json
{
  "event": "session_started",
  "sessionId": "uuid",
  "totalShots": 4,
  "targetTimes": [
    1789033200000,
    1789033207000,
    1789033214000,
    1789033221000
  ]
}
```

Aturan waktu: `t0 = server_now + 3000ms`, jeda antar-shot tetap 7000ms.
Klien tetap koreksi dengan offset §9 lalu countdown lokal menuju `targetTimes[i]`.

## Event: `capture_ack`

`capture_ack` HANYA membawa pointer Storage, tidak pernah image bytes/base64:

```json
{
  "event": "capture_ack",
  "sessionId": "uuid",
  "sequence": 1,
  "participantId": "uuid",
  "capturedAt": 1789033200015,
  "storagePath": "sessions/<captureSessionDbId>/<participantId>/1.jpg"
}
```

Penerima meminta signed URL download ke `room-api` lalu mengunduh dan compose lokal.
Bucket selalu private — TIDAK ada opsi public bucket di MVP.
Event `capture` per-sequence dan `retake` per-shot DIHAPUS di MVP (jadwal tunggal
`targetTimes[4]` sudah cukup; retake = session baru).

## Scheduler / host-disconnect

- Host memicu Start via `POST room-api/start`; server menghitung `targetTimes`
  dari jam server, host menerbitkan `session_started` via Broadcast (lihat FR-05).
- Jika host disconnect setelah `session_started`, session tetap berjalan
  berdasar `targetTimes` yang sudah diterima (tidak ada leader election di MVP).
- Jika host disconnect sebelum Start, guest menunggu dengan state
  `Waiting for host...`; session tidak dimulai.

## Event: `session_finished`

```json
{
  "event": "session_finished",
  "sessionId": "uuid"
}
```

---

# 12. Photo Capture

Foto diambil secara lokal menggunakan Canvas API.

Konsep:

```text
Camera
  ↓
HTMLVideoElement
  ↓
Canvas
  ↓
Crop / Resize / Mirror
  ↓
Blob
```

Contoh:

```javascript
canvas.toBlob(
  callback,
  "image/jpeg",
  0.85, // q0.85 untuk per-shot upload (§14); final compose pakai q0.9 (§13)
);
```

### Rekomendasi

Preview:

```text
640 × 480
```

Capture:

```text
1280 × 720
```

atau menyesuaikan aspect ratio kamera.

Jangan menggunakan resolusi maksimum perangkat secara default karena dapat meningkatkan:

- memory usage
- processing time
- file size

---

# 13. Image Composition

Final image dibuat menggunakan Canvas.

Contoh layout:

```text
┌─────────────────────────┐
│     OUR LDR MOMENT      │
├───────────┬─────────────┤
│           │             │
│   A - 1   │    B - 1    │
│           │             │
├───────────┼─────────────┤
│           │             │
│   A - 2   │    B - 2    │
│           │             │
├───────────┼─────────────┤
│           │             │
│   A - 3   │    B - 3    │
│           │             │
├───────────┼─────────────┤
│           │             │
│   A - 4   │    B - 4    │
│           │             │
├───────────┴─────────────┤
│       Kiba & Partner    │
│         10.09.2026      │
└─────────────────────────┘
```

## MVP Template

Minimal:

- 2 template (portrait strip + 2×4 grid), keduanya 8 slots (4 shot × 2 participant).
- Slot order: `[A1, B1, A2, B2, A3, B3, A4, B4]` sesuai layout ASCII di atas.
- Optional names + date.

### Output (dikunci)

```text
Canvas: 1080 × 1920, JPEG q0.9
```

Per-shot upload: JPEG sisi panjang ≤ 1280px, q0.85, ≤ 500 KB (§14).
PNG hanya bila template butuh transparansi (bukan default).

---

# 14. Storage Strategy

## MVP — per-shot temp bucket (WAJIB)

Tanpa ini photo exchange tidak jalan. Alur:

```text
Capture lokal (Canvas → JPEG blob, ~1280px, q0.85)
  ↓ minta upload URL
POST room-api/signed-url {sessionDbId, sequence, op:"upload"} → signedUrl
  ↓ upload
Supabase Storage bucket `photobooth-temp` (private, TTL 24 jam)
  path: sessions/<captureSessionDbId>/<participantId>/<sequence>.jpg
  (path DIBANGUN server; klien tidak boleh kirim path bebas)
  ↓ broadcast
capture_ack { storagePath }
  ↓ minta download URL
POST room-api/signed-url {sessionDbId, sequence, op:"download", participantId}
  → signedUrl → unduh → compose final lokal
  ↓
Final image → Download lokal (upload final ke server OPSIONAL)
```

Aturan:
- Bucket 100% private. TIDAK ada public bucket di MVP. Semua upload/download
  via signed URL 1 jam yang dibuat `room-api` setelah cek `session_id` anggota.
- Cleanup pemilik: pg_cron + pg_net tiap jam panggil Edge Function `cleanup`
  (hapus row `rooms` expired + file `sessions/*` berumur > 24 jam + final > 7 hari).
- Batas upload: JPEG ≤ 500 KB/shot (resize + q0.85 di client sebelum upload).
- Jika upload gagal: retry 2x, lalu lanjut — slot pasangan jadi placeholder,
  tombol `Retry load` coba download ulang via `storagePath` dari ACK terakhir.
- Final image TIDAK wajib upload. Upload final hanya jika user minta
  shareable link (bucket terpisah `photobooth-final`, TTL 7 hari).

## Raw Frames

Default:

> **Jangan menyimpan raw frame secara permanen.**

Per-shot JPEG di atas adalah raw frame temporer (24 jam), bukan arsip.
Itu pengecualian yang diizinkan demi photo exchange, dengan retention pendek.

---

# 15. Result Page

Result page harus menampilkan:

- Final image.
- Nama pasangan.
- Tanggal.
- Download.
- Share jika tersedia.
- Create New Session / New Room.

### Download

Gunakan:

```javascript
URL.createObjectURL(blob)
```

dan trigger download.

### Share

Jika browser mendukung:

```javascript
navigator.share(...)
```

Jika tidak:

- Download (selalu tersedia).
- Copy result link HANYA jika user memilih upload final (§14); tanpa itu tidak ada link.

---

# 16. Data Model

MVP hanya 4 tabel: `rooms`, `participants`, `capture_sessions`, `analytics_events`.
`captures` dan `templates` turun ke Post-MVP (lihat §16.4–16.5) —
capture tracking cukup via `capture_sessions.current_shot` + file Storage,
template cukup JSON di frontend.

## 16.1 `rooms`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Internal ID |
| code | text UNIQUE, format A-Z0-9 6–8 | Public room code |
| host_session_id | UUID | Host browser session |
| status | text: waiting/capturing/completed/expired | Room state (tanpa `ready`, lihat FR-01) |
| created_at | timestamptz | Creation time |
| expires_at | timestamptz, default +24 jam | Expiry |

---

## 16.2 `participants`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Participant ID |
| room_id | UUID FK | Room |
| session_id | UUID | Browser session |
| display_name | varchar(30) | Display name |
| role | text | `host` / `guest` |
| joined_at | timestamptz | Join time |
| last_seen_at | timestamptz | Last activity |

---

## 16.3 `capture_sessions`

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Session ID ( = `<captureSessionDbId>` di storage path) |
| room_id | UUID FK | Room |
| status | text: pending/countdown/completed | Session state |
| total_shots | integer | Number of shots |
| current_shot | integer | Current sequence |
| target_times | bigint[] null | 4x epoch-ms server; null sebelum start |
| started_at | timestamptz | Start |
| completed_at | timestamptz | Completion |

---

## 16.4 `captures` — POST-MVP (jangan buat di MVP)

Dibutuhkan hanya jika analytics per-shot / audit diperlukan.
MVP cukup: `capture_sessions.current_shot` + file
`sessions/<captureSessionDbId>/<participantId>/<seq>.jpg` + `capturedAt` dari ACK.

## 16.5 `templates` — POST-MVP (jangan buat di MVP)

MVP: 2 template JSON di frontend (§13, §29). Buat tabel ini saat template
bisa ditambah tanpa deploy.

## 16.6 `analytics_events` — MVP (insert-only)

Satu-satunya tabel analytics beta. Klien insert langsung via anon key
(policy INSERT saja, tanpa SELECT/UPDATE/DELETE) — tidak perlu backend tambahan.

| Column | Type | Description |
|---|---|---|
| id | bigint PK generated always | — |
| created_at | timestamptz default now() | — |
| room_id | UUID nullable | FK longgar (tanpa constraint, agar insert tidak pernah gagal FK) |
| event | text | Salah satu dari daftar §30 |
| meta | JSONB default '{}' | Tambahan kecil (mis. `{"shot":1}`); tanpa image data |

---

# 17. Example SQL

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6,8}$'),
  host_session_id uuid not null,
  status text not null default 'waiting'
    check (status in ('waiting','capturing','completed','expired')),
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  session_id uuid not null,
  display_name varchar(30) not null,
  role text not null check (role in ('host','guest')),
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique (room_id, session_id)
);

create table capture_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','countdown','completed')),
  total_shots integer not null default 4,
  current_shot integer not null default 0,
  target_times bigint[] null, -- 4x epoch-ms dari server (§11); null sebelum start
  started_at timestamptz,
  completed_at timestamptz
);

create table analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  room_id uuid null, -- FK longgar, tanpa constraint
  event text not null,
  meta jsonb not null default '{}'
);
```

```sql
-- RPC waktu server untuk koreksi clock §9
create or replace function server_time_ms()
returns bigint language sql stable as
  $$ select (extract(epoch from now()) * 1000)::bigint $$;
grant execute on function server_time_ms() to anon;

-- Cleanup per jam: pg_cron + pg_net panggil Edge Function `cleanup`
-- (hapus rooms expired + file sessions/* > 24 jam + final > 7 hari, lihat §14)
select cron.schedule(
  'photobooth-cleanup-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := current_setting('app.cleanup_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cleanup_key'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$);
```

> `captures` / `templates`: POST-MVP, jangan dibuat sekarang (§16.4–16.5).

---

# 18. Security & Privacy

## 18.1 Environment Variables

Frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server only — Edge Function `room-api` + `cleanup` (wajib):

```env
SUPABASE_SERVICE_ROLE_KEY=
```

**Service role key tidak boleh masuk ke browser bundle.**

## 18.2 RLS (contoh minimal — copy-paste, hanya ganti nama jika perlu)

MVP tanpa login: anon key TIDAK punya akses DB langsung sama sekali.
Semua baca/tulis lewat Edge Function `room-api` (service_role, bypass RLS).
Policy di bawah sengaja menutup semua akses anon agar bocor query langsung = error, bukan bocor data.

```sql
alter table rooms enable row level security;
alter table participants enable row level security;
alter table capture_sessions enable row level security;
alter table analytics_events enable row level security;

-- TIDAK ADA policy untuk anon di rooms / participants / capture_sessions
-- = anon ditolak semua; akses hanya via room-api (service_role).
-- PENGECUALIAN: analytics_events boleh INSERT langsung dari klien:
create policy "analytics insert only"
on analytics_events for insert to anon
with check (event in ('room_created','room_joined','camera_ready',
  'session_started','capture_completed','session_completed',
  'result_generated','result_downloaded','result_shared','session_failed'));

-- Storage: bucket photobooth-temp + photobooth-final SELALU private.
-- Jangan buat policy public; akses hanya via signed URL dari room-api.
```

Pengecualian tunggal: fungsi `server_time_ms()` boleh dipanggil anon
(untuk koreksi clock §9) karena tidak mengembalikan data apa pun:

```sql
grant execute on function server_time_ms() to anon;
```

## 18.3 Rate Limiting (via Edge Function — Supabase tidak punya bawaan)

Implementasi di `room-api` (counter in-memory per IP; over-limit antar-instance
diterima untuk beta — tanpa tabel tambahan):

| Endpoint | Batas MVP |
|---|---|
| `POST /create` | 10 / jam / IP |
| `POST /join` | 30 / jam / IP |
| `GET /get` | 60 / menit / IP |
| `POST /signed-url` | 32 / session (4 shot × 2 upload+download × 2 retry) |
| `POST /start`, `/finish`, `/end` | 30 / jam / IP |

## 18.4 Input Validation

Validasi server-side di `room-api`:

- display name (1–30 char, strip HTML)
- room code (format 6–8 char A-Z0-9)
- session ID (UUID valid + cocok dengan participant row)
- event payload (`sequence` 1–4, `storagePath` prefix `sessions/<captureSessionDbId>/`)
- tidak ada `template ID` di MVP (template JSON di frontend)

## 18.5 Camera Privacy

Aplikasi:

- Tidak mengupload video stream.
- Tidak merekam audio.
- Tidak menyimpan kamera secara permanen.
- Menggunakan kamera hanya selama sesi.
- Menghentikan MediaStream saat sesi selesai.

---

# 19. Room Security

Room code sebaiknya bersifat mudah dibagikan tetapi tidak mudah ditebak.

Contoh:

```text
AB7K2P
```

Namun code saja tidak cukup sebagai authorization.

Gunakan:

```text
room code
+
browser session token
```

Untuk validasi participant.

### Room Expiration (dikunci)

- `expires_at = created_at + 24 jam`, tidak diperpanjang oleh aktivitas.
- `cleanup` (pg_cron per jam, lihat §14/§17): tandai `expired` room yang
  `expires_at` lewat saat masih `waiting`/`capturing`, lalu hapus row
  (cascade ke participants + capture_sessions) + file Storage terkait.
- Room `completed` TIDAK dihapus langsung — ikut terhapus saat `expires_at` lewat.
- File `sessions/*` > 24 jam dan `final/*` > 7 hari dihapus walau row sudah hilang (sweep by mtime).

---

# 20. Error & Edge Cases

| Kondisi | Expected Behavior |
|---|---|
| Kamera ditolak | Instruksi permission + Retry |
| Browser tidak mendukung camera | Unsupported message |
| Participant ketiga | `Room is full` |
| Host disconnect | Grace period + reconnect state |
| Guest disconnect | Host melihat offline |
| Realtime reconnect | Re-subscribe + sync state |
| Clock mismatch | Recalculate server offset |
| Salah satu capture gagal | Placeholder + `Retry load`; gagal total = session baru |
| Room expired | Tidak dapat join/start |
| Upload per-shot gagal | Retry 2x → placeholder; foto lokal sendiri tetap bisa di-compose |
| Browser sleep | Pause/reconnect handling |
| Tab berpindah | Detect `visibilitychange` |
| Kamera hilang | Stop/prompt recovery |
| User refresh | Reconnect menggunakan session |

---

# 21. Disconnect & Reconnect

Gunakan grace period.

Contoh:

```text
Participant offline
       ↓
  10–30 seconds
       ↓
Reconnected?
   /       \
 Yes        No
 ↓          ↓
Resume    Pause/End
```

MVP tidak harus sempurna untuk seluruh kondisi network, tetapi tidak boleh silent-fail.

User harus tahu apakah:

```text
Connected
Connecting...
Disconnected
Waiting for partner...
```

---

# 22. Performance Requirements

### Web

Target:

- LCP < 2.5 detik pada koneksi mobile wajar.
- Hindari library berat sebelum diperlukan.
- Lazy-load fitur yang tidak dibutuhkan landing page.

### Camera

Baseline:

```text
720p
```

Jangan menggunakan resolusi maksimum secara default.

### Realtime

Payload harus kecil.

Jangan kirim:

```text
❌ image bytes
❌ video
❌ base64 image
```

Kirim:

```text
✅ IDs
✅ timestamps
✅ state
✅ sequence
```

### Canvas

Jika nanti composition menjadi berat:

```text
Canvas
    ↓
OffscreenCanvas
    ↓
Web Worker
```

Untuk MVP, Canvas biasa sudah cukup.

---

# 23. Browser & Device Support

Prioritas:

1. Chrome Android modern.
2. Safari iOS modern.
3. Chrome desktop.
4. Edge desktop.
5. Safari macOS.

### Test minimum

- Android ↔ Android.
- Android ↔ iPhone.
- iPhone ↔ desktop.
- Wi-Fi ↔ Wi-Fi.
- Wi-Fi ↔ cellular.
- Kamera permission denied.
- Reconnect.
- Background tab.

---

# 24. Technical Architecture

```text
                    ┌──────────────────┐
                    │      Vercel      │
                    │     Next.js      │
                    └────────┬─────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
        room-api         Realtime          Storage
     (Edge Function,   (Broadcast +      (private,
      satu-satunya       Presence,        signed URL
      penulis DB)        tanpa             via room-api)
                         postgres_changes)
             │               │
             │               │
       ┌─────┴─────┐    ┌────┴────┐
       │           │    │         │
    User A      User B  Presence  Events
       │           │
       └──── Camera ┘
              │
           Canvas (di kedua client)
              │
         Final Image
```

---

# 25. Recommended Stack

## Frontend

**Next.js**

Alasan:

- React ecosystem.
- Routing.
- Deployment mudah.
- Cocok untuk web app.
- Bisa berkembang ke product publik.

## Language

**TypeScript**

Untuk:

- event contracts
- database types
- room state
- camera state
- template config

## Styling

**Tailwind CSS**

Untuk:

- responsive UI
- mobile-first
- cepat iterasi desain.

## Backend

Tidak perlu custom backend server untuk MVP.

Gunakan:

**Supabase**

Untuk:

- PostgreSQL
- Realtime
- Storage
- Auth jika diperlukan di masa depan.

## Hosting

**Vercel**

Untuk:

- Next.js
- HTTPS
- deployment otomatis
- preview deployment.

---

# 26. Recommended Project Structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── create/
│   │   └── page.tsx
│   └── room/
│       └── [code]/
│           ├── page.tsx
│           ├── capture/
│           │   └── page.tsx
│           └── result/
│               └── page.tsx
│
├── components/
│   ├── camera/
│   ├── room/
│   ├── countdown/
│   ├── photobooth/
│   └── ui/
│
├── hooks/
│   ├── useCamera.ts
│   ├── useRoomPresence.ts
│   └── useCaptureSession.ts
│
├── lib/
│   ├── supabase/
│   ├── realtime/
│   ├── camera/
│   ├── canvas/
│   └── room/
│
├── types/
│   ├── room.ts
│   ├── realtime.ts
│   └── template.ts
│
└── styles/
```

---

# 27. State Machine

## Room (status DB — sinkron dengan FR-01)

```text
WAITING
   ↓
CAPTURING
   ↓
COMPLETED
```

(`EXPIRED` ditandai cleanup untuk WAITING/CAPTURING yang lewat TTL.
`READY` hanya state ephemeral di klien, bukan status DB.)

## Participant

```text
JOINING
   ↓
CONNECTED
   ↓
CAMERA_PENDING
   ↓
READY
   ↓
CAPTURING
   ↓
COMPLETED
```

## Capture Session

```text
PENDING
  ↓
COUNTDOWN (menuju targetTimes[i], timer lokal)
  ↓
CAPTURE (lokal) → UPLOAD (background, tidak blokir jadwal)
  ↓
NEXT_SHOT (timer lokal; tidak menunggu ACK pasangan)
  ↓
COMPLETED (setelah shot ke-4; compose dari foto yang terkumpul)
```

Tidak ada state ACKNOWLEDGED per-shot di MVP — ACK hanya notifikasi
best-effort agar pasangan tahu `storagePath`, bukan gerbang lanjut.

---

# 28. UI Specification

## Landing

```text
┌─────────────────────────────┐
│                             │
│       💕 LDR PHOTOBOOTH     │
│                             │
│  Take a photo together,     │
│  even when you're apart.    │
│                             │
│      [ Create Room ]        │
│                             │
│       ─── or ───            │
│                             │
│   [ Enter Room Code ]       │
│                             │
└─────────────────────────────┘
```

## Waiting Room

```text
┌─────────────────────────────┐
│         ROOM AB7K2P         │
│                             │
│   👤 Kiba       ● Online    │
│                             │
│   👤 Partner    ● Online    │
│                             │
│   Camera: ✓ Ready           │
│                             │
│       [ START ]             │
└─────────────────────────────┘
```

## Capture

```text
┌──────────────┬──────────────┐
│              │              │
│     YOU      │   PARTNER    │
│              │              │
│     📷       │      📷      │
│              │              │
└──────────────┴──────────────┘

              3

          [ capture ]
```

## Result

```text
┌─────────────────────────────┐
│                             │
│       OUR LDR MOMENT        │
│                             │
│      [ FINAL PHOTO ]        │
│                             │
│      Kiba & Partner         │
│         10.09.2026          │
│                             │
│       [ Download ]          │
│       [ Share ]             │
│                             │
└─────────────────────────────┘
```

---

# 29. Template System

Template sebaiknya menggunakan konfigurasi JSON daripada hard-code.

Contoh (strip portrait 1080×1920, 8 slots — order `[A1,B1,A2,B2,A3,B3,A4,B4]`):

```json
{
  "width": 1080,
  "height": 1920,
  "background": "#ffffff",
  "slots": [
    { "x": 60, "y": 180, "width": 470, "height": 380 },
    { "x": 550, "y": 180, "width": 470, "height": 380 },
    { "x": 60, "y": 580, "width": 470, "height": 380 },
    { "x": 550, "y": 580, "width": 470, "height": 380 },
    { "x": 60, "y": 980, "width": 470, "height": 380 },
    { "x": 550, "y": 980, "width": 470, "height": 380 },
    { "x": 60, "y": 1380, "width": 470, "height": 380 },
    { "x": 550, "y": 1380, "width": 470, "height": 380 }
  ],
  "text": {
    "title": "OUR LDR MOMENT",
    "showNames": true,
    "showDate": true
  }
}
```

MVP: 2 template JSON di-hardcode di frontend (bukan tabel DB).
Tabel `templates` masuk Post-MVP (§16.5).

Keuntungannya:

- Template baru tidak membutuhkan perubahan besar pada composer.
- Admin dapat menambah template di kemudian hari.
- Bisa berkembang menjadi template marketplace.

---

# 30. Analytics

Untuk beta 6–10 orang: insert langsung ke `analytics_events` (§16.6)
tanpa backend. Klien fire-and-forget; gagal insert tidak boleh blokir UX.

Contoh:

```typescript
await supabase.from("analytics_events").insert({
  room_id: roomId, // nullable
  event: "capture_completed",
  meta: { shot: 1 },
});
```

## Metrics

| Metric | Definition | Initial Target |
|---|---|---|
| Room creation rate | Create room / landing visitors | ≥ 80% tester |
| Join completion | Guest joined / invited | ≥ 90% |
| Camera readiness | Two participants ready / joined rooms | ≥ 90% |
| Session completion | 4 photos completed / sessions started | ≥ 80% |
| Result generation | Final image / completed session | ≥ 95% |
| Download rate | Downloads / result views | ≥ 60% |
| Median time-to-photo | Create → first capture | < 2 menit |
| Critical failure | Session failed technically | < 10% |

## Events

Minimal:

```text
room_created
room_joined
camera_ready
session_started
capture_completed
session_completed
result_generated
result_downloaded
result_shared
session_failed
```

Jangan mengirim image data ke analytics. Daftar event = whitelist policy
`analytics insert only` di §18.2 — tambah event baru = ubah policy dulu.

---

# 31. Qualitative Beta Feedback

Setelah sesi selesai, tampilkan feedback sederhana:

1. **Apakah Anda merasa benar-benar "foto bersama"?**
2. **Bagian mana yang paling membingungkan?**
3. **Apakah countdown terasa sinkron?**
4. **Apakah hasil foto cukup bagus untuk dibagikan?**
5. **Apakah Anda akan menggunakan ini lagi?**
6. **Fitur apa yang paling ingin Anda gunakan berikutnya?**

Feedback kualitatif lebih penting daripada analytics kompleks pada tahap 6–10 tester.

---

# 32. Deployment Strategy

## MVP

```text
GitHub
   ↓
Vercel
   ↓
Next.js
   ↓
Supabase
```

Tidak membutuhkan:

```text
❌ VPS
❌ Docker server
❌ Redis
❌ custom WebSocket server
❌ Laravel
❌ Node.js server terpisah
```

## Environment

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Service role hanya untuk Edge Function `room-api` (wajib, bukan opsional).

---

# 33. Free-Tier Strategy

Untuk beta kecil, target architecture:

```text
Frontend
→ Vercel

Database
→ Supabase PostgreSQL

Realtime
→ Supabase Realtime

Storage
→ Supabase Storage
```

Jika storage foto menjadi komponen biaya terbesar ketika produk berkembang, pertimbangkan:

```text
Cloudflare R2
```

untuk final images.

### Prinsip cost control

1. Jangan upload video.
2. Upload HANYA per-shot JPEG temporer (§14, TTL 24 jam) — tidak ada raw frame lain.
3. Generate final image di browser.
4. Kompres final image.
5. Gunakan retention/cleanup.
6. Hindari server image processing pada MVP.
7. Monitor penggunaan free tier sebelum memperbesar beta.

> Free tier memiliki batas penggunaan dan kebijakannya dapat berubah. Free-tier cocok untuk private beta dan traffic kecil, bukan jaminan unlimited untuk produk viral.

---

# 34. MVP Backlog

| ID | Task | Priority | Acceptance |
|---|---|---|---|
| MVP-01 | Bootstrap Next.js + TypeScript + Tailwind | P0 | App deployable |
| MVP-02 | Setup Supabase + schema (4 tabel) + `server_time_ms` + RLS (§17/§18.2) | P0 | SQL §17 jalan |
| MVP-02b | Edge Function `room-api` (FR-05) + `cleanup` (pg_cron §17) | P0 | Kontrak FR-05 + signed URL jalan |
| MVP-03 | Create room (via room-api) | P0 | Unique room works |
| MVP-04 | Join room (via room-api, tolak ke-3) | P0 | Second participant works |
| MVP-05 | Presence + Broadcast (tanpa postgres_changes) | P0 | Both see online state |
| MVP-06 | Camera hook (FR-03: mirror preview, cover crop) | P0 | Preview + permission |
| MVP-07 | Ready state (ephemeral, bukan status DB) | P0 | Both ready |
| MVP-08 | Capture scheduler (targetTimes tunggal + clock offset) | P0 | Synchronized 4 shots |
| MVP-08b | Photo exchange (upload per-shot + ACK storagePath + download pasangan) | P0 | 8 foto terkumpul di kedua client |
| MVP-09 | Canvas composer (1080×1920, 8 slots, di kedua client) | P0 | Final image generated |
| MVP-10 | Result/download (JPEG q0.9; share opsional) | P0 | JPEG downloads |
| MVP-11 | Reconnect/session-baru (tanpa retake per-shot) | P1 | Common failures recover |
| MVP-12 | 2 template JSON frontend (§13/§29) | P1 | Switchable layout |
| MVP-13 | Analytics insert-only (§16.6/§30) | P1 | Events recorded |
| MVP-14 | Privacy/cleanup (§14/§19) | P1 | Expired data cleaned |

---

# 35. Acceptance Criteria

### Room

- [ ] User A dapat membuat room.
- [ ] Room memiliki code unik.
- [ ] User A mendapatkan share link.
- [ ] User B dapat join menggunakan link.
- [ ] Participant ketiga ditolak.

### Camera

- [ ] Kamera dapat diminta melalui HTTPS.
- [ ] Preview muncul.
- [ ] Permission denied ditangani.
- [ ] Camera stream dihentikan setelah selesai.

### Realtime

- [ ] Participant dapat melihat status online.
- [ ] Ready state tersinkron.
- [ ] Start event tersinkron.
- [ ] Capture schedule diterima.
- [ ] Reconnect dapat dilakukan.

### Capture

- [ ] Countdown muncul di kedua perangkat (dari `targetTimes`, tanpa event per-shot).
- [ ] Foto pertama berhasil diambil.
- [ ] Foto kedua berhasil diambil.
- [ ] Foto ketiga berhasil diambil.
- [ ] Foto keempat berhasil diambil.
- [ ] Tiap shot ter-upload ke `photobooth-temp` dan `capture_ack.storagePath` diterima pasangan.
- [ ] Slot pasangan yang gagal load tampil placeholder + `Retry load`.
- [ ] Retake per-shot TIDAK ada; session baru sebagai pengganti.

### Result

- [ ] Foto A dan B masuk ke layout.
- [ ] Template dapat dipilih.
- [ ] Nama dapat ditampilkan.
- [ ] Tanggal dapat ditampilkan.
- [ ] Final image dapat di-download.
- [ ] Share bekerja jika Web Share API tersedia.

### Security

- [ ] Service role key tidak ada di client bundle.
- [ ] RLS aktif.
- [ ] Room mutation tidak dapat dilakukan participant asing.
- [ ] Input tervalidasi.
- [ ] Room expired tidak dapat digunakan.

---

# 36. Testing Plan

| Area | Test |
|---|---|
| Unit | Room code, timing calculation, template config |
| Integration | Create/join, RLS, realtime flow |
| E2E | Dua browser/device |
| Camera | Permission granted/denied |
| Camera | Front camera |
| Camera | Camera reconnect |
| Realtime | Latency |
| Realtime | Duplicate events |
| Realtime | Reconnect |
| Canvas | Aspect ratio |
| Canvas | Crop |
| Canvas | Orientation |
| Mobile | iOS Safari |
| Mobile | Android Chrome |
| Network | Slow 4G |
| Network | Wi-Fi ↔ cellular |
| Security | Unauthorized mutation |
| Security | Malformed payload |
| Security | Rate limiting |

---

# 37. Minimum Beta Test Matrix

Sebelum mengundang 6–10 tester:

- [ ] Android + Chrome
- [ ] iPhone + Safari
- [ ] Desktop + webcam
- [ ] Android ↔ Android
- [ ] Android ↔ iPhone
- [ ] iPhone ↔ desktop
- [ ] Wi-Fi ↔ Wi-Fi
- [ ] Wi-Fi ↔ cellular
- [ ] Camera denied → retry
- [ ] Refresh browser
- [ ] Participant disconnect
- [ ] Participant reconnect
- [ ] Background tab
- [ ] Room expiration

---

# 38. Architecture Decisions & Trade-offs

| Decision | Reason |
|---|---|
| Next.js | Cocok untuk UI kamera-heavy dan deployment serverless |
| TypeScript | Mengurangi error pada realtime event dan state |
| Supabase | Managed DB + Realtime tanpa custom backend |
| Vercel | Deployment Next.js dan HTTPS mudah |
| Canvas API | Image composition tanpa server processing |
| No WebRTC MVP | Mengurangi kompleksitas |
| No login MVP | Mengurangi friction |
| No raw video upload | Privacy + bandwidth + cost |
| Final image upload hanya saat user minta link (bucket `photobooth-final` privat, TTL 7 hari) | Privasi default + cost |
| No VPS | Menjaga biaya beta seminimal mungkin |

---

# 39. Why WebRTC Is Not in MVP

WebRTC baru dibutuhkan jika produk ingin memberikan:

> "Saya bisa melihat pasangan saya secara live di layar."

Architecture:

```text
User A Camera
      │
      ▼
    WebRTC
      ▲
      │
User B Camera
```

Namun WebRTC menambah kebutuhan:

- Signaling.
- ICE candidate.
- STUN.
- TURN untuk sebagian jaringan.
- Reconnect.
- Browser compatibility.
- Mobile behavior.
- Privacy considerations.

MVP cukup menggunakan:

```text
Supabase Realtime
      +
Local Camera
      +
Canvas
```

WebRTC masuk fase berikutnya setelah core experience tervalidasi.

---

# 40. Post-MVP Roadmap

## Phase 2 — Make It Fun

- 10+ templates.
- Custom background.
- Sticker.
- Text.
- Doodle.
- Date.
- Filter.
- Retake individual shot.
- QR invite.
- Better share experience.

## Phase 3 — Live Experience

- WebRTC partner preview.
- Live camera view.
- Audio cue.
- Animated countdown.
- Reconnect improvements.

## Phase 4 — Product

- Account.
- Personal gallery.
- Session history.
- Shareable result page.
- Premium templates.
- Payment.
- Custom branding.
- Custom frame builder.

## Phase 5 — Scale

- Cloudflare R2/object storage.
- Advanced image pipeline.
- CDN.
- Abuse protection.
- Moderation.
- Observability.
- Usage-based infrastructure planning.

---

# 41. Open Questions Before Public Launch

1. Apakah final image disimpan permanen atau auto-delete?
2. Berapa lama room aktif?
3. Apakah room code dapat digunakan kembali?
4. Apakah user dapat menghapus hasil secara manual?
5. Apakah result link public atau signed URL?
6. Apakah free version memakai watermark?
7. Berapa banyak template gratis?
8. Apakah premium template akan dijual?
9. Apakah WebRTC live preview meningkatkan retention?
10. Apakah user perlu account untuk menyimpan history?
11. Bagaimana menangani abuse jika link dibagikan publik?
12. Apakah hasil foto perlu moderation ketika produk dibuka publik?

---

# 42. Definition of Done — MVP

MVP dianggap selesai jika:

- [ ] Semua P0 backlog selesai.
- [ ] Acceptance criteria utama lulus.
- [ ] Diuji pada minimal dua perangkat berbeda.
- [ ] Tidak ada credential sensitif di client bundle.
- [ ] Room lifecycle berjalan.
- [ ] Cleanup berjalan.
- [ ] Download bekerja di Android Chrome.
- [ ] Download bekerja di iOS Safari.
- [ ] Disconnect/reconnect dasar tertangani.
- [ ] Dua participant dapat menyelesaikan 4-shot session.
- [ ] Final photobooth image berhasil dibuat.
- [ ] 2 template tersedia.
- [ ] 6–10 beta tester dapat menggunakan aplikasi tanpa bantuan developer untuk alur normal.
- [ ] Feedback dikumpulkan setelah sesi.

---

# 43. Recommended Implementation Order

1. Bootstrap repository (Next.js + TypeScript + Tailwind).
2. Setup Supabase: 4 tabel + `server_time_ms` + RLS §17/§18.2 + bucket private §14.
3. Edge Function `room-api` (kontrak FR-05) + `cleanup` + pg_cron §17.
4. Landing + create/join via `room-api` + session_id lifecycle (FR-02).
5. Presence + Broadcast channel `room:<id>` (tanpa postgres_changes, FR-04).
6. Camera hook + permission UX (FR-03: mirror preview, cover crop).
7. Ready state ephemeral + clock offset (§9).
8. Capture scheduler (`targetTimes` dari `POST /start`, §11) + four-shot flow + upload background (§10).
9. Photo exchange (signed-url upload/download + ACK storagePath, §14).
10. Canvas composer di kedua client (1080×1920, 8 slots, §13) + result + download/share (§15).
11. Reconnect (`GET /get`) + session-baru pengganti retake + room expiration + cleanup (§19–§21).
12. Analytics insert-only (§16.6/§30).
13. Deploy Vercel → two-device matrix (§37) → beta 6–10 → feedback → fix kritis → baru Phase 2.

---

# 44. Product North Star

Produk ini jangan diposisikan sekadar sebagai:

> "Online photobooth."

Photobooth adalah mekanismenya.

Nilai produk sebenarnya adalah:

> **"Membuat foto bersama meskipun sedang berjauhan."**

Core product loop:

```text
Create Room
     ↓
Invite Someone You Love
     ↓
Both Join
     ↓
Camera Ready
     ↓
3... 2... 1...
     ↓
📸
     ↓
Repeat
     ↓
Beautiful Shared Memory
     ↓
Download / Share
```

### North Star Experience

Target pengalaman:

> **Dalam waktu kurang dari 2 menit, dua orang yang berada di tempat berbeda dapat menghasilkan foto yang terasa seperti mereka benar-benar sedang berada di satu photobooth.**

---

# 45. Final Recommendation

Untuk private beta 6–10 orang:

```text
┌─────────────────────────────┐
│          Next.js            │
│       React + TypeScript    │
│         Tailwind CSS        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│          Supabase           │
│                             │
│ PostgreSQL                  │
│ Realtime                    │
│ Storage                     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│           Vercel            │
│       HTTPS + Deploy        │
└─────────────────────────────┘
```

Tidak perlu Laravel, Filament, VPS, Redis, atau custom WebSocket server pada MVP.

Fokus development harus berada pada tiga hal:

1. **Camera experience**
2. **Synchronization**
3. **Final photo quality**

Jika ketiga hal tersebut terasa bagus, produk sudah memiliki core experience yang layak diuji ke pengguna nyata.
