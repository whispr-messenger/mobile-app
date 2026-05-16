import { z } from "zod";
import { UserSchema } from "./user";

export const ContactSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  contact_id: z.string(),
  nickname: z.string().nullish(),
  is_favorite: z.boolean().default(false),
  added_at: z.string(),
  updated_at: z.string(),
  contact_user: UserSchema.optional(),
});
export type ContactDto = z.infer<typeof ContactSchema>;

export const ContactListResponseSchema = z.object({
  contacts: z.array(ContactSchema),
  total: z.number().int().nonnegative(),
});
export type ContactListResponse = z.infer<typeof ContactListResponseSchema>;

export const BlockedUserSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  blocked_user_id: z.string(),
  reason: z.string().nullish(),
  blocked_at: z.string(),
  blocked_user: UserSchema.optional(),
});
export type BlockedUserDto = z.infer<typeof BlockedUserSchema>;

export const BlockedUserListResponseSchema = z.object({
  blocked: z.array(BlockedUserSchema),
  total: z.number().int().nonnegative(),
});
export type BlockedUserListResponse = z.infer<
  typeof BlockedUserListResponseSchema
>;

/**
 * Form schemas — used by the AddContact and EditContact modals via React
 * Hook Form's zodResolver. Keep field names matching the form input names so
 * RHF wiring stays trivial.
 */
export const AddContactFormSchema = z.object({
  contactId: z.string().min(1, "Sélectionnez un utilisateur"),
  nickname: z
    .string()
    .trim()
    .max(50, "Le surnom ne peut pas dépasser 50 caractères")
    .optional()
    .or(z.literal("")),
});
export type AddContactForm = z.infer<typeof AddContactFormSchema>;

export const EditContactFormSchema = z.object({
  nickname: z
    .string()
    .trim()
    .max(50, "Le surnom ne peut pas dépasser 50 caractères"),
  isFavorite: z.boolean(),
});
export type EditContactForm = z.infer<typeof EditContactFormSchema>;
