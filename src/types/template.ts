export interface TemplateSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  width: 1080;
  height: 1920;
  background: string;
  // Order: [A1, B1, A2, B2, A3, B3, A4, B4] — A = host, B = guest.
  slots: [TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot];
  text: { title: string; showNames: boolean; showDate: boolean };
  // grain: film grain overlay opacity (retro). tape: corner tape decor default.
  grain?: number;
}

export type PhotoRatio = "3:4" | "1:1" | "9:16";

export const PHOTO_RATIO_OPTIONS: { value: PhotoRatio; label: string; desc: string }[] = [
  { value: "3:4", label: "3:4", desc: "Potret Klasik" },
  { value: "1:1", label: "1:1", desc: "Kotak Persegi" },
  { value: "9:16", label: "9:16", desc: "Vertikal Penuh" },
];

export type SoloLayout = "single" | "twin" | "grid2x2";

export const SOLO_LAYOUTS: { value: SoloLayout; label: string; desc: string }[] = [
  { value: "single", label: "🎞️ Strip 1x4", desc: "Strip vertikal 4 foto bertumpuk" },
  { value: "twin", label: "✂️ Strip Kembar", desc: "2 strip lengkap berdampingan dengan garis potong" },
  { value: "grid2x2", label: "🖼️ Grid 2x2", desc: "4 foto dalam bingkai kotak polaroid" },
];

export type RemoteLayout = "seamless" | "split" | "twin";

export const REMOTE_LAYOUTS: { value: RemoteLayout; label: string; desc: string }[] = [
  { value: "seamless", label: "✨ Bilik Bersatu", desc: "4 frame lebar menyatu seolah satu bilik berdua" },
  { value: "split", label: "🪟 Grid Klasik", desc: "8 foto dalam kotak berdampingan" },
  { value: "twin", label: "✂️ Strip Kembar", desc: "2 strip masing-masing 4 foto dengan garis potong" },
];

export interface PoseGuide {
  id: number;
  shot: number;
  title: string;
  desc: string;
  instruction: string;
  emoji: string;
  icon: string;
  tag: string;
  hostTip: string;
  guestTip: string;
}

export const POSE_GUIDES: PoseGuide[] = [
  {
    id: 1,
    shot: 1,
    title: "Setengah Hati",
    desc: "Bentuk lambang hati bersama!",
    instruction: "Kiri bikin tangan hati ke kanan, kanan ke kiri → menyatu di hasil!",
    emoji: "🫶",
    icon: "🫶",
    tag: "Tangan Hati",
    hostTip: "Bikin tangan kanan melengkung ke kanan",
    guestTip: "Bikin tangan kiri melengkung ke kiri",
  },
  {
    id: 2,
    shot: 2,
    title: "Saling Menunjuk",
    desc: "Tunjuk layar ke arah pasanganmu!",
    instruction: "Saling menunjuk dan tersenyum ke arah pasanganmu!",
    emoji: "👉👈",
    icon: "👉👈",
    tag: "Menunjuk",
    hostTip: "Tunjuk ke sisi kanan (ke arah teman)",
    guestTip: "Tunjuk ke sisi kiri (ke arah host)",
  },
  {
    id: 3,
    shot: 3,
    title: "Merapat & Bersandar",
    desc: "Condongkan kepala seolah bersandar di bahu",
    instruction: "Miringkan kepala saling merapat ke garis tengah bilik!",
    emoji: "🥰",
    icon: "🥰",
    tag: "Bersandar",
    hostTip: "Condongkan kepala ke kanan",
    guestTip: "Condongkan kepala ke kiri",
  },
  {
    id: 4,
    shot: 4,
    title: "Gaya Bebas & Peace",
    desc: "Senyum lepas atau pose favorit kalian!",
    instruction: "Pasang senyum terbaik atau ekspresi konyol favorit kalian!",
    emoji: "✌️",
    icon: "✌️",
    tag: "Gaya Bebas",
    hostTip: "Pose terbaikmu!",
    guestTip: "Pose terbaikmu!",
  },
];

// 4 varian DESIGN §18: Classic, Retro, Minimal, Polaroid. Semua 8 slot,
// beda di background/tipografi/grain — tanpa ubah pipeline compose.
export const TEMPLATES: [TemplateConfig, TemplateConfig, TemplateConfig, TemplateConfig] = [
  {
    id: "classic",
    name: "Klasik",
    width: 1080,
    height: 1920,
    background: "#FFFDF8",
    slots: [
      { x: 60, y: 180, width: 470, height: 380 },
      { x: 550, y: 180, width: 470, height: 380 },
      { x: 60, y: 580, width: 470, height: 380 },
      { x: 550, y: 580, width: 470, height: 380 },
      { x: 60, y: 980, width: 470, height: 380 },
      { x: 550, y: 980, width: 470, height: 380 },
      { x: 60, y: 1380, width: 470, height: 380 },
      { x: 550, y: 1380, width: 470, height: 380 },
    ],
    text: { title: "OUR MOMENT", showNames: true, showDate: true },
  },
  {
    id: "retro",
    name: "Retro",
    width: 1080,
    height: 1920,
    background: "#F3E7D3",
    slots: [
      { x: 60, y: 200, width: 470, height: 370 },
      { x: 550, y: 200, width: 470, height: 370 },
      { x: 60, y: 590, width: 470, height: 370 },
      { x: 550, y: 590, width: 470, height: 370 },
      { x: 60, y: 980, width: 470, height: 370 },
      { x: 550, y: 980, width: 470, height: 370 },
      { x: 60, y: 1370, width: 470, height: 370 },
      { x: 550, y: 1370, width: 470, height: 370 },
    ],
    text: { title: "★ OUR MOMENT ★", showNames: true, showDate: true },
    grain: 0.08,
  },
  {
    id: "minimal",
    name: "Minimal",
    width: 1080,
    height: 1920,
    background: "#ffffff",
    slots: [
      { x: 90, y: 220, width: 440, height: 350 },
      { x: 550, y: 220, width: 440, height: 350 },
      { x: 90, y: 590, width: 440, height: 350 },
      { x: 550, y: 590, width: 440, height: 350 },
      { x: 90, y: 960, width: 440, height: 350 },
      { x: 550, y: 960, width: 440, height: 350 },
      { x: 90, y: 1330, width: 440, height: 350 },
      { x: 550, y: 1330, width: 440, height: 350 },
    ],
    text: { title: "you + someone", showNames: true, showDate: false },
  },
  {
    id: "polaroid",
    name: "Polaroid",
    width: 1080,
    height: 1920,
    background: "#111111",
    slots: [
      { x: 40, y: 260, width: 480, height: 360 },
      { x: 560, y: 260, width: 480, height: 360 },
      { x: 40, y: 640, width: 480, height: 360 },
      { x: 560, y: 640, width: 480, height: 360 },
      { x: 40, y: 1020, width: 480, height: 360 },
      { x: 560, y: 1020, width: 480, height: 360 },
      { x: 40, y: 1400, width: 480, height: 360 },
      { x: 560, y: 1400, width: 480, height: 360 },
    ],
    text: { title: "OUR MOMENT", showNames: true, showDate: true },
  },
];

export type PhotoStyle = "original" | "warm" | "bw" | "vintage";
export type PhotoDecor = "none" | "sparkle" | "ribbon" | "hearts" | "cats" | "tape";

export const PHOTO_STYLES: { value: PhotoStyle; label: string }[] = [
  { value: "original", label: "Asli" },
  { value: "warm", label: "Hangat" },
  { value: "bw", label: "B&W" },
  { value: "vintage", label: "Vintage" },
];

export const PHOTO_DECORS: { value: PhotoDecor; label: string }[] = [
  { value: "none", label: "Polos" },
  { value: "sparkle", label: "✨ Sparkle" },
  { value: "ribbon", label: "🎀 Pita" },
  { value: "hearts", label: "💖 Hati" },
  { value: "cats", label: "🐾 Kucing" },
  { value: "tape", label: "Tape" },
];
