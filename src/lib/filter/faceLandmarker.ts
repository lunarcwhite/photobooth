import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

// Intercept pesan INFO dari Emscripten / TensorFlow Lite Wasm yang diarahkan ke console.error
// agar Next.js Turbopack tidak memicu modal "Console Error" merah di layar dev.
if (typeof window !== "undefined" && !(window as unknown as { __pb_tf_patched?: boolean }).__pb_tf_patched) {
  (window as unknown as { __pb_tf_patched?: boolean }).__pb_tf_patched = true;
  const originalError = console.error;
  console.error = function (...args: unknown[]) {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes("TensorFlow Lite") ||
        first.includes("XNNPACK") ||
        first.startsWith("INFO:") ||
        first.includes("GL version:"))
    ) {
      console.info(...args);
      return;
    }
    originalError.apply(console, args);
  };
}

let landmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker | null> | null = null;
let lastVideoTime = -1;

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function initFaceLandmarker(
  onProgress?: (status: "loading" | "ready" | "error", message?: string) => void,
): Promise<FaceLandmarker | null> {
  if (landmarkerInstance) {
    onProgress?.("ready");
    return landmarkerInstance;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      onProgress?.("loading", "Memuat modul AI pelacak wajah…");

      // Dynamic import to avoid SSR evaluation issues
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");

      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

      try {
        // Coba akselerasi GPU (WebGL) terlebih dahulu
        landmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn("GPU delegate gagal, beralih ke CPU delegate:", gpuError);
        // Fallback ke CPU jika perangkat tidak mendukung WebGL shader delegate
        landmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      onProgress?.("ready");
      return landmarkerInstance;
    } catch (err) {
      console.error("Gagal menginisialisasi FaceLandmarker:", err);
      initPromise = null;
      onProgress?.("error", "Gagal memuat filter wajah. Coba lagi.");
      return null;
    }
  })();

  return initPromise;
}

export function isFaceLandmarkerReady(): boolean {
  return landmarkerInstance !== null;
}

/**
 * Mendeteksi titik wajah dari frame video secara real-time.
 * Mengembalikan array wajah (tiap wajah berisi 478 NormalizedLandmark).
 */
export function detectFaces(
  video: HTMLVideoElement,
  timestampMs = performance.now(),
): NormalizedLandmark[][] | null {
  if (!landmarkerInstance) return null;
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

  // MediaPipe detectForVideo mensyaratkan timestamp harus selalu bertambah
  // dan frame video harus baru (video.currentTime berubah).
  const currentVideoTime = video.currentTime;
  if (currentVideoTime === lastVideoTime) {
    return null;
  }
  lastVideoTime = currentVideoTime;

  try {
    const results = landmarkerInstance.detectForVideo(video, timestampMs);
    if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
      return results.faceLandmarks;
    }
    return [];
  } catch {
    // Abaikan frame drop saat transisi kamera
    return null;
  }
}
