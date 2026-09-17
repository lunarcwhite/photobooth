<div align="center">

# 📷 Booth Kecil untuk Berdua
**Photobooth Online Realtime Tanpa Aplikasi — Dibuat Khusus untuk Dua Orang**

[![Deploy with Vercel](https://vercel.com/button)](https://photobooth-five-virid.vercel.app/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-emerald?style=flat&logo=supabase)](https://supabase.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Call-orange?style=flat&logo=webrtc)](https://webrtc.org/)

[🌐 **Coba Aplikasi Langsung (Live Demo)**](https://photobooth-five-virid.vercel.app/)

</div>

---

## 🌟 Tentang Proyek

**Booth Kecil** adalah aplikasi web photobooth modern yang memungkinkan dua orang mengabadikan momen berharga bersama—baik saat **berjauhan via dua HP berbeda** (LDR) maupun saat **berkumpul berdua menggunakan satu HP**. 

Aplikasi ini berjalan 100% langsung di peramban (browser) ponsel atau laptop:
- 🚫 **Tanpa Unduh Aplikasi** (Buka tautan web langsung masuk bilik).
- 🚫 **Tanpa Daftar Akun** (Bebas login, tanpa email atau nomor HP).
- 🛡️ **Privasi 100% Terjaga** (Pemrosesan foto dilakukan lokal di memori perangkat via HTML5 Canvas).

---

## ✨ Fitur Utama

### 1. 👥 Dua Mode Pengalaman Foto
- **Mode Berdua Jarak Jauh (`/room/[code]`)**:
  - Panggilan video langsung dua arah berbasis **WebRTC P2P**.
  - Hitung mundur 3-2-1 dan jepretan kamera sinkron serentak di kedua layar ponsel.
  - Pertukaran foto otomatis melalui enkripsi *Signed URL* privat.
- **Mode Satu HP Bareng (`/sama`)**:
  - Ambil 4 pose bersama dalam 1 perangkat tanpa memerlukan koneksi internet dua arah.

### 2. 🎭 Live AR Filter & Emoticon (MediaPipe Vision)
- **Deteksi Wajah Real-time**: Didukung pustaka `@mediapipe/tasks-vision` (FaceLandmarker) yang berjalan langsung di browser perangkat pengguna tanpa server.
- **Pilihan Aksesori & Emoticon Lucu**:
  - 🌸 **Mahkota Bunga** (Flower Crown)
  - 🐱 **Telinga Kucing** (Cat Ears & Whiskers)
  - 🕶️ **Kacamata Hitam Keren** (Cool Shades)
  - 🎉 **Topi Pesta Meriah** (Party Cone Hat)
  - ⭐ **Kacamata Bintang Retro** (Star Sunglasses)
  - 👓 **Kacamata Vintage Bulat** (Classic Round Glasses)
- Aksesori otomatis terpasang dan mengikuti posisi wajah saat berpose di layar kamera sebelum dan saat hitung mundur jepretan berlangsung.

### 3. 📐 Sistem Kanvas Adaptif Otomatis (Anti-Terpotong)
- **Dimensi Kanvas Dinamis**: Ukuran kanvas cetak (`canvas.width` dan `canvas.height`) otomatis membesar/mengecil menyesuaikan pilihan rasio foto agar proporsional tanpa memotong dahi atau dagu wajah:
  - **1:1 Persegi**: Format Instagram square & bookmark photostrip kotak seimbang (misal 600×2430 px pada strip 1x4, 1080×1330 px pada Grid 2x2).
  - **3:4 Potret Klasik**: Format strip photobooth klasik proporsional (540×2820 px pada strip 1x4).
  - **9:16 Vertikal Penuh**: Format cerita Instagram/TikTok ramping (460×3100 px pada strip 1x4).
- **Pilihan Layout**:
  - **Bilik Bersatu (Seamless Duo)**: 4 baris lebar menyatukan foto host dan teman seolah di dalam satu bilik tanpa sekat.
  - **Strip Kembar (Twin Cut)**: 2 strip lengkap berdampingan dengan penanda garis potong putus-putus dan gunting (`✂️`).
  - **Grid 2x2**: 4 foto dalam bingkai kartu polaroid/poster modern.
  - **Strip 1x4**: Strip vertikal klasik 4 foto bertumpuk.
  - **Grid 8 Slot**: 8 foto berdampingan untuk arsip lengkap berdua.

### 4. 🎞️ Fitur Kreatif & Berbagi
- **🎞️ Pembuat Animasi GIF (Boomerang Loop)**: Menggabungkan 4 pose menjadi file `.gif` bergerak yang siap diunggah ke Instagram Story atau TikTok via pustaka `gifenc`.
- **📋 Salin Foto ke Clipboard (Ctrl+V)**: Satu klik untuk langsung menempelkan strip foto ke WhatsApp Web, Telegram, atau Canva tanpa harus mengunduh file fisik.
- **📱 QR Code Sharing**: *Scan to Join* di ruang tunggu dan *Scan to Download* di halaman hasil agar teman di samping host cukup mengarahkan kamera HP untuk bergabung atau mengunduh foto.
- **✨ Stiker & Cap Lucu**: Pilihan dekorasi ekspresif (Pita `🎀`, Hati `💖`, Kucing `🐾`, Sparkles `✦`, Washi Tape).
- **🎨 Tema Putih Bersih & Charcoal Slate Modern**: Antarmuka minimalis elegan dengan aksen charcoal `#0f172a` yang kontras dan nyaman dipandang.
- **🎵 Efek Suara Rana & Beep**: Suara mekanik rana kamera dan hitung mundur menggunakan *Web Audio API* sintetis (0 KB aset eksternal, nol latensi, 100% offline).

### 5. 🛡️ Keamanan & Kestabilan WebRTC
- **Viewfinder Kamera Studio (`bg-slate-950`)**: Monitor kamera dengan kontras tinggi sehingga teks instruksi dan badge kode kamar selalu terbaca jelas.
- **Dual-Relay TURN Metered.ca**: Didukung integrasi TURN server untuk memastikan video call P2P tetap lancar dan tidak putus pada jaringan data seluler (4G/5G).
- **Panduan Izin Kamera Terblokir**: Modal bantuan interaktif untuk pengguna Google Chrome, Safari iOS, dan in-app browser (Instagram/TikTok/WhatsApp).
- **SEO & PWA Ready**: Metadata OpenGraph 1200×630 dinamis, `sitemap.xml`, `robots.txt`, dan Web App Manifest.

---

## 🚀 Memulai Pengembangan Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
- Akun [Supabase](https://supabase.com/) gratis (untuk Realtime signaling & storage).

### Langkah Instalasi

1. **Clone repositori**:
   ```bash
   git clone https://github.com/lunarcwhite/photobooth.git
   cd photobooth
   ```

2. **Pasang dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables**:
   Salin berkas `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Isi variabel yang dibutuhkan:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Opsional: Kredensial TURN Metered.ca
   NEXT_PUBLIC_TURN_API_URL=https://[app-name].metered.live/api/v1/turn/credentials?apiKey=[apiKey]
   NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443
   NEXT_PUBLIC_TURN_USERNAME=your-username
   NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
   ```

4. **Jalankan server pengembangan**:
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## 📦 Deployment ke Vercel

Proyek ini telah dikonfigurasi secara optimal untuk platform **Vercel** dengan fitur *Auto-Deploy on Push*:

1. Masuk ke dashboard [vercel.com](https://vercel.com) dan klik **Add New Project**.
2. Impor repositori **`lunarcwhite/photobooth`**.
3. Masukkan Environment Variables di atas pada menu **Environment Variables**.
4. Klik **Deploy**.
5. Setiap kali Anda melakukan `git push origin main`, Vercel akan otomatis melakukan pembaruan produksi.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, ImageResponse)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Live AR & Face Tracking**: [@mediapipe/tasks-vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) (WebAssembly / GPU delegate)
- **Realtime & Storage**: [Supabase](https://supabase.com/) (Realtime Presence, Broadcast & Storage)
- **P2P Video Call**: WebRTC via `RTCPeerConnection` + [Metered.ca](https://www.metered.ca/) TURN Relay
- **Audio Engine**: Web Audio API Synthesizer
- **GIF Generation**: [gifenc](https://github.com/mattdesl/gifenc)
- **Hosting**: [Vercel](https://vercel.com/)

---

## 📄 Lisensi & Privasi

Dibuat dengan cinta untuk kamu & seseorang terkasih. Seluruh foto diproses secara lokal di browser dan tidak dijual kepada pihak ketiga mana pun. Lihat [Kebijakan Privasi](https://photobooth-five-virid.vercel.app/privacy) untuk rincian lengkap.
