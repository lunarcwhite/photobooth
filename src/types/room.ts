export type RoomStatus = "waiting" | "capturing" | "completed" | "expired";
// `ready` is ephemeral client state (2 members + cameras ready), never DB.
export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  expiresAt: string;
}

export interface Participant {
  id: string;
  roomId: string;
  sessionId: string;
  displayName: string;
  role: "host" | "guest";
}

export interface CaptureSession {
  id: string;
  roomId: string;
  status: "pending" | "countdown" | "completed";
  totalShots: number;
}
