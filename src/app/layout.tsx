import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const displayFont = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "LDR Photobooth — Foto Bersama Walau Berjauhan",
  description: "Buat foto photobooth bersama pasangan walau sedang berjauhan. Tanpa daftar, langsung dari browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="playful-bg min-h-full flex flex-col">{children}</body>
    </html>
  );
}
