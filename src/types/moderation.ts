export type ReportCategory =
  | "offensive"
  | "spam"
  | "nudity"
  | "violence"
  | "harassment"
  | "other";
export type ReportStatus =
  | "pending"
  | "under_review"
  | "resolved_action"
  | "resolved_dismissed";
export type SanctionType = "warning" | "temp_ban" | "perm_ban";
export type ConvSanctionType = "mute" | "kick" | "shadow_restrict";
export type AppealStatus = "pending" | "under_review" | "accepted" | "rejected";
export type UserRole = "user" | "moderator" | "admin";

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  category: ReportCategory;
  description: string | null;
  evidence: Record<string, any>;
  status: ReportStatus;
  resolution: {
    action: string;
    resolved_by: string;
    resolved_at: string;
    notes: string;
  } | null;
  auto_escalated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationSanction {
  id: string;
  conversation_id: string;
  user_id: string;
  type: ConvSanctionType;
  reason: string;
  issued_by: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface UserSanction {
  id: string;
  userId: string;
  type: SanctionType;
  reason: string;
  evidenceRef: Record<string, any>;
  issuedBy: string;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppealType = "sanction" | "blocked_image";

export interface AppealEvidence {
  images?: string[];
  thumbnailBase64?: string;
  blockReason?: string;
  scores?: Record<string, number>;
  conversationId?: string;
  recipientId?: string;
  messageTempId?: string;
  [key: string]: any;
}

export interface Appeal {
  id: string;
  userId: string;
  sanctionId: string | null;
  type: AppealType;
  reason: string;
  evidence: AppealEvidence;
  status: AppealStatus;
  reviewerId: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ReportStats {
  pending: number;
  under_review: number;
  resolved_today: number;
  by_category: Record<string, number>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
  createdAt: string;
}
