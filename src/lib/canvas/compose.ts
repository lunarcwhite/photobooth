import type { PhotoDecor, PhotoStyle, SoloLayout, TemplateConfig } from "@/types/template";

export function imageFromURL(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PhotoStyle,
) {
  const off = document.createElement("canvas");
  off.width = Math.round(w);
  off.height = Math.round(h);
  const octx = off.getContext("2d")!;
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  octx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  if (style !== "original") {
    // Gaya via filter canvas: satu pass cover → pass filter ke kanvas kedua.
    const styled = document.createElement("canvas");
    styled.width = off.width;
    styled.height = off.height;
    const sctx = styled.getContext("2d")!;
    sctx.filter =
      style === "bw"
        ? "grayscale(1)"
        : style === "warm"
          ? "sepia(0.35) saturate(1.25)"
          : "sepia(0.6) contrast(0.92) brightness(0.96)";
    sctx.drawImage(off, 0, 0);
    octx.clearRect(0, 0, off.width, off.height);
    octx.drawImage(styled, 0, 0);
  }
  ctx.drawImage(off, x, y, w, h);
}

function placeholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#232323";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#8a8a8a";
  ctx.font = `${Math.round(h * 0.12)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Foto tidak tersedia", x + w / 2, y + h / 2);
}

// Final 1080×1920 JPEG q0.9 (§13).
// Mendukung mode Remote (8 slot) dan mode Solo Satu HP (single 1x4, twin cut, grid2x2).
export async function composeFinal(
  tpl: TemplateConfig,
  slots: (string | null)[],
  opts: {
    names: string;
    date: string;
    style?: PhotoStyle;
    decor?: PhotoDecor;
    caption?: string;
    isSolo?: boolean;
    soloLayout?: SoloLayout;
  },
): Promise<Blob> {
  const style = opts.style ?? "original";
  const decor: PhotoDecor = opts.decor ?? (tpl.id === "retro" ? "tape" : "none");
  const caption = (opts.caption ?? "").trim().slice(0, 60);
  const isSolo = Boolean(opts.isSolo);
  const soloLayout: SoloLayout = opts.soloLayout ?? "single";

  const canvas = document.createElement("canvas");
  canvas.width = tpl.width;
  canvas.height = tpl.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tpl.background;
  ctx.fillRect(0, 0, tpl.width, tpl.height);

  const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

  // Mode Solo Satu HP: Layout Khusus 4 Foto
  if (isSolo) {
    const rawImages = await Promise.all(slots.slice(0, 4).map((s) => imageFromURL(s ?? "")));

    if (soloLayout === "twin") {
      // ✂️ LAYOUT STRIP KEMBAR (Twin Strip 2 Lembar untuk Berdua)
      // Strip Kiri (x: 0..540) & Strip Kanan (x: 540..1080)
      const slotY = [160, 535, 910, 1285];
      const slotW = 450;
      const slotH = 350;

      // Judul masing-masing strip
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      ctx.textAlign = "center";
      ctx.font = `700 36px Georgia, serif`;
      ctx.fillText(tpl.text.title, 270, 110);
      ctx.fillText(tpl.text.title, 810, 110);

      // Gambar 4 foto pada Strip Kiri dan Strip Kanan (masing-masing dapat set lengkap)
      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const y = slotY[i];
        // Strip Kiri
        if (img) drawCover(ctx, img, 45, y, slotW, slotH, style);
        else placeholder(ctx, 45, y, slotW, slotH);
        // Strip Kanan
        if (img) drawCover(ctx, img, 585, y, slotW, slotH, style);
        else placeholder(ctx, 585, y, slotW, slotH);
      }

      // Garis potong putus-putus di tengah
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.22)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(540, 70);
      ctx.lineTo(540, 1850);
      ctx.stroke();

      // Ikon gunting penanda potong
      ctx.fillStyle = tpl.background;
      ctx.fillRect(510, 930, 60, 60);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";
      ctx.font = "400 24px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✂", 540, 960);
      ctx.restore();

      // Hiasan
      if (decor === "tape") {
        ctx.save();
        ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
        ctx.fillRect(270 - 70, 125, 140, 32);
        ctx.fillRect(810 - 70, 125, 140, 32);
        ctx.restore();
      } else if (decor === "sparkle") {
        ctx.save();
        ctx.fillStyle = dark ? "#FFD9A0" : "#C93A2E";
        ctx.font = "400 28px serif";
        ctx.fillText("✦", 270 - 180, 110);
        ctx.fillText("✦", 270 + 180, 110);
        ctx.fillText("✦", 810 - 180, 110);
        ctx.fillText("✦", 810 + 180, 110);
        ctx.restore();
      }

      // Footer Strip Kiri
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      if (tpl.text.showNames) {
        ctx.font = "600 30px Georgia, serif";
        ctx.fillText(opts.names, 270, 1715);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 24px Georgia, serif";
        ctx.fillStyle = dark ? "#bbbbbb" : "#555555";
        ctx.fillText(opts.date, 270, 1765);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#e8e2d5" : "#333333";
        ctx.font = "italic 400 24px Georgia, serif";
        ctx.fillText(caption, 270, 1815);
      }

      // Footer Strip Kanan
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      if (tpl.text.showNames) {
        ctx.font = "600 30px Georgia, serif";
        ctx.fillText(opts.names, 810, 1715);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 24px Georgia, serif";
        ctx.fillStyle = dark ? "#bbbbbb" : "#555555";
        ctx.fillText(opts.date, 810, 1765);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#e8e2d5" : "#333333";
        ctx.font = "italic 400 24px Georgia, serif";
        ctx.fillText(caption, 810, 1815);
      }
    } else if (soloLayout === "grid2x2") {
      // 🖼️ LAYOUT GRID 2x2 (Kotak 4 Foto ala Polaroid Poster)
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      ctx.textAlign = "center";
      ctx.font = `700 52px Georgia, serif`;
      ctx.fillText(tpl.text.title, tpl.width / 2, 115);

      const slotW = 465;
      const slotH = 580;
      const gridCoords = [
        { x: 50, y: 180 },
        { x: 565, y: 180 },
        { x: 50, y: 785 },
        { x: 565, y: 785 },
      ];

      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const coord = gridCoords[i];
        if (img) drawCover(ctx, img, coord.x, coord.y, slotW, slotH, style);
        else placeholder(ctx, coord.x, coord.y, slotW, slotH);
      }

      if (decor === "tape") {
        ctx.save();
        ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
        ctx.fillRect(tpl.width / 2 - 90, 135, 180, 40);
        ctx.restore();
      } else if (decor === "sparkle") {
        ctx.save();
        ctx.fillStyle = dark ? "#FFD9A0" : "#C93A2E";
        ctx.font = "400 40px serif";
        ctx.fillText("✦", tpl.width / 2 - 250, 115);
        ctx.fillText("✦", tpl.width / 2 + 250, 115);
        ctx.restore();
      }

      // Footer Polaroid
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      if (tpl.text.showNames) {
        ctx.font = "600 48px Georgia, serif";
        ctx.fillText(opts.names, tpl.width / 2, 1530);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 34px Georgia, serif";
        ctx.fillStyle = dark ? "#bbbbbb" : "#555555";
        ctx.fillText(opts.date, tpl.width / 2, 1600);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#e8e2d5" : "#333333";
        ctx.font = "italic 400 36px Georgia, serif";
        ctx.fillText(caption, tpl.width / 2, 1675);
      }
    } else {
      // 🎞️ LAYOUT STRIP TUNGGAL 1x4 (Strip Vertikal Klasik Asli)
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      ctx.textAlign = "center";
      ctx.font = `700 52px Georgia, serif`;
      ctx.fillText(tpl.text.title, tpl.width / 2, 115);

      const slotW = 720;
      const slotH = 360;
      const slotX = 180;
      const slotY = [170, 555, 940, 1325];

      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const y = slotY[i];
        if (img) drawCover(ctx, img, slotX, y, slotW, slotH, style);
        else placeholder(ctx, slotX, y, slotW, slotH);
      }

      if (decor === "tape") {
        ctx.save();
        ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
        ctx.fillRect(tpl.width / 2 - 90, 135, 180, 40);
        ctx.restore();
      } else if (decor === "sparkle") {
        ctx.save();
        ctx.fillStyle = dark ? "#FFD9A0" : "#C93A2E";
        ctx.font = "400 40px serif";
        ctx.fillText("✦", tpl.width / 2 - 250, 115);
        ctx.fillText("✦", tpl.width / 2 + 250, 115);
        ctx.restore();
      }

      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      if (tpl.text.showNames) {
        ctx.font = "600 44px Georgia, serif";
        ctx.fillText(opts.names, tpl.width / 2, 1755);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 32px Georgia, serif";
        ctx.fillStyle = dark ? "#bbbbbb" : "#555555";
        ctx.fillText(opts.date, tpl.width / 2, 1815);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#e8e2d5" : "#333333";
        ctx.font = "italic 400 32px Georgia, serif";
        ctx.fillText(caption, tpl.width / 2, 1870);
      }
    }
  } else {
    // Mode Remote 2 HP Berjauhan (8 Slot default)
    ctx.fillStyle = dark ? "#ffffff" : "#111111";
    ctx.textAlign = "center";
    ctx.font = `700 54px Georgia, serif`;
    ctx.fillText(tpl.text.title, tpl.width / 2, 100);

    const images = await Promise.all(slots.slice(0, 8).map((s) => imageFromURL(s ?? "")));
    tpl.slots.forEach((s, i) => {
      const img = images[i];
      if (img) drawCover(ctx, img, s.x, s.y, s.width, s.height, style);
      else placeholder(ctx, s.x, s.y, s.width, s.height);
    });

    if (decor === "tape") {
      ctx.save();
      ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
      ctx.fillRect(tpl.width / 2 - 90, 130, 180, 44);
      ctx.restore();
    } else if (decor === "sparkle") {
      ctx.save();
      ctx.fillStyle = dark ? "#FFD9A0" : "#C93A2E";
      ctx.font = "400 40px serif";
      ctx.fillText("✦", tpl.width / 2 - 260, 100);
      ctx.fillText("✦", tpl.width / 2 + 260, 100);
      ctx.restore();
    }

    ctx.fillStyle = dark ? "#ffffff" : "#111111";
    if (tpl.text.showNames) {
      ctx.font = "600 44px Georgia, serif";
      ctx.fillText(opts.names, tpl.width / 2, tpl.height - 110);
    }
    if (tpl.text.showDate) {
      ctx.font = "400 34px Georgia, serif";
      ctx.fillStyle = dark ? "#bbbbbb" : "#555555";
      ctx.fillText(opts.date, tpl.width / 2, tpl.height - 55);
    }
    if (caption) {
      ctx.fillStyle = dark ? "#e8e2d5" : "#333333";
      ctx.font = "italic 400 36px Georgia, serif";
      ctx.fillText(caption, tpl.width / 2, tpl.height - 12);
    }
  }

  // Grain template retro (§18): bintik acak tipis, murah (2000 titik).
  if (tpl.grain) {
    ctx.save();
    ctx.globalAlpha = tpl.grain;
    ctx.fillStyle = "#3a2c1c";
    for (let i = 0; i < 2000; i++) {
      const gx = Math.random() * tpl.width;
      const gy = Math.random() * tpl.height;
      ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("Gagal menyusun foto");
  return blob;
}
