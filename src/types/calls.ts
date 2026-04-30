/**
 * Calls Types - Based on calls-service backend specifications
 */

export type CallType = "audio" | "video";

export type CallStatus =
  | "ringing"
  | "connected"
  | "ended"
  | "missed"
  | "declined"
  | "failed";

export interface Call {
  id: string;
  initiator_id: string;
  conversation_id: string;
  type: CallType;
  status: CallStatus;
  started_at: string;
  connected_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface InitiateCallResponse {
  call_id: string;
  status: CallStatus;
  livekit_token: string;
  livekit_url: string;
}

export interface AcceptCallResponse {
  livekit_token: string;
  livekit_url: string;
}

export type CallParticipantStatus =
  | "invited"
  | "joined"
  | "left"
  | "declined"
  | "missed";

export interface CallParticipant {
  call_id: string;
  user_id: string;
  invited_at: string;
  joined_at?: string;
  left_at?: string;
  status: CallParticipantStatus;
}
