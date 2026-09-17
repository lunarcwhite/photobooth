import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist } from "next/font/google";
import "./globals.css";

const displayFont = Instrument_Serif({
  variable: "--font-display-ui",
  subsets: ["latin"],
  weight: ["400"],
});

const bodyFont = Geist({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://photobooth-five-virid.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4EE" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Booth Kecil untuk Berdua — Photobooth Online Tanpa Aplikasi",
    template: "%s | Booth Kecil",
  },
  description:
    "Photobooth online gratis untuk dua orang: remote dua HP berjauhan atau satu HP bareng. Hitung mundur sinkron, hasil foto estetik siap unduh.",
  keywords: [
    "photobooth online",
    "photobooth berdua",
    "photostrip",
    "booth foto ldr",
    "photobooth web",
    "life four cuts online",
  ],
  authors: [{ name: "Booth Kecil" }],
  openGraph: {
    title: "Booth Kecil untuk Berdua — Photobooth Online Tanpa Aplikasi",
    description:
      "Bikin foto strip estetik bareng teman atau pasangan dari mana saja. Tanpa unduh aplikasi, tanpa daftar akun.",
    url: appUrl,
    siteName: "Booth Kecil",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Booth Kecil untuk Berdua — Photobooth Online Tanpa Aplikasi",
    description:
      "Bikin foto strip estetik bareng teman atau pasangan dari mana saja. Tanpa unduh aplikasi, tanpa daftar akun.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="booth-bg flex min-h-dvh flex-col antialiased selection:bg-booth-accent/20">
        {children}
      </body>
    </html>
  );
}
