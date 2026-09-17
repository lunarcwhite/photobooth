import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { PhotoRatio, PhotoStyle } from "@/types/template";

function imageFromURL(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
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
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (dh > h ? (h - dh) * 0.15 : (h - dh) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
}

export interface CreateGifOptions {
  isSolo?: boolean;
  ratio?: PhotoRatio;
  style?: PhotoStyle;
  delay?: number; // ms, default 550ms
  names?: string;
  date?: string;
}

export async function createAnimatedGif(
  slots: (string | null)[],
  opts: CreateGifOptions = {},
): Promise<Blob> {
  const isSolo = Boolean(opts.isSolo);
  const ratio = opts.ratio ?? "3:4";
  const style = opts.style ?? "original";
  const delay = opts.delay ?? 550;
  const footerText = [opts.names, opts.date].filter(Boolean).join(" · ") || "Booth Kecil ✦";

  // Dimensi frame GIF optimal (ringan < 1.5MB, tajam di HP)
  const targetW = 480;
  const mult = ratio === "1:1" ? 1 : ratio === "9:16" ? 16 / 9 : 4 / 3;
  const targetH = Math.round(targetW * mult);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Offscreen canvas untuk apply filter
  const filterCanvas = document.createElement("canvas");
  filterCanvas.width = targetW;
  filterCanvas.height = targetH;
  const fctx = filterCanvas.getContext("2d")!;

  const gif = GIFEncoder();

  // Siapkan foto-foto
  // Solo: slots[0..3]
  // Remote: [A1, B1, A2, B2, A3, B3, A4, B4] -> 4 frame pasangan [A0, B0], [A1, B1], [A2, B2], [A3, B3]
  const framesData: { a: string | null; b: string | null }[] = isSolo
    ? [
        { a: slots[0], b: null },
        { a: slots[1], b: null },
        { a: slots[2], b: null },
        { a: slots[3], b: null },
      ]
    : [
        { a: slots[0], b: slots[1] },
        { a: slots[2], b: slots[3] },
        { a: slots[4], b: slots[5] },
        { a: slots[6], b: slots[7] },
      ];

  const loadedFrames = await Promise.all(
    framesData.map(async (f) => ({
      imgA: await imageFromURL(f.a ?? ""),
      imgB: await imageFromURL(f.b ?? ""),
    })),
  );

  for (let i = 0; i < loadedFrames.length; i++) {
    const { imgA, imgB } = loadedFrames[i];

    // Bersihkan canvas
    ctx.fillStyle = "#161311";
    ctx.fillRect(0, 0, targetW, targetH);

    if (isSolo) {
      // 1 foto per frame
      if (imgA) {
        drawCover(ctx, imgA, 0, 0, targetW, targetH);
      } else {
        ctx.fillStyle = "#262320";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.fillStyle = "#888";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Foto ${i + 1}`, targetW / 2, targetH / 2);
      }
    } else {
      // Remote: 2 foto berdampingan (Host kiri, Guest kanan)
      const halfW = Math.round(targetW / 2);
      if (imgA) {
        drawCover(ctx, imgA, 0, 0, halfW - 1, targetH);
      } else {
        ctx.fillStyle = "#262320";
        ctx.fillRect(0, 0, halfW - 1, targetH);
      }

      if (imgB) {
        drawCover(ctx, imgB, halfW + 1, 0, halfW - 1, targetH);
      } else {
        ctx.fillStyle = "#262320";
        ctx.fillRect(halfW + 1, 0, halfW - 1, targetH);
      }

      // Garis pemisah tengah
      ctx.fillStyle = "#161311";
      ctx.fillRect(halfW - 1, 0, 2, targetH);
    }

    // Terapkan Filter Gaya jika ada
    if (style !== "original") {
      fctx.clearRect(0, 0, targetW, targetH);
      fctx.filter =
        style === "bw"
          ? "grayscale(1)"
          : style === "warm"
            ? "sepia(0.35) saturate(1.25)"
            : "sepia(0.6) contrast(0.92) brightness(0.96)";
      fctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(filterCanvas, 0, 0);
    }

    // Badge nomor pose di pojok kiri atas
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 68, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1} / 4 ✦`, 48, 31);

    // Watermark & caption strip di bawah
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(14, targetH - 38, targetW - 28, 24, 12);
    ctx.fill();
    ctx.fillStyle = "#EAE5D9";
    ctx.font = "500 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(footerText, targetW / 2, targetH - 22);

    // Dapatkan data RGBA frame
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const palette = quantize(imgData.data, 256);
    const indexed = applyPalette(imgData.data, palette);
    gif.writeFrame(indexed, targetW, targetH, { palette, delay });
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes as unknown as BlobPart], { type: "image/gif" });
}
