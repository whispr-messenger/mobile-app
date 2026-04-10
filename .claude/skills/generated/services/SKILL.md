---
name: services
description: "Skill for the Services area of mobile-app. 76 symbols across 22 files."
---

# Services

76 symbols | 22 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how ConversationsListScreen, renderContent, handleSave work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/AuthService.ts` | refreshTokens, register, login, logout, validateSession (+4) |
| `src/services/UserService.ts` | updateProfilePicture, updateUsername, changePhoneNumber, validateUsername, validatePhoneNumber (+4) |
| `src/services/SecurityService.ts` | getAuthBaseUrl, apiFetch, setup, verify, generateBackupCodes (+3) |
| `src/services/TokenService.ts` | getAccessToken, saveTokens, saveIdentityPrivateKey, getRefreshToken, getIdentityPrivateKey (+2) |
| `src/services/MediaService.ts` | getMediaBaseUrl, apiFetch, uploadMedia, getMediaMetadata, downloadMedia (+1) |
| `src/services/SchedulingService.ts` | getSchedulingBaseUrl, apiFetch, createScheduledMessage, updateScheduledMessage, getHealth (+1) |
| `src/services/NotificationService.ts` | muteConversation, getNotificationBaseUrl, apiFetch, getSettings, updateSettings |
| `src/services/storage.ts` | setItem, getSecureStore, getItem, deleteItem |
| `src/services/messaging/cache.ts` | saveConversations, getConversations, clearCache |
| `src/screens/Chat/ConversationsListScreen.tsx` | ConversationsListScreen, renderContent |

## Entry Points

Start here when exploring this area:

- **`ConversationsListScreen`** (Function) — `src/screens/Chat/ConversationsListScreen.tsx:40`
- **`renderContent`** (Function) — `src/screens/Chat/ConversationsListScreen.tsx:328`
- **`handleSave`** (Function) — `src/screens/Auth/ProfileSetupScreen.tsx:71`
- **`ThemeProvider`** (Function) — `src/context/ThemeContext.tsx:549`
- **`loadSettings`** (Function) — `src/context/ThemeContext.tsx:557`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `UserService` | Class | `src/services/UserService.ts` | 46 |
| `ConversationsListScreen` | Function | `src/screens/Chat/ConversationsListScreen.tsx` | 40 |
| `renderContent` | Function | `src/screens/Chat/ConversationsListScreen.tsx` | 328 |
| `handleSave` | Function | `src/screens/Auth/ProfileSetupScreen.tsx` | 71 |
| `ThemeProvider` | Function | `src/context/ThemeContext.tsx` | 549 |
| `loadSettings` | Function | `src/context/ThemeContext.tsx` | 557 |
| `AuthProvider` | Function | `src/context/AuthContext.tsx` | 23 |
| `loadSettings` | Function | `src/screens/Settings/SettingsScreen.tsx` | 219 |
| `shake` | Function | `src/screens/Auth/PhoneInputScreen.tsx` | 93 |
| `handleContinue` | Function | `src/screens/Auth/PhoneInputScreen.tsx` | 113 |
| `handleResend` | Function | `src/screens/Auth/OtpScreen.tsx` | 212 |
| `loadProfile` | Function | `src/screens/Profile/ProfileScreen.tsx` | 113 |
| `getAccessToken` | Method | `src/services/TokenService.ts` | 30 |
| `muteConversation` | Method | `src/services/NotificationService.ts` | 95 |
| `uploadMedia` | Method | `src/services/MediaService.ts` | 78 |
| `getMediaMetadata` | Method | `src/services/MediaService.ts` | 132 |
| `downloadMedia` | Method | `src/services/MediaService.ts` | 140 |
| `downloadThumbnail` | Method | `src/services/MediaService.ts` | 166 |
| `refreshTokens` | Method | `src/services/AuthService.ts` | 116 |
| `setItem` | Method | `src/services/storage.ts` | 21 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `NewConversationModal → GetSecureStore` | cross_community | 8 |
| `AddContactModal → GetSecureStore` | cross_community | 8 |
| `ChatScreen → GetSecureStore` | cross_community | 7 |
| `SettingsScreen → GetSecureStore` | cross_community | 7 |
| `ContactsScreen → GetSecureStore` | cross_community | 7 |
| `ScheduledMessagesScreen → GetSecureStore` | cross_community | 7 |
| `ConversationsListScreen → GetSecureStore` | cross_community | 7 |
| `HandleCreate → GetSecureStore` | cross_community | 7 |
| `GroupDetailsScreen → GetSecureStore` | cross_community | 6 |
| `GroupManagementScreen → GetSecureStore` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Messaging | 3 calls |
| Security | 3 calls |
| Chat | 1 calls |
| Contacts | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ConversationsListScreen"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
