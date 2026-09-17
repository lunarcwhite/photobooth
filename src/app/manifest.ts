import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Booth Kecil untuk Berdua",
    short_name: "Booth Kecil",
    description: "Photobooth online gratis untuk dua orang tanpa aplikasi dan tanpa daftar.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F4EE",
    theme_color: "#FF5C35",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
