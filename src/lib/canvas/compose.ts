import type { TemplateConfig } from "@/types/template";

export function imageFromURL(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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

// Final 1080×1920 JPEG q0.9 (§13). Slot order [A1,B1,A2,B2,A3,B3,A4,B4].
// Runs on BOTH clients from local + downloaded partner photos (§10).
export async function composeFinal(
  tpl: TemplateConfig,
  slots: (string | null)[],
  opts: { names: string; date: string },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = tpl.width;
  canvas.height = tpl.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tpl.background;
  ctx.fillRect(0, 0, tpl.width, tpl.height);

  const dark = tpl.background.toLowerCase() === "#111111" || tpl.background.toLowerCase() === "#000000";
  ctx.fillStyle = dark ? "#ffffff" : "#111111";
  ctx.textAlign = "center";
  ctx.font = `700 54px Georgia, serif`;
  ctx.fillText(tpl.text.title, tpl.width / 2, 100);

  const images = await Promise.all(slots.slice(0, 8).map((s) => imageFromURL(s ?? "")));
  tpl.slots.forEach((s, i) => {
    const img = images[i];
    if (img) drawCover(ctx, img, s.x, s.y, s.width, s.height);
    else placeholder(ctx, s.x, s.y, s.width, s.height);
  });

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

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("Gagal menyusun foto");
  return blob;
}
