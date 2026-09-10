// Realtime event contracts (FR-04, §11). Small payloads only —
// never image bytes. Server never publishes; host client broadcasts
// what room-api computed.
export interface SessionStartedEvent {
  event: "session_started";
  sessionId: string;
  totalShots: 4;
  targetTimes: [number, number, number, number];
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

export type RoomBroadcastEvent =
  | SessionStartedEvent
  | CaptureAckEvent
  | SessionFinishedEvent
  | RoomEndedEvent;

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
