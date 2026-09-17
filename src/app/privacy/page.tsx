import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Keamanan Foto",
  description:
    "Komitmen privasi Booth Kecil: foto Anda diproses lokal di browser perangkat, tidak disimpan permanen, dan tidak dijual ke pihak ketiga.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-booth-paper text-booth-ink dark:bg-booth-night dark:text-booth-cream transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full border-b border-booth-line/60 bg-booth-paper/80 backdrop-blur-md sticky top-0 z-30 dark:border-booth-nightline/60 dark:bg-booth-night/80">
        <div className="mx-auto flex h-16 max-w-[900px] items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night group-hover:scale-105 transition">
              <span className="font-display font-bold text-sm">BK</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Booth Kecil</span>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-booth-line px-3.5 py-1.5 text-xs font-semibold text-booth-muted hover:text-booth-ink hover:bg-black/[0.04] transition dark:border-booth-nightline dark:text-booth-creamdim dark:hover:text-white"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[900px] px-5 py-8 md:py-14 flex-1">
        <div className="border-b border-booth-line/60 pb-6 mb-8 dark:border-booth-nightline/60">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-3">
            <span>🛡️</span> Privasi Terjaga 100%
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Kebijakan Privasi & Keamanan Foto
          </h1>
          <p className="text-sm md:text-base text-booth-muted dark:text-booth-creamdim mt-2 leading-relaxed">
            Terakhir diperbarui: September 2026. Kami menghargai momen pribadi Anda. Berikut adalah komitmen penuh kami mengenai bagaimana data dan foto Anda diperlakukan.
          </p>
        </div>

        {/* Highlight Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="booth-card rounded-2xl p-5 border border-booth-line/70 dark:border-booth-nightline/70">
            <div className="text-2xl mb-2">💻</div>
            <h3 className="font-bold text-sm mb-1 text-booth-ink dark:text-booth-cream">Diproses di Browser</h3>
            <p className="text-xs text-booth-muted dark:text-booth-creamdim leading-relaxed">
              Penyusunan strip foto (filter, bingkai, rasio) diproses langsung di browser Anda menggunakan HTML5 Canvas.
            </p>
          </div>

          <div className="booth-card rounded-2xl p-5 border border-booth-line/70 dark:border-booth-nightline/70">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="font-bold text-sm mb-1 text-booth-ink dark:text-booth-cream">P2P Langsung (WebRTC)</h3>
            <p className="text-xs text-booth-muted dark:text-booth-creamdim leading-relaxed">
              Aliran video dan suara antara dua perangkat terhubung langsung secara Peer-to-Peer tanpa melalui rekaman server kami.
            </p>
          </div>

          <div className="booth-card rounded-2xl p-5 border border-booth-line/70 dark:border-booth-nightline/70">
            <div className="text-2xl mb-2">🗑️</div>
            <h3 className="font-bold text-sm mb-1 text-booth-ink dark:text-booth-cream">Penyimpanan Sementara</h3>
            <p className="text-xs text-booth-muted dark:text-booth-creamdim leading-relaxed">
              Foto pertukaran hanya disimpan dalam bucket sementara terenkripsi selama sesi berjalan dan tidak disimpan permanen.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-8 text-sm leading-relaxed">
          <section className="space-y-2.5">
            <h2 className="font-display text-xl md:text-2xl font-bold text-booth-ink dark:text-booth-cream">
              1. Izin Kamera dan Mikrofon
            </h2>
            <p className="text-booth-muted dark:text-booth-creamdim">
              Aplikasi ini meminta akses kamera dan mikrofon perangkat Anda hanya untuk fungsi berikut:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-booth-ink dark:text-booth-cream">
              <li>Menampilkan pratinjau wajah saat berpose di bilik foto (*photobooth*).</li>
              <li>Mengambil 4 jepretan foto saat hitung mundur selesai.</li>
              <li>Menghubungkan panggilan video langsung antara Anda dan teman jarak jauh via WebRTC.</li>
            </ul>
            <p className="text-booth-muted dark:text-booth-creamdim text-xs">
              Kami tidak pernah merekam atau mengaktifkan kamera di luar halaman bilik foto yang sedang aktif. Anda dapat mematikan izin kapan saja melalui pengaturan browser.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-display text-xl md:text-2xl font-bold text-booth-ink dark:text-booth-cream">
              2. Bagaimana Foto Anda Disimpan?
            </h2>
            <p className="text-booth-muted dark:text-booth-creamdim">
              Foto Anda adalah hak milik Anda seutuhnya:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-booth-ink dark:text-booth-cream">
              <li>
                <strong>Mode Satu HP (/sama):</strong> Foto sama sekali tidak dikirimkan ke server mana pun. Seluruh foto hanya berada di memori browser perangkat Anda sampai Anda mengunduhnya.
              </li>
              <li>
                <strong>Mode Jarak Jauh (Dua HP):</strong> Untuk menggabungkan foto Anda dengan foto teman Anda, 4 jepretan diunggah ke *temporary storage* dengan URL tertutup bertanda tangan digital (*Signed URL*). Setelah sesi selesai dan diunduh, file tersebut tidak digunakan untuk keperluan lain dan dijadwalkan untuk dihapus secara otomatis.
              </li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-display text-xl md:text-2xl font-bold text-booth-ink dark:text-booth-cream">
              3. Tanpa Akun & Tanpa Pelacakan Iklan
            </h2>
            <p className="text-booth-muted dark:text-booth-creamdim">
              Kami tidak meminta Anda membuat akun, memasukkan alamat email, nomor telepon, atau data pribadi lainnya. Kami juga tidak menjual data atau foto Anda kepada pengiklan, agensi pemasaran, maupun pihak ketiga lainnya.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-display text-xl md:text-2xl font-bold text-booth-ink dark:text-booth-cream">
              4. Kontak & Pertanyaan
            </h2>
            <p className="text-booth-muted dark:text-booth-creamdim">
              Jika Anda memiliki pertanyaan seputar privasi atau ingin melaporkan kendala keamanan, Anda dapat menghubungi pengembang melalui repositori proyek atau tautan kontak resmi kami.
            </p>
          </section>
        </div>

        {/* CTA Banner */}
        <div className="mt-12 rounded-2xl bg-booth-accent/10 border border-booth-accent/30 p-6 sm:p-8 text-center">
          <h3 className="font-display text-2xl font-bold text-booth-ink dark:text-booth-cream">
            Mulai abadikan momen tanpa rasa khawatir
          </h3>
          <p className="text-xs sm:text-sm text-booth-muted dark:text-booth-creamdim mt-1.5 max-w-md mx-auto">
            Bikin room berdua atau foto bareng di satu HP langsung dari browser Anda sekarang.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-booth-accent px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 transition"
            >
              Masuk Bilik Foto
            </Link>
            <Link
              href="/sama"
              className="rounded-xl border border-booth-line bg-booth-card px-5 py-2.5 text-xs font-bold text-booth-ink hover:bg-black/5 transition dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream"
            >
              Coba Mode Satu HP
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-booth-line/60 py-6 text-center text-xs text-booth-muted dark:border-booth-nightline/60 dark:text-booth-creamdim">
        <p>
          Booth Kecil · Privasi Anda adalah prioritas nomor satu kami.
        </p>
      </footer>
    </div>
  );
}
