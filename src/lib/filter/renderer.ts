import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { LiveFilterId } from "./types";

/**
 * Merender filter aksesoris (kacamata, topi, bando, kumis, dll.)
 * pada konteks Canvas 2D berdasarkan titik wajah MediaPipe.
 */
export function renderLiveFilter(
  ctx: CanvasRenderingContext2D,
  faces: NormalizedLandmark[][],
  filterId: LiveFilterId,
  width: number,
  height: number,
) {
  if (!faces || faces.length === 0 || filterId === "none") return;

  for (const landmarks of faces) {
    if (landmarks.length < 468) continue;

    ctx.save();

    switch (filterId) {
      case "sunglasses":
        drawSunglasses(ctx, landmarks, width, height);
        break;
      case "heart_glasses":
        drawHeartGlasses(ctx, landmarks, width, height);
        break;
      case "party_hat":
        drawPartyHat(ctx, landmarks, width, height);
        break;
      case "cat_ears":
        drawCatEars(ctx, landmarks, width, height);
        break;
      case "ribbon":
        drawRibbon(ctx, landmarks, width, height);
        break;
      case "flower_crown":
        drawFlowerCrown(ctx, landmarks, width, height);
        break;
      case "mustache":
        drawMustache(ctx, landmarks, width, height);
        break;
    }

    ctx.restore();
  }
}

// -------------------------------------------------------------
// Helper Perhitungan Geometri Wajah
// -------------------------------------------------------------
function getEyeGeometry(landmarks: NormalizedLandmark[], w: number, h: number) {
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const noseBridge = landmarks[168];

  const lx = leftEyeOuter.x * w;
  const ly = leftEyeOuter.y * h;
  const rx = rightEyeOuter.x * w;
  const ry = rightEyeOuter.y * h;
  const cx = noseBridge.x * w;
  const cy = noseBridge.y * h;

  const dx = rx - lx;
  const dy = ry - ly;
  const eyeDist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  return { cx, cy, eyeDist, angle, lx, ly, rx, ry };
}

function getHeadGeometry(landmarks: NormalizedLandmark[], w: number, h: number) {
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const fx = forehead.x * w;
  const fy = forehead.y * h;
  const cx = chin.x * w;
  const cy = chin.y * h;

  const faceH = Math.hypot(cx - fx, cy - fy);
  const faceW = Math.hypot(
    (rightCheek.x - leftCheek.x) * w,
    (rightCheek.y - leftCheek.y) * h,
  );

  // Sudut vertikal wajah
  const angle = Math.atan2(cy - fy, cx - fx) - Math.PI / 2;

  return { fx, fy, faceW, faceH, angle };
}

// -------------------------------------------------------------
// 1. 🕶️ Kacamata Hitam Keren (Cool Sunglasses)
// -------------------------------------------------------------
function drawSunglasses(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { cx, cy, eyeDist, angle } = getEyeGeometry(landmarks, w, h);
  const glassW = eyeDist * 2.2;
  const glassH = glassW * 0.44;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Frame utama gelap
  const lensW = glassW * 0.44;
  const lensH = glassH;
  const gap = glassW * 0.12;

  // Jembatan tengah
  ctx.fillStyle = "#181818";
  ctx.fillRect(-gap / 2, -lensH * 0.25, gap, lensH * 0.18);

  // Bingkai kiri & kanan
  const drawLens = (xOffset: number) => {
    ctx.save();
    ctx.translate(xOffset, 0);

    // Frame luar
    ctx.beginPath();
    ctx.roundRect(-lensW / 2, -lensH / 2, lensW, lensH, [12, 12, 24, 24]);
    ctx.fillStyle = "#111111";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#282828";
    ctx.stroke();

    // Lensa kaca gelap
    ctx.beginPath();
    ctx.roundRect(-lensW / 2 + 4, -lensH / 2 + 4, lensW - 8, lensH - 8, [8, 8, 20, 20]);
    const grad = ctx.createLinearGradient(0, -lensH / 2, 0, lensH / 2);
    grad.addColorStop(0, "rgba(40, 40, 45, 0.95)");
    grad.addColorStop(1, "rgba(10, 10, 15, 0.98)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Kilau pantulan diagonal (Glare)
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-lensW * 0.25, -lensH);
    ctx.lineTo(-lensW * 0.05, -lensH);
    ctx.lineTo(-lensW * 0.35, lensH);
    ctx.lineTo(-lensW * 0.55, lensH);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  drawLens(-lensW / 2 - gap / 2);
  drawLens(lensW / 2 + gap / 2);

  ctx.restore();
}

// -------------------------------------------------------------
// 2. 💖 Kacamata Hati Pink (Heart Sunglasses)
// -------------------------------------------------------------
function drawHeartGlasses(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { cx, cy, eyeDist, angle } = getEyeGeometry(landmarks, w, h);
  const size = eyeDist * 1.05;
  const spacing = eyeDist * 0.58;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Jembatan emas
  ctx.beginPath();
  ctx.arc(0, -size * 0.2, spacing * 0.35, Math.PI, 0);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();

  const drawHeart = (xOffset: number) => {
    ctx.save();
    ctx.translate(xOffset, 0);
    const s = size * 0.48;

    ctx.beginPath();
    ctx.moveTo(0, s * 0.4);
    // Lengkungan kiri
    ctx.bezierCurveTo(-s * 1.5, -s * 0.5, -s * 1.2, -s * 1.6, 0, -s * 0.6);
    // Lengkungan kanan
    ctx.bezierCurveTo(s * 1.2, -s * 1.6, s * 1.5, -s * 0.5, 0, s * 0.4);
    ctx.closePath();

    // Fill gradien merah muda ceria
    const grad = ctx.createRadialGradient(0, -s * 0.5, 5, 0, 0, s * 1.5);
    grad.addColorStop(0, "rgba(255, 105, 180, 0.95)");
    grad.addColorStop(1, "rgba(220, 20, 100, 0.98)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Border bingkai emas
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#FFE082";
    ctx.stroke();

    // Titik kilau manis
    ctx.beginPath();
    ctx.arc(-s * 0.6, -s * 0.9, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();

    ctx.restore();
  };

  drawHeart(-spacing);
  drawHeart(spacing);

  ctx.restore();
}

// -------------------------------------------------------------
// 3. 🎩 Topi Pesta Ulang Tahun (Party Cone Hat)
// -------------------------------------------------------------
function drawPartyHat(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { fx, fy, faceW, faceH, angle } = getHeadGeometry(landmarks, w, h);
  const hatW = faceW * 0.75;
  const hatH = faceH * 0.95;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(angle);

  // Kerucut Topi Pesta
  const topX = 0;
  const topY = -hatH;
  const baseLeftX = -hatW / 2;
  const baseRightX = hatW / 2;
  const baseY = 0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(baseRightX, baseY);
  ctx.quadraticCurveTo(0, baseY + hatW * 0.18, baseLeftX, baseY);
  ctx.closePath();
  ctx.clip();

  // Background topi (Kuning Cerah)
  ctx.fillStyle = "#FFD166";
  ctx.fillRect(-hatW, -hatH * 1.2, hatW * 2, hatH * 2);

  // Garis-garis diagonal warna-warni (Stripes)
  const colors = ["#EF476F", "#06D6A0", "#118AB2", "#FF9F1C", "#9B5DE5"];
  ctx.lineWidth = hatW * 0.16;
  for (let i = -4; i <= 6; i++) {
    ctx.strokeStyle = colors[Math.abs(i) % colors.length];
    ctx.beginPath();
    ctx.moveTo(-hatW * 1.5 + i * (hatW * 0.35), baseY);
    ctx.lineTo(hatW * 0.5 + i * (hatW * 0.35), -hatH * 1.2);
    ctx.stroke();
  }
  ctx.restore();

  // Garis tepi kerucut halus
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(baseRightX, baseY);
  ctx.quadraticCurveTo(0, baseY + hatW * 0.18, baseLeftX, baseY);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.stroke();

  // Pom-pom bulat di ujung atas topi
  const pomRadius = hatW * 0.15;
  ctx.beginPath();
  ctx.arc(topX, topY, pomRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#FF006E";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // Hiasan rumbai/renda di dasar topi
  const bumps = 6;
  const step = hatW / bumps;
  ctx.beginPath();
  for (let i = 0; i < bumps; i++) {
    const bx = baseLeftX + i * step + step / 2;
    const by = baseY + 4;
    ctx.arc(bx, by, step * 0.45, 0, Math.PI);
  }
  ctx.fillStyle = "#06D6A0";
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// 4. 🐱 Telinga Kucing Lucu + Kumis (Cat Ears & Whiskers)
// -------------------------------------------------------------
function drawCatEars(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { fx, fy, faceW, angle } = getHeadGeometry(landmarks, w, h);
  const earSize = faceW * 0.44;
  const earOffset = faceW * 0.38;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(angle);

  // Gambar Telinga Kucing Kiri & Kanan
  const drawEar = (side: 1 | -1) => {
    ctx.save();
    ctx.translate(side * earOffset, -earSize * 0.25);
    ctx.rotate((side * Math.PI) / 12);

    // Telinga Luar
    ctx.beginPath();
    ctx.moveTo(-earSize * 0.45, earSize * 0.2);
    ctx.quadraticCurveTo(-earSize * 0.25, -earSize * 0.9, 0, -earSize * 1.1);
    ctx.quadraticCurveTo(earSize * 0.25, -earSize * 0.9, earSize * 0.45, earSize * 0.2);
    ctx.closePath();
    ctx.fillStyle = "#2B2B2B";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();

    // Telinga Dalam (Pink Lembut)
    ctx.beginPath();
    ctx.moveTo(-earSize * 0.25, earSize * 0.1);
    ctx.quadraticCurveTo(-earSize * 0.15, -earSize * 0.6, 0, -earSize * 0.8);
    ctx.quadraticCurveTo(earSize * 0.15, -earSize * 0.6, earSize * 0.25, earSize * 0.1);
    ctx.closePath();
    ctx.fillStyle = "#FFB3C6";
    ctx.fill();

    ctx.restore();
  };

  drawEar(-1);
  drawEar(1);
  ctx.restore();

  // Hidung Pink Kecil
  const nose = landmarks[1];
  const nx = nose.x * w;
  const ny = nose.y * h;
  const noseR = faceW * 0.055;

  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, noseR);
  ctx.lineTo(-noseR * 1.2, -noseR * 0.6);
  ctx.lineTo(noseR * 1.2, -noseR * 0.6);
  ctx.closePath();
  ctx.fillStyle = "#FF5C8A";
  ctx.fill();
  ctx.restore();

  // Kumis Kucing di Pipi (Kiri & Kanan)
  const drawWhiskers = (side: 1 | -1) => {
    const cheekX = nx + side * faceW * 0.22;
    const cheekY = ny + faceW * 0.04;
    const wLen = faceW * 0.35;

    ctx.save();
    ctx.translate(cheekX, cheekY);
    ctx.rotate(angle);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(40, 40, 40, 0.85)";

    // 3 garis kumis
    [-0.15, 0, 0.15].forEach((rot) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * wLen * Math.cos(rot), wLen * Math.sin(rot));
      ctx.stroke();
    });
    ctx.restore();
  };

  drawWhiskers(-1);
  drawWhiskers(1);
}

// -------------------------------------------------------------
// 5. 🎀 Bando Pita Cantik (Cute Ribbon)
// -------------------------------------------------------------
function drawRibbon(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { fx, fy, faceW, angle } = getHeadGeometry(landmarks, w, h);
  const bandR = faceW * 0.52;
  const ribbonSize = faceW * 0.32;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(angle);

  // Bando Melengkung di Kepala
  ctx.beginPath();
  ctx.arc(0, bandR * 0.45, bandR, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#E63946";
  ctx.stroke();

  // Pita Cantik di Sisi Kanan Atas Kepala
  ctx.save();
  ctx.translate(faceW * 0.28, -faceW * 0.25);
  ctx.rotate(Math.PI / 8);

  const s = ribbonSize;
  // Sayap Pita Kiri
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-s * 0.8, -s * 0.5, -s * 0.8, s * 0.5, 0, 0);
  ctx.fillStyle = "#E63946";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFE3E5";
  ctx.stroke();

  // Sayap Pita Kanan
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.8, -s * 0.5, s * 0.8, s * 0.5, 0, 0);
  ctx.fillStyle = "#E63946";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#FFE3E5";
  ctx.stroke();

  // Simpul Tengah Pita
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#C1121F";
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

// -------------------------------------------------------------
// 6. 🌸 Mahkota Bunga (Flower Crown)
// -------------------------------------------------------------
function drawFlowerCrown(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  const { fx, fy, faceW, angle } = getHeadGeometry(landmarks, w, h);
  const crownRadius = faceW * 0.5;

  ctx.save();
  ctx.translate(fx, fy + faceW * 0.05);
  ctx.rotate(angle);

  // Ranting Hijau Melengkung
  ctx.beginPath();
  ctx.arc(0, 0, crownRadius, Math.PI * 1.15, Math.PI * 1.85);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#2D6A4F";
  ctx.stroke();

  // Bunga-bunga melingkar
  const flowerCount = 7;
  const flowerColors = ["#FF758F", "#FFB3C6", "#FFC6FF", "#FFB703", "#FF4D6D"];
  const startAngle = Math.PI * 1.18;
  const endAngle = Math.PI * 1.82;
  const angleStep = (endAngle - startAngle) / (flowerCount - 1);

  for (let i = 0; i < flowerCount; i++) {
    const a = startAngle + i * angleStep;
    const bx = crownRadius * Math.cos(a);
    const by = crownRadius * Math.sin(a);
    const color = flowerColors[i % flowerColors.length];
    const r = faceW * 0.085;

    // Kelopak 5 helai
    ctx.save();
    ctx.translate(bx, by);
    for (let p = 0; p < 5; p++) {
      const pa = (p * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(pa) * (r * 0.6), Math.sin(pa) * (r * 0.6), r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    // Putik Tengah Kuning
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD166";
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// -------------------------------------------------------------
// 7. 🥸 Kumis Klasik (Classic Mustache)
// -------------------------------------------------------------
function drawMustache(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
) {
  // Titik di bawah hidung, di atas bibir (landmark 2 & 0)
  const noseBase = landmarks[2];
  const { eyeDist, angle } = getEyeGeometry(landmarks, w, h);
  const mx = noseBase.x * w;
  const my = noseBase.y * h + eyeDist * 0.12;
  const stacheW = eyeDist * 1.1;
  const stacheH = stacheW * 0.42;

  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Lengkung kiri atas
  ctx.bezierCurveTo(-stacheW * 0.25, -stacheH * 0.55, -stacheW * 0.6, -stacheH * 0.3, -stacheW * 0.5, stacheH * 0.4);
  // Lengkung kiri bawah melingkar ke tengah
  ctx.bezierCurveTo(-stacheW * 0.45, stacheH * 0.1, -stacheW * 0.15, stacheH * 0.25, 0, -stacheH * 0.05);
  // Lengkung kanan bawah
  ctx.bezierCurveTo(stacheW * 0.15, stacheH * 0.25, stacheW * 0.45, stacheH * 0.1, stacheW * 0.5, stacheH * 0.4);
  // Lengkung kanan atas
  ctx.bezierCurveTo(stacheW * 0.6, -stacheH * 0.3, stacheW * 0.25, -stacheH * 0.55, 0, 0);
  ctx.closePath();

  ctx.fillStyle = "#2B1700";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1A0E00";
  ctx.stroke();

  ctx.restore();
}
