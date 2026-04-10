---
name: chat
description: "Skill for the Chat area of mobile-app. 61 symbols across 31 files."
---

# Chat

61 symbols | 31 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how onTyping, getThemeColors, ChatHeader work
- Modifying chat-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/components/Chat/NewConversationModal.tsx` | NewConversationModal, handleTypeSelect, handleContactSelect, handleMemberToggle, renderTypeSelection (+2) |
| `src/screens/Groups/GroupDetailsScreen.tsx` | renderInfoTab, renderMembersTab, renderStatsTab, renderHistoryTab, renderSettingsTab (+1) |
| `src/screens/Chat/ScheduledMessagesScreen.tsx` | formatScheduledDate, getStatusColor, getStatusLabel, ScheduledMessagesScreen |
| `src/components/Navigation/BottomTabBar.tsx` | BottomTabBar, handleTabPress, isActive |
| `src/components/Chat/TypingIndicator.tsx` | TypingIndicator, animateDot, getDisplayText |
| `src/components/Chat/MessageBubble.tsx` | MessageBubble, handleLongPress, renderBubbleContent |
| `src/components/Chat/ScheduleDateTimePicker.tsx` | getQuickDate, padZero, ScheduleDateTimePicker |
| `src/components/Chat/ReactionPicker.tsx` | ReactionPicker, handleReactionSelect |
| `src/components/Chat/MessageInput.tsx` | MessageInput, formatRecordingTime |
| `src/components/Chat/MessageActionsMenu.tsx` | MessageActionsMenu, handleDelete |

## Entry Points

Start here when exploring this area:

- **`onTyping`** (Function) — `src/hooks/useWebSocket.ts:114`
- **`getThemeColors`** (Function) — `src/context/ThemeContext.tsx:585`
- **`ChatHeader`** (Function) — `src/screens/Chat/ChatHeader.tsx:23`
- **`BottomTabBar`** (Function) — `src/components/Navigation/BottomTabBar.tsx:35`
- **`handleTabPress`** (Function) — `src/components/Navigation/BottomTabBar.tsx:48`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `onTyping` | Function | `src/hooks/useWebSocket.ts` | 114 |
| `getThemeColors` | Function | `src/context/ThemeContext.tsx` | 585 |
| `ChatHeader` | Function | `src/screens/Chat/ChatHeader.tsx` | 23 |
| `BottomTabBar` | Function | `src/components/Navigation/BottomTabBar.tsx` | 35 |
| `handleTabPress` | Function | `src/components/Navigation/BottomTabBar.tsx` | 48 |
| `isActive` | Function | `src/components/Navigation/BottomTabBar.tsx` | 55 |
| `Input` | Function | `src/components/Input/Input.tsx` | 19 |
| `ContactItem` | Function | `src/components/Contacts/ContactItem.tsx` | 18 |
| `TypingIndicator` | Function | `src/components/Chat/TypingIndicator.tsx` | 24 |
| `animateDot` | Function | `src/components/Chat/TypingIndicator.tsx` | 37 |
| `getDisplayText` | Function | `src/components/Chat/TypingIndicator.tsx` | 68 |
| `SystemMessage` | Function | `src/components/Chat/SystemMessage.tsx` | 13 |
| `ReplyPreview` | Function | `src/components/Chat/ReplyPreview.tsx` | 16 |
| `ReactionPicker` | Function | `src/components/Chat/ReactionPicker.tsx` | 17 |
| `handleReactionSelect` | Function | `src/components/Chat/ReactionPicker.tsx` | 25 |
| `ReactionButton` | Function | `src/components/Chat/ReactionButton.tsx` | 16 |
| `PinnedMessagesBar` | Function | `src/components/Chat/PinnedMessagesBar.tsx` | 18 |
| `MessageSearch` | Function | `src/components/Chat/MessageSearch.tsx` | 21 |
| `MessageInput` | Function | `src/components/Chat/MessageInput.tsx` | 40 |
| `formatRecordingTime` | Function | `src/components/Chat/MessageInput.tsx` | 360 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `NewConversationModal → GetSecureStore` | cross_community | 8 |
| `ScheduledMessagesScreen → GetSecureStore` | cross_community | 7 |
| `NewConversationModal → DecodeJwtPayload` | cross_community | 6 |
| `ScheduledMessagesScreen → GetSchedulingBaseUrl` | cross_community | 4 |
| `ScheduledMessagesScreen → WithOpacity` | cross_community | 3 |
| `NewConversationModal → BuildSearchResult` | cross_community | 3 |
| `NewConversationModal → HandleTypeSelect` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Contacts | 2 calls |
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "onTyping"})` — see callers and callees
2. `gitnexus_query({query: "chat"})` — find related execution flows
3. Read key files listed above for implementation details
