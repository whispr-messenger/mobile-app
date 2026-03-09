/**
 * Phone Number Utilities
 * Normalization and hashing according to technical specifications
 * @see user-service/documentation/2_fonctional_specs/4_user_search.md
 */

import * as Crypto from 'expo-crypto';

/**
 * Static salt for phone number hashing
 * In production, this should be stored securely and be consistent across app versions
 */
const PHONE_HASH_SALT = 'whispr-phone-hash-salt-v1';

/**
 * Normalize phone number to E.164 format
 * E.164 format: +[country code][number]
 * Example: +33612345678
 * 
 * @param phoneNumber - Raw phone number from contacts
 * @param defaultCountryCode - Default country code if not present (default: +33 for France)
 * @returns Normalized phone number in E.164 format
 */
export function normalizePhoneToE164(
  phoneNumber: string,
  defaultCountryCode: string = '+33'
): string {
  // Remove all non-numeric characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If starts with +, it's already international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    return `${defaultCountryCode}${cleaned}`;
  }
  
  // If starts with country code without +, add +
  if (cleaned.startsWith('33') && cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  
  // Otherwise, assume it's a local number and add default country code
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Hash phone number using SHA-256 with salt
 * Format: SHA-256(phoneNumber + staticSalt)
 * 
 * @param phoneNumber - Normalized phone number in E.164 format
 * @returns SHA-256 hash as hexadecimal string
 */
export async function hashPhoneNumber(phoneNumber: string): Promise<string> {
  const normalized = normalizePhoneToE164(phoneNumber);
  const dataToHash = `${normalized}${PHONE_HASH_SALT}`;
  
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataToHash
    );
    return hash;
  } catch (error) {
    console.error('[phoneUtils] Error hashing phone number:', error);
    throw new Error('Failed to hash phone number');
  }
}

/**
 * Batch hash phone numbers
 * 
 * @param phoneNumbers - Array of phone numbers to hash
 * @returns Array of hashed phone numbers
 */
export async function hashPhoneNumbers(phoneNumbers: string[]): Promise<string[]> {
  const hashPromises = phoneNumbers.map(phone => hashPhoneNumber(phone));
  return Promise.all(hashPromises);
}

