---
name: contacts
description: "Skill for the Contacts area of mobile-app. 38 symbols across 7 files."
---

# Contacts

38 symbols | 7 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how BlockedUsersScreen, handleSync, handleClose work
- Modifying contacts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/contacts/api.ts` | getAuthHeaders, getOwnerId, toIso, normalizeContact, buildSearchResult (+16) |
| `src/components/Contacts/SyncContactsModal.tsx` | handleSync, handleClose, SyncContactsModal, requestPermissionAndLoad, toggleSelection (+2) |
| `src/components/Contacts/EditContactModal.tsx` | EditContactModal, handleSave, handleDelete, handleClose |
| `src/utils/phoneUtils.ts` | normalizePhoneToE164, hashPhoneNumber, hashPhoneNumbers |
| `src/screens/Contacts/BlockedUsersScreen.tsx` | BlockedUsersScreen |
| `src/components/Contacts/AddContactModal.tsx` | AddContactModal |
| `src/screens/Contacts/ContactsScreen.tsx` | ContactsScreen |

## Entry Points

Start here when exploring this area:

- **`BlockedUsersScreen`** (Function) — `src/screens/Contacts/BlockedUsersScreen.tsx:24`
- **`handleSync`** (Function) — `src/components/Contacts/SyncContactsModal.tsx:199`
- **`handleClose`** (Function) — `src/components/Contacts/SyncContactsModal.tsx:248`
- **`EditContactModal`** (Function) — `src/components/Contacts/EditContactModal.tsx:34`
- **`handleSave`** (Function) — `src/components/Contacts/EditContactModal.tsx:54`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BlockedUsersScreen` | Function | `src/screens/Contacts/BlockedUsersScreen.tsx` | 24 |
| `handleSync` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 199 |
| `handleClose` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 248 |
| `EditContactModal` | Function | `src/components/Contacts/EditContactModal.tsx` | 34 |
| `handleSave` | Function | `src/components/Contacts/EditContactModal.tsx` | 54 |
| `handleDelete` | Function | `src/components/Contacts/EditContactModal.tsx` | 83 |
| `handleClose` | Function | `src/components/Contacts/EditContactModal.tsx` | 122 |
| `AddContactModal` | Function | `src/components/Contacts/AddContactModal.tsx` | 33 |
| `normalizePhoneToE164` | Function | `src/utils/phoneUtils.ts` | 23 |
| `hashPhoneNumber` | Function | `src/utils/phoneUtils.ts` | 57 |
| `hashPhoneNumbers` | Function | `src/utils/phoneUtils.ts` | 79 |
| `SyncContactsModal` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 35 |
| `requestPermissionAndLoad` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 62 |
| `ContactsScreen` | Function | `src/screens/Contacts/ContactsScreen.tsx` | 40 |
| `toggleSelection` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 177 |
| `handleDismiss` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 189 |
| `renderMatch` | Function | `src/components/Contacts/SyncContactsModal.tsx` | 254 |
| `addContact` | Method | `src/services/contacts/api.ts` | 158 |
| `updateContact` | Method | `src/services/contacts/api.ts` | 182 |
| `deleteContact` | Method | `src/services/contacts/api.ts` | 206 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `NewConversationModal → GetSecureStore` | cross_community | 8 |
| `AddContactModal → GetSecureStore` | cross_community | 8 |
| `ContactsScreen → GetSecureStore` | cross_community | 7 |
| `NewConversationModal → DecodeJwtPayload` | cross_community | 6 |
| `BlockedUsersScreen → GetSecureStore` | cross_community | 6 |
| `HandleSync → GetSecureStore` | cross_community | 6 |
| `EditContactModal → GetSecureStore` | cross_community | 6 |
| `HandleSave → GetSecureStore` | cross_community | 6 |
| `HandleDelete → GetSecureStore` | cross_community | 6 |
| `AddContactModal → DecodeJwtPayload` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Chat | 5 calls |
| Services | 4 calls |
| Messaging | 1 calls |

## How to Explore

1. `gitnexus_context({name: "BlockedUsersScreen"})` — see callers and callees
2. `gitnexus_query({query: "contacts"})` — find related execution flows
3. Read key files listed above for implementation details
