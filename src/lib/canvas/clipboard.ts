// Helper untuk menyalin gambar (Blob) ke clipboard sistem browser.
// Browser modern (Chrome/Safari/Edge) mewajibkan MIME type 'image/png' untuk ClipboardItem.
export async function copyBlobToClipboard(imageBlob: Blob): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.clipboard?.write) {
    return false;
  }

  try {
    let pngBlob = imageBlob;
    if (imageBlob.type !== "image/png") {
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(imageBlob);
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(imageBlob);
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => {
              URL.revokeObjectURL(objUrl);
              if (b) resolve(b);
              else resolve(imageBlob);
            }, "image/png");
          } catch {
            URL.revokeObjectURL(objUrl);
            resolve(imageBlob);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          reject(new Error("Gagal memuat gambar untuk clipboard"));
        };
        img.src = objUrl;
      });
    }

    const item = new ClipboardItem({ "image/png": pngBlob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn("Gagal menyalin gambar ke clipboard:", err);
    return false;
  }
}
