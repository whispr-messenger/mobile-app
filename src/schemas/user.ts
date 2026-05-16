import { z } from "zod";

/**
 * Backend User shape (snake_case as returned by user-service).
 *
 * Kept loose: every optional field is `.nullish()` because the various
 * services that join on user data don't all return the same projection.
 */
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  phone_number: z.string().nullish(),
  phone_number_masked: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  avatar_url: z.string().nullish(),
  last_seen: z.string().nullish(),
  is_active: z.boolean().default(true),
});
export type UserDto = z.infer<typeof UserSchema>;

/**
 * Username validation rules — shared between the profile setup form, the
 * contact-add form, and any backend payload validation. Source of truth: the
 * mobile-app spec accepts 3-20 chars, alphanumeric + underscores, with
 * unicode letters allowed (cyrillic etc.) so non-Latin alphabets work.
 */
export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "Le pseudo doit contenir au moins 3 caractères")
  .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
  .regex(/^[\p{L}\p{N}_]+$/u, "Lettres, chiffres et _ uniquement");

/**
 * Phone number — minimal validation since the backend re-checks via Twilio.
 * E.164 forbids spaces and requires a leading `+`.
 */
export const PhoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+\d{6,15}$/, "Numéro de téléphone invalide");

/**
 * OTP code from the auth flow: 6 digits, no leading zeros constraint.
 */
export const OtpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Le code doit contenir 6 chiffres");

/**
 * Profile setup form (the screen new users land on after OTP verification).
 * `firstName` is required, `lastName` is optional, `username` follows the
 * shared rules above.
 */
export const ProfileSetupFormSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis").max(50),
  lastName: z.string().trim().max(50).optional().or(z.literal("")),
  username: UsernameSchema,
});
export type ProfileSetupForm = z.infer<typeof ProfileSetupFormSchema>;
