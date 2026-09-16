// Realtime event contracts (FR-04, §11). Small payloads only —
// never image bytes. Server never publishes; host client broadcasts
// what room-api computed.
export interface SessionStartedEvent {
  event: "session_started";
  sessionId: string;
  totalShots: 4;
  // Jam server untuk 4 jepretan — kedua HP countdown lokal + jepret
  // bareng tanpa menunggu pesan realtime (PRD §6, sinkron ±150–250ms).
  targetTimes: [number, number, number, number];
  mode?: "auto" | "manual";
  timerOption?: number;
}

// Manual capture: host menekan tombol per foto, broadcast satu target time.
// Kedua HP countdown lokal menuju targetAt yang sama, lalu jepret.
export interface ShotArmedEvent {
  event: "shot_armed";
  sessionId: string;
  sequence: 1 | 2 | 3 | 4;
  targetAt: number;
}

// Host membatalkan countdown shot sebelum targetAt tercapai.
export interface ShotCancelledEvent {
  event: "shot_cancelled";
  sessionId: string;
  sequence: 1 | 2 | 3 | 4;
}

export interface CaptureAckEvent {
  event: "capture_ack";
  sessionId: string;
  sequence: 1 | 2 | 3 | 4;
  participantId: string;
  capturedAt: number;
  storagePath: string;
}

export interface SessionFinishedEvent {
  event: "session_finished";
  sessionId: string;
}

export interface RoomEndedEvent {
  event: "room_ended";
}

// Ambil ulang dari halaman hasil: kedua HP hapus bundle sesi + kembali booth.
export interface RetakeEvent {
  event: "retake";
  from: string;
}

// WebRTC signaling (P2P video+suara). Pesan kecil via Broadcast yang sama.
// `from` = participantId pengirim; penerima bukan pengirim memprosesnya.
export interface CallHelloEvent {
  event: "call_hello";
  from: string;
}

export interface CallOfferEvent {
  event: "call_offer";
  from: string;
  sdp: string;
  offerId?: string;
}

export interface CallAnswerEvent {
  event: "call_answer";
  from: string;
  sdp: string;
  offerId?: string;
}

export interface CallIceEvent {
  event: "call_ice";
  from: string;
  candidate: string;
}

export interface CallByeEvent {
  event: "call_bye";
  from: string;
}

// Rasio foto dikunci ke host — guest ikut via broadcast. Payload kecil,
// bukan image. `from` = participantId pengirim.
export type HostRatio = "3:4" | "1:1" | "9:16";

export interface RatioChangedEvent {
  event: "ratio_changed";
  from: string;
  ratio: HostRatio;
}

export interface RatioRequestEvent {
  event: "ratio_request";
  from: string;
}

export interface ConfigChangedEvent {
  event: "config_changed";
  from: string;
  mode: "auto" | "manual";
  timerOption: number;
}

export interface ConfigRequestEvent {
  event: "config_request";
  from: string;
}

export type RoomBroadcastEvent =
  | SessionStartedEvent
  | ShotArmedEvent
  | ShotCancelledEvent
  | ConfigChangedEvent
  | ConfigRequestEvent
  | CaptureAckEvent
  | SessionFinishedEvent
  | RoomEndedEvent
  | RetakeEvent
  | RatioChangedEvent
  | RatioRequestEvent
  | CallHelloEvent
  | CallOfferEvent
  | CallAnswerEvent
  | CallIceEvent
  | CallByeEvent;

export type AnalyticsEvent =
  | "room_created"
  | "room_joined"
  | "camera_ready"
  | "session_started"
  | "capture_completed"
  | "session_completed"
  | "result_generated"
  | "result_downloaded"
  | "result_shared"
  | "session_failed";
