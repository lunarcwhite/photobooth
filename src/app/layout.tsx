import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Booth Kecil untuk Berdua — Tanpa Aplikasi, Tanpa Daftar",
  description: "Photobooth browser untuk dua orang: remote dua HP atau satu HP bareng. Hitung mundur sinkron, hasil siap diunduh.",
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
