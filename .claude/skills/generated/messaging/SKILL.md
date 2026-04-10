---
name: messaging
description: "Skill for the Messaging area of mobile-app. 53 symbols across 7 files."
---

# Messaging

53 symbols | 7 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how ChatScreen, handleCreate, handleClose work
- Modifying messaging-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/messaging/api.ts` | unwrap, authenticatedFetch, getConversations, getConversation, deleteConversation (+18) |
| `src/services/messaging/websocket.ts` | parseMessage, setConnectionState, connect, stopHeartbeat, scheduleReconnect (+17) |
| `src/components/Chat/NewConversationModal.tsx` | handleCreate, handleClose |
| `src/services/TokenService.ts` | decodeJwtPayload, isTokenExpired |
| `src/hooks/useWebSocket.ts` | useWebSocket, cleanup |
| `src/store/conversationsStore.ts` | enrichWithDisplayNames |
| `src/screens/Chat/ChatScreen.tsx` | ChatScreen |

## Entry Points

Start here when exploring this area:

- **`ChatScreen`** (Function) — `src/screens/Chat/ChatScreen.tsx:72`
- **`handleCreate`** (Function) — `src/components/Chat/NewConversationModal.tsx:334`
- **`handleClose`** (Function) — `src/components/Chat/NewConversationModal.tsx:441`
- **`destroySharedSocket`** (Function) — `src/services/messaging/websocket.ts:399`
- **`useWebSocket`** (Function) — `src/hooks/useWebSocket.ts:26`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `SocketConnection` | Class | `src/services/messaging/websocket.ts` | 79 |
| `ChatScreen` | Function | `src/screens/Chat/ChatScreen.tsx` | 72 |
| `handleCreate` | Function | `src/components/Chat/NewConversationModal.tsx` | 334 |
| `handleClose` | Function | `src/components/Chat/NewConversationModal.tsx` | 441 |
| `destroySharedSocket` | Function | `src/services/messaging/websocket.ts` | 399 |
| `useWebSocket` | Function | `src/hooks/useWebSocket.ts` | 26 |
| `cleanup` | Function | `src/hooks/useWebSocket.ts` | 153 |
| `on` | Function | `src/services/messaging/websocket.ts` | 357 |
| `off` | Function | `src/services/messaging/websocket.ts` | 364 |
| `join` | Function | `src/services/messaging/websocket.ts` | 344 |
| `push` | Function | `src/services/messaging/websocket.ts` | 370 |
| `leave` | Function | `src/services/messaging/websocket.ts` | 377 |
| `getSharedSocket` | Function | `src/services/messaging/websocket.ts` | 394 |
| `createSocket` | Function | `src/services/messaging/websocket.ts` | 407 |
| `getConversations` | Method | `src/services/messaging/api.ts` | 53 |
| `getConversation` | Method | `src/services/messaging/api.ts` | 85 |
| `deleteConversation` | Method | `src/services/messaging/api.ts` | 95 |
| `getMessages` | Method | `src/services/messaging/api.ts` | 106 |
| `sendMessage` | Method | `src/services/messaging/api.ts` | 144 |
| `editMessage` | Method | `src/services/messaging/api.ts` | 176 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ChatScreen → GetSecureStore` | cross_community | 7 |
| `ConversationsListScreen → GetSecureStore` | cross_community | 7 |
| `HandleCreate → GetSecureStore` | cross_community | 7 |
| `NewConversationModal → DecodeJwtPayload` | cross_community | 6 |
| `AddContactModal → DecodeJwtPayload` | cross_community | 6 |
| `GroupDetailsScreen → DecodeJwtPayload` | cross_community | 5 |
| `GroupManagementScreen → DecodeJwtPayload` | cross_community | 5 |
| `ContactsScreen → DecodeJwtPayload` | cross_community | 5 |
| `AuthProvider → DecodeJwtPayload` | cross_community | 5 |
| `BlockedUsersScreen → DecodeJwtPayload` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 11 calls |
| Chat | 1 calls |
| Moderation | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ChatScreen"})` — see callers and callees
2. `gitnexus_query({query: "messaging"})` — find related execution flows
3. Read key files listed above for implementation details
