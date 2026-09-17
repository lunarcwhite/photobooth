export type LiveFilterId =
  | "none"
  | "sunglasses"
  | "heart_glasses"
  | "party_hat"
  | "cat_ears"
  | "ribbon"
  | "flower_crown"
  | "mustache";

export interface LiveFilterConfig {
  id: LiveFilterId;
  name: string;
  icon: string;
  desc: string;
  category: "glasses" | "headwear" | "face" | "none";
}

export const LIVE_FILTERS: LiveFilterConfig[] = [
  { id: "none", name: "Polos", icon: "🚫", desc: "Tanpa Aksesoris", category: "none" },
  { id: "sunglasses", name: "Kacamata Hitam", icon: "🕶️", desc: "Trendy & Keren", category: "glasses" },
  { id: "heart_glasses", name: "Kacamata Hati", icon: "💖", desc: "Romantis Pink", category: "glasses" },
  { id: "party_hat", name: "Topi Pesta", icon: "🎩", desc: "Ceria Ulang Tahun", category: "headwear" },
  { id: "cat_ears", name: "Telinga Kucing", icon: "🐱", desc: "Lucu + Kumis", category: "headwear" },
  { id: "ribbon", name: "Bando Pita", icon: "🎀", desc: "Pita Manis", category: "headwear" },
  { id: "flower_crown", name: "Mahkota Bunga", icon: "🌸", desc: "Estetik Bunga", category: "headwear" },
  { id: "mustache", name: "Kumis Retro", icon: "🥸", desc: "Kumis Klasik", category: "face" },
];
