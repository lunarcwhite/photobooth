import type { PhotoDecor, PhotoRatio, PhotoStyle, RemoteLayout, SoloLayout, TemplateConfig } from "@/types/template";

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
  cropTopBias = 0.28,
) {
  const off = document.createElement("canvas");
  off.width = Math.round(w);
  off.height = Math.round(h);
  const octx = off.getContext("2d")!;
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (w - dw) / 2;
  // Pertahankan framing wajah di tengah/atas
  const dy = dh > h ? (h - dh) * cropTopBias : (h - dh) / 2;
  octx.drawImage(img, dx, dy, dw, dh);
  if (style !== "original") {
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

function placeholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text = "Foto tidak tersedia",
) {
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#94a3b8";
  const fontSize = Math.max(12, Math.min(Math.round(h * 0.07), Math.round(w * 0.07)));
  ctx.font = `500 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
}

// Final photostrip / photo card JPEG q0.9.
// Ukuran kanvas dinamis (adaptive canvas): kanvas membesar/mengecil mengikuti rasio foto & layout.
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
    remoteLayout?: RemoteLayout;
    ratio?: PhotoRatio;
  },
): Promise<Blob> {
  const style = opts.style ?? "original";
  const decor: PhotoDecor = opts.decor ?? (tpl.id === "retro" ? "tape" : "none");
  const caption = (opts.caption ?? "").trim().slice(0, 60);
  const isSolo = Boolean(opts.isSolo);
  const soloLayout: SoloLayout = opts.soloLayout ?? "single";
  const remoteLayout: RemoteLayout = opts.remoteLayout ?? "seamless";
  const ratio: PhotoRatio = opts.ratio ?? "3:4";

  let canvasW = 1080;
  let canvasH = 1920;

  // Mode Solo Satu HP: Layout Khusus 4 Foto
  if (isSolo) {
    const rawImages = await Promise.all(slots.slice(0, 4).map((s) => imageFromURL(s ?? "")));

    if (soloLayout === "single") {
      // 🎞️ STRIP 1x4 (Strip Vertikal 4 Foto - Format Photostrip Bookmark Sejati)
      let slotW: number;
      let slotH: number;
      let slotY: number[];
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        // Kotak Persegi 1:1: Kartu photostrip ramping dengan 4 kotak murni
        slotW = 500;
        slotH = 500;
        canvasW = 600;
        slotY = [135, 665, 1195, 1725];
        footerNamesY = 2290;
        footerDateY = 2335;
        footerCaptionY = 2380;
        canvasH = 2430;
      } else if (ratio === "9:16") {
        // Vertikal Penuh 9:16: Kartu bookmark elegan untuk foto vertikal HP
        slotW = 380;
        slotH = 675; // 380 / 675 = 9 / 16
        canvasW = 460;
        slotY = [130, 835, 1540, 2245];
        footerNamesY = 2980;
        footerDateY = 3020;
        footerCaptionY = 3060;
        canvasH = 3100;
      } else {
        // 3:4 Potret Klasik: Strip klasik photobooth 3:4 murni
        slotW = 450;
        slotH = 600; // 450 / 600 = 3 / 4
        canvasW = 540;
        slotY = [135, 765, 1395, 2025];
        footerNamesY = 2690;
        footerDateY = 2732;
        footerCaptionY = 2775;
        canvasH = 2820;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      // Header Judul
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      const titleFont =
        tpl.id === "minimal"
          ? `400 ${Math.round(canvasW * 0.055)}px sans-serif`
          : tpl.id === "retro"
            ? `700 ${Math.round(canvasW * 0.058)}px "Courier New", monospace`
            : `700 ${Math.round(canvasW * 0.062)}px Georgia, serif`;
      ctx.font = titleFont;
      ctx.fillText(tpl.text.title, canvasW / 2, 85);

      const slotX = Math.round((canvasW - slotW) / 2);

      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const y = slotY[i];
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(slotX, y, slotW, slotH, 16);
        ctx.clip();
        if (img) drawCover(ctx, img, slotX, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, slotX, y, slotW, slotH);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(slotX, y, slotW, slotH, 16);
        ctx.stroke();
        ctx.restore();
      }

      // Hiasan khusus strip 1x4
      if (decor === "tape") {
        ctx.save();
        ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
        ctx.fillRect(canvasW / 2 - 60, 110, 120, 26);
        ctx.restore();
      } else if (decor === "sparkle") {
        ctx.save();
        ctx.fillStyle = dark ? "#FFD9A0" : "#0f172a";
        ctx.font = "400 32px serif";
        ctx.fillText("✦", canvasW / 2 - slotW / 2 + 10, 85);
        ctx.fillText("✦", canvasW / 2 + slotW / 2 - 10, 85);
        ctx.restore();
      }

      // Footer
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      if (tpl.text.showNames) {
        ctx.font = `600 ${Math.round(canvasW * 0.052)}px Georgia, serif`;
        ctx.fillText(opts.names, canvasW / 2, footerNamesY);
      }
      if (tpl.text.showDate) {
        ctx.font = `400 ${Math.round(canvasW * 0.038)}px Georgia, serif`;
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fillText(opts.date, canvasW / 2, footerDateY);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = `italic 400 ${Math.round(canvasW * 0.038)}px Georgia, serif`;
        ctx.fillText(caption, canvasW / 2, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    } else if (soloLayout === "grid2x2") {
      // 🖼️ LAYOUT GRID 2x2 (Poster Polaroid Kotak Modern)
      canvasW = 1080;
      let slotW: number;
      let slotH: number;
      let x1: number;
      let x2: number;
      let y1: number;
      let y2: number;
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        // Polaroid Feed 1080x1330
        slotW = 470;
        slotH = 470;
        x1 = 55;
        x2 = 555;
        y1 = 145;
        y2 = 645;
        footerNamesY = 1175;
        footerDateY = 1230;
        footerCaptionY = 1280;
        canvasH = 1330;
      } else if (ratio === "9:16") {
        slotW = 430;
        slotH = 764; // 9:16
        x1 = 85;
        x2 = 565;
        y1 = 145;
        y2 = 939;
        footerNamesY = 1765;
        footerDateY = 1820;
        footerCaptionY = 1870;
        canvasH = 1920;
      } else {
        // 3:4
        slotW = 450;
        slotH = 600;
        x1 = 65;
        x2 = 565;
        y1 = 145;
        y2 = 775;
        footerNamesY = 1435;
        footerDateY = 1490;
        footerCaptionY = 1540;
        canvasH = 1590;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      ctx.font = `700 50px Georgia, serif`;
      ctx.fillText(tpl.text.title, canvasW / 2, 95);

      const gridCoords = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x1, y: y2 },
        { x: x2, y: y2 },
      ];

      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const coord = gridCoords[i];
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(coord.x, coord.y, slotW, slotH, 16);
        ctx.clip();
        if (img) drawCover(ctx, img, coord.x, coord.y, slotW, slotH, style, 0.28);
        else placeholder(ctx, coord.x, coord.y, slotW, slotH);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(coord.x, coord.y, slotW, slotH, 16);
        ctx.stroke();
        ctx.restore();
      }

      // Footer
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      if (tpl.text.showNames) {
        ctx.font = "600 44px Georgia, serif";
        ctx.fillText(opts.names, canvasW / 2, footerNamesY);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 30px Georgia, serif";
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fillText(opts.date, canvasW / 2, footerDateY);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = "italic 400 30px Georgia, serif";
        ctx.fillText(caption, canvasW / 2, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    } else {
      // ✂️ LAYOUT STRIP KEMBAR (Twin Strip 2 Lembar untuk Berdua)
      canvasW = 1080;
      let slotW: number;
      let slotH: number;
      let slotY: number[];
      let leftX: number;
      let rightX: number;
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        slotW = 400;
        slotH = 400;
        leftX = 70;
        rightX = 610;
        slotY = [140, 565, 990, 1415];
        footerNamesY = 1875;
        footerDateY = 1920;
        footerCaptionY = 1965;
        canvasH = 2010;
      } else if (ratio === "9:16") {
        slotW = 360;
        slotH = 640;
        leftX = 90;
        rightX = 630;
        slotY = [140, 805, 1470, 2135];
        footerNamesY = 2835;
        footerDateY = 2880;
        footerCaptionY = 2925;
        canvasH = 2970;
      } else {
        // 3:4
        slotW = 390;
        slotH = 520;
        leftX = 75;
        rightX = 615;
        slotY = [140, 685, 1230, 1775];
        footerNamesY = 2355;
        footerDateY = 2400;
        footerCaptionY = 2445;
        canvasH = 2490;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      // Judul masing-masing strip
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      ctx.font = `700 36px Georgia, serif`;
      ctx.fillText(tpl.text.title, 270, 95);
      ctx.fillText(tpl.text.title, 810, 95);

      for (let i = 0; i < 4; i++) {
        const img = rawImages[i];
        const y = slotY[i];

        // Strip Kiri
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(leftX, y, slotW, slotH, 14);
        ctx.clip();
        if (img) drawCover(ctx, img, leftX, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, leftX, y, slotW, slotH);
        ctx.restore();

        // Strip Kanan
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rightX, y, slotW, slotH, 14);
        ctx.clip();
        if (img) drawCover(ctx, img, rightX, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, rightX, y, slotW, slotH);
        ctx.restore();
      }

      // Garis potong putus-putus di tengah
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(540, 50);
      ctx.lineTo(540, canvasH - 50);
      ctx.stroke();

      // Ikon gunting penanda potong
      ctx.fillStyle = tpl.background;
      ctx.fillRect(510, canvasH / 2 - 30, 60, 60);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";
      ctx.font = "400 24px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✂", 540, canvasH / 2);
      ctx.restore();

      // Footer Strip Kiri & Kanan
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      if (tpl.text.showNames) {
        ctx.font = "600 28px Georgia, serif";
        ctx.fillText(opts.names, 270, footerNamesY);
        ctx.fillText(opts.names, 810, footerNamesY);
      }
      if (tpl.text.showDate) {
        ctx.font = "400 22px Georgia, serif";
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fillText(opts.date, 270, footerDateY);
        ctx.fillText(opts.date, 810, footerDateY);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = "italic 400 22px Georgia, serif";
        ctx.fillText(caption, 270, footerCaptionY);
        ctx.fillText(caption, 810, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    }
  } else {
    // Mode Remote 2 HP Berjauhan
    const images = await Promise.all(slots.slice(0, 8).map((s) => imageFromURL(s ?? "")));

    if (remoteLayout === "seamless") {
      // ✨ LAYOUT BILIK BERSATU (Seamless Duo - 4 frame lebar menyatu tanpa sekat pemisah)
      let halfW: number;
      let rowH: number;
      let rowY: number[];
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        // Host 440x440 kotak, Guest 440x440 kotak -> 880x440 per baris
        halfW = 440;
        rowH = 440;
        canvasW = 980;
        rowY = [135, 600, 1065, 1530];
        footerNamesY = 2030;
        footerDateY = 2080;
        footerCaptionY = 2130;
        canvasH = 2180;
      } else if (ratio === "9:16") {
        // Host 360x640, Guest 360x640 -> 720x640 per baris
        halfW = 360;
        rowH = 640;
        canvasW = 840;
        rowY = [135, 800, 1465, 2130];
        footerNamesY = 2835;
        footerDateY = 2885;
        footerCaptionY = 2935;
        canvasH = 2985;
      } else {
        // 3:4
        halfW = 400;
        rowH = 533;
        canvasW = 920;
        rowY = [135, 693, 1251, 1809];
        footerNamesY = 2405;
        footerDateY = 2455;
        footerCaptionY = 2505;
        canvasH = 2555;
      }

      const rowW = halfW * 2;
      const startX = Math.round((canvasW - rowW) / 2);
      const cornerR = 20;

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      ctx.font = `700 48px Georgia, serif`;
      ctx.fillText(tpl.text.title, canvasW / 2, 85);

      for (let r = 0; r < 4; r++) {
        const y = rowY[r];
        const hostImg = images[r * 2];
        const guestImg = images[r * 2 + 1];

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(startX, y, rowW, rowH, cornerR);
        ctx.clip();

        // Host (kiri)
        if (hostImg) drawCover(ctx, hostImg, startX, y, halfW, rowH, style, 0.28);
        else placeholder(ctx, startX, y, halfW, rowH);

        // Guest (kanan)
        if (guestImg) drawCover(ctx, guestImg, startX + halfW, y, halfW, rowH, style, 0.28);
        else placeholder(ctx, startX + halfW, y, halfW, rowH);

        // Garis pemisah tengah halus
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX + halfW, y);
        ctx.lineTo(startX + halfW, y + rowH);
        ctx.stroke();

        ctx.restore();

        // Outer border
        ctx.save();
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(startX, y, rowW, rowH, cornerR);
        ctx.stroke();
        ctx.restore();
      }

      // Footer
      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      if (tpl.text.showNames) {
        ctx.font = `600 ${Math.round(canvasW * 0.046)}px Georgia, serif`;
        ctx.fillText(opts.names, canvasW / 2, footerNamesY);
      }
      if (tpl.text.showDate) {
        ctx.font = `400 ${Math.round(canvasW * 0.034)}px Georgia, serif`;
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fillText(opts.date, canvasW / 2, footerDateY);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = `italic 400 ${Math.round(canvasW * 0.034)}px Georgia, serif`;
        ctx.fillText(caption, canvasW / 2, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    } else if (remoteLayout === "twin") {
      // ✂️ STRIP KEMBAR DUO (Strip Host di Kiri, Strip Guest di Kanan)
      canvasW = 1080;
      let slotW: number;
      let slotH: number;
      let slotY: number[];
      let leftX: number;
      let rightX: number;
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        slotW = 400;
        slotH = 400;
        leftX = 70;
        rightX = 610;
        slotY = [140, 565, 990, 1415];
        footerNamesY = 1875;
        footerDateY = 1920;
        footerCaptionY = 1965;
        canvasH = 2010;
      } else if (ratio === "9:16") {
        slotW = 360;
        slotH = 640;
        leftX = 90;
        rightX = 630;
        slotY = [140, 805, 1470, 2135];
        footerNamesY = 2835;
        footerDateY = 2880;
        footerCaptionY = 2925;
        canvasH = 2970;
      } else {
        // 3:4
        slotW = 390;
        slotH = 520;
        leftX = 75;
        rightX = 615;
        slotY = [140, 685, 1230, 1775];
        footerNamesY = 2355;
        footerDateY = 2400;
        footerCaptionY = 2445;
        canvasH = 2490;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      ctx.font = `700 36px Georgia, serif`;
      ctx.fillText(tpl.text.title, 270, 95);
      ctx.fillText(tpl.text.title, 810, 95);

      for (let i = 0; i < 4; i++) {
        const hostImg = images[i * 2];
        const guestImg = images[i * 2 + 1];
        const y = slotY[i];

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(leftX, y, slotW, slotH, 14);
        ctx.clip();
        if (hostImg) drawCover(ctx, hostImg, leftX, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, leftX, y, slotW, slotH);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rightX, y, slotW, slotH, 14);
        ctx.clip();
        if (guestImg) drawCover(ctx, guestImg, rightX, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, rightX, y, slotW, slotH);
        ctx.restore();
      }

      // Garis potong tengah
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(540, 50);
      ctx.lineTo(540, canvasH - 50);
      ctx.stroke();

      ctx.fillStyle = tpl.background;
      ctx.fillRect(510, canvasH / 2 - 30, 60, 60);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";
      ctx.font = "400 24px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✂", 540, canvasH / 2);
      ctx.restore();

      const nameParts = opts.names.split("&").map((s) => s.trim());
      const hostName = nameParts[0] || opts.names;
      const guestName = nameParts[1] || nameParts[0] || opts.names;

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.font = "600 32px Georgia, serif";
      ctx.fillText(hostName, 270, footerNamesY);
      ctx.fillText(guestName, 810, footerNamesY);

      ctx.font = "400 22px Georgia, serif";
      ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
      ctx.fillText(opts.date, 270, footerDateY);
      ctx.fillText(opts.date, 810, footerDateY);

      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = "italic 400 22px Georgia, serif";
        ctx.fillText(caption, 270, footerCaptionY);
        ctx.fillText(caption, 810, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    } else {
      // 🪟 GRID KLASIK (8 Slot Berdampingan)
      let slotW: number;
      let slotH: number;
      let col1X: number;
      let col2X: number;
      let rowY: number[];
      let footerNamesY: number;
      let footerDateY: number;
      let footerCaptionY: number;

      if (ratio === "1:1") {
        slotW = 400;
        slotH = 400;
        canvasW = 920;
        col1X = 40;
        col2X = 480;
        rowY = [135, 560, 985, 1410];
        footerNamesY = 1875;
        footerDateY = 1925;
        footerCaptionY = 1970;
        canvasH = 2020;
      } else if (ratio === "9:16") {
        slotW = 360;
        slotH = 640;
        canvasW = 840;
        col1X = 45;
        col2X = 435;
        rowY = [135, 800, 1465, 2130];
        footerNamesY = 2835;
        footerDateY = 2885;
        footerCaptionY = 2935;
        canvasH = 2980;
      } else {
        // 3:4
        slotW = 390;
        slotH = 520;
        canvasW = 900;
        col1X = 45;
        col2X = 465;
        rowY = [135, 680, 1225, 1770];
        footerNamesY = 2355;
        footerDateY = 2405;
        footerCaptionY = 2450;
        canvasH = 2500;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tpl.background;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      ctx.textAlign = "center";
      ctx.font = `700 48px Georgia, serif`;
      ctx.fillText(tpl.text.title, canvasW / 2, 85);

      for (let i = 0; i < 8; i++) {
        const img = images[i];
        const rowIdx = Math.floor(i / 2);
        const isCol2 = i % 2 === 1;
        const x = isCol2 ? col2X : col1X;
        const y = rowY[rowIdx];

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, slotW, slotH, 14);
        ctx.clip();
        if (img) drawCover(ctx, img, x, y, slotW, slotH, style, 0.28);
        else placeholder(ctx, x, y, slotW, slotH);
        ctx.restore();
      }

      ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
      if (tpl.text.showNames) {
        ctx.font = `600 ${Math.round(canvasW * 0.046)}px Georgia, serif`;
        ctx.fillText(opts.names, canvasW / 2, footerNamesY);
      }
      if (tpl.text.showDate) {
        ctx.font = `400 ${Math.round(canvasW * 0.034)}px Georgia, serif`;
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fillText(opts.date, canvasW / 2, footerDateY);
      }
      if (caption) {
        ctx.fillStyle = dark ? "#cbd5e1" : "#475569";
        ctx.font = `italic 400 ${Math.round(canvasW * 0.034)}px Georgia, serif`;
        ctx.fillText(caption, canvasW / 2, footerCaptionY);
      }

      renderGlobalDecor(ctx, canvasW, canvasH, decor, dark);
      renderGrain(ctx, canvasW, canvasH, tpl.grain);

      return canvasToBlob(canvas);
    }
  }
}

function renderGlobalDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  decor: PhotoDecor,
  dark: boolean,
) {
  if (decor === "none") return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cornerOffset = Math.max(35, Math.round(w * 0.07));

  if (decor === "ribbon") {
    ctx.font = `${Math.round(w * 0.06)}px sans-serif`;
    ctx.fillText("🎀", cornerOffset, cornerOffset);
    ctx.fillText("🎀", w - cornerOffset, cornerOffset);
    ctx.fillText("🎀", cornerOffset, h - cornerOffset);
    ctx.fillText("🎀", w - cornerOffset, h - cornerOffset);
  } else if (decor === "hearts") {
    ctx.font = `${Math.round(w * 0.055)}px sans-serif`;
    ctx.fillText("💖", cornerOffset, cornerOffset);
    ctx.fillText("💕", w - cornerOffset, cornerOffset);
    ctx.fillText("💗", cornerOffset, h - cornerOffset);
    ctx.fillText("💗", w - cornerOffset, h - cornerOffset);
  } else if (decor === "cats") {
    ctx.font = `${Math.round(w * 0.055)}px sans-serif`;
    ctx.fillText("🐾", cornerOffset, cornerOffset);
    ctx.fillText("🐾", w - cornerOffset, cornerOffset);
    ctx.fillText("🐾", cornerOffset, h - cornerOffset);
    ctx.fillText("🐾", w - cornerOffset, h - cornerOffset);
  } else if (decor === "sparkle") {
    ctx.fillStyle = dark ? "#FFD9A0" : "#0f172a";
    ctx.font = `${Math.round(w * 0.06)}px serif`;
    ctx.fillText("✦", cornerOffset, cornerOffset);
    ctx.fillText("✦", w - cornerOffset, cornerOffset);
    ctx.fillText("✨", cornerOffset, h - cornerOffset);
    ctx.fillText("✨", w - cornerOffset, h - cornerOffset);
  } else if (decor === "tape") {
    ctx.fillStyle = "rgba(233, 220, 196, 0.85)";
    const tapeW = Math.round(w * 0.25);
    const tapeH = Math.round(tapeW * 0.22);
    ctx.fillRect(w / 2 - tapeW / 2, 25, tapeW, tapeH);
  }
  ctx.restore();
}

function renderGrain(ctx: CanvasRenderingContext2D, w: number, h: number, grain?: number) {
  if (!grain) return;
  ctx.save();
  ctx.globalAlpha = grain;
  ctx.fillStyle = "#3a2c1c";
  const dots = Math.round((w * h) / 1000);
  for (let i = 0; i < dots; i++) {
    const gx = Math.random() * w;
    const gy = Math.random() * h;
    ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob(
      (blob) => {
        if (blob) res(blob);
        else rej(new Error("Gagal menyusun foto"));
      },
      "image/jpeg",
      0.9,
    );
  });
}
