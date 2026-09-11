// Semua loader di bawah aman dipanggil saat render: di server kembalikan
// null (tanpa menyentuh storage), di client baca storage langsung.
// Halaman menampilkan loading yang SAMA di server dan client, lalu isi
// state asli di effect setelah mount — tanpa hydration mismatch.
export interface RoomBundle {
  roomId: string;
  participantId: string;
  displayName: string;
  role: "host" | "guest";
}

export interface CaptureBundle {
  sessionDbId: string;
}

export interface ShotsBundle {
  code: string;
  sessionDbId: string;
  date: string;
  myRole: "host" | "guest";
  myName: string;
  partnerName: string;
  myShots: (string | null)[];
  partnerShots: (string | null)[];
  partnerId: string | null;
  partnerPaths: (string | null)[];
  roomId: string | null;
}

const store = () => (typeof window === "undefined" ? null : window.localStorage);

const get = (key: string) => {
  try {
    const raw = store()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const set = (key: string, value: unknown) => {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage penuh — alur tetap jalan tanpa persist */
  }
};

export const bundleKey = (code: string) => `ldr_room_${code}`;
export const captureKey = (code: string) => `ldr_capture_${code}`;
export const shotsKey = (code: string) => `ldr_shots_${code}`;

export const loadRoomBundle = (code: string): RoomBundle | null => get(bundleKey(code));
export const saveRoomBundle = (code: string, b: RoomBundle) => set(bundleKey(code), b);
export const clearRoomBundle = (code: string) => {
  try {
    store()?.removeItem(bundleKey(code));
  } catch {
    /* abaikan */
  }
};
export const loadCaptureBundle = (code: string): CaptureBundle | null => get(captureKey(code));
export const saveCaptureBundle = (code: string, b: CaptureBundle) => set(captureKey(code), b);
export const clearCaptureBundle = (code: string) => {
  try {
    store()?.removeItem(captureKey(code));
  } catch {
    /* abaikan */
  }
};
export const loadShotsBundle = (code: string): ShotsBundle | null => get(shotsKey(code));
export const saveShotsBundle = (code: string, b: ShotsBundle) => set(shotsKey(code), b);
