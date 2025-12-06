/**
 * Contact Types - Based on backend specifications
 * @see user-service/documentation/2_fonctional_specs/3_contact_management.md
 */

export interface User {
  id: string;
  username: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  last_seen?: string;
  is_active: boolean;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  nickname?: string;
  is_favorite: boolean;
  added_at: string;
  updated_at: string;
  // Enriched fields from join
  contact_user?: User;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  reason?: string;
  blocked_at: string;
  // Enriched fields from join
  blocked_user?: User;
}

export interface AddContactDto {
  contactId: string;
  nickname?: string;
}

export interface UpdateContactDto {
  nickname?: string;
  isFavorite?: boolean;
}

export interface BlockUserDto {
  reason?: string;
}

export interface ContactStats {
  total: number;
  favorites: number;
  recently_added: number;
  recently_active: number;
}

export interface ContactSearchParams {
  search?: string;
  sort?: 'name' | 'added_at' | 'last_seen' | 'favorites';
  page?: number;
  limit?: number;
  favorites?: boolean;
}

export interface UserSearchParams {
  username?: string;
  phoneHash?: string;
}

export interface UserSearchResult {
  user: User;
  is_contact: boolean;
  is_blocked: boolean;
}

export interface PhoneContact {
  name: string;
  phoneNumber: string;
  phoneHash: string;
}

