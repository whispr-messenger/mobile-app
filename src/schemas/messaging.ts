import { z } from "zod";

export const MessageTypeSchema = z.enum(["text", "media", "system"]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageStatusSchema = z.enum([
  "sending",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

/**
 * Message — kept loose on `metadata` because each message_type stuffs its
 * own payload there (media uri, system event, reaction state…). Validating
 * it strictly here would force every backend addition through a schema bump.
 */
export const MessageSchema: z.ZodType<{
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_id?: string | null;
  forwarded_from_id?: string | null;
  message_type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  client_random: number | string;
  sent_at: string;
  edited_at?: string | null;
  is_deleted: boolean;
  delete_for_everyone?: boolean | null;
  status?: MessageStatus | null;
}> = z.object({
  id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  reply_to_id: z.string().nullish(),
  forwarded_from_id: z.string().nullish(),
  message_type: MessageTypeSchema,
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  client_random: z.union([z.number(), z.string()]),
  sent_at: z.string(),
  edited_at: z.string().nullish(),
  is_deleted: z.boolean().default(false),
  delete_for_everyone: z.boolean().nullish(),
  status: MessageStatusSchema.nullish(),
});
export type MessageDto = z.infer<typeof MessageSchema>;

export const ConversationTypeSchema = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  type: ConversationTypeSchema,
  external_group_id: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
  is_active: z.boolean().default(true),
  last_message: MessageSchema.optional(),
  unread_count: z.number().int().nonnegative().nullish(),
  is_pinned: z.boolean().nullish(),
  is_muted: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
  avatar_url: z.string().nullish(),
  display_name: z.string().nullish(),
  username: z.string().nullish(),
  phone_number: z.string().nullish(),
  member_user_ids: z.array(z.string()).nullish(),
});
export type ConversationDto = z.infer<typeof ConversationSchema>;

export const ConversationListResponseSchema = z.object({
  conversations: z.array(ConversationSchema),
  total: z.number().int().nonnegative(),
});
export type ConversationListResponse = z.infer<
  typeof ConversationListResponseSchema
>;

/**
 * Form schema for the new conversation creation — matches the props expected
 * by NewConversationModal. Group name has the same 3-100 char rule the
 * legacy modal enforces inline.
 */
export const NewConversationFormSchema = z
  .object({
    selectedUserIds: z
      .array(z.string())
      .min(1, "Sélectionnez au moins un contact"),
    groupName: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.selectedUserIds.length >= 2) {
      const name = value.groupName?.trim() ?? "";
      if (name.length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["groupName"],
          message: "Le nom du groupe doit contenir au moins 3 caractères",
        });
      } else if (name.length > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["groupName"],
          message: "Le nom du groupe ne peut pas dépasser 100 caractères",
        });
      }
    }
  });
export type NewConversationForm = z.infer<typeof NewConversationFormSchema>;
