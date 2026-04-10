---
name: groups
description: "Skill for the Groups area of mobile-app. 25 symbols across 3 files."
---

# Groups

25 symbols | 3 files | Cohesion: 60%

## When to Use

- Working with code in `src/`
- Understanding how GroupDetailsScreen, renderHeader, renderGroupInfo work
- Modifying groups-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/groups/api.ts` | getGroupStats, getGroupLogs, getGroupSettings, addMembers, removeMember (+8) |
| `src/screens/Groups/GroupDetailsScreen.tsx` | GroupDetailsScreen, renderHeader, renderGroupInfo, renderTabs, renderLeaveModal (+2) |
| `src/screens/Groups/GroupManagementScreen.tsx` | GroupManagementScreen, renderHeader, renderGroupInfo, renderMembers, renderAddMembersModal |

## Entry Points

Start here when exploring this area:

- **`GroupDetailsScreen`** (Function) — `src/screens/Groups/GroupDetailsScreen.tsx:47`
- **`renderHeader`** (Function) — `src/screens/Groups/GroupDetailsScreen.tsx:201`
- **`renderGroupInfo`** (Function) — `src/screens/Groups/GroupDetailsScreen.tsx:233`
- **`renderTabs`** (Function) — `src/screens/Groups/GroupDetailsScreen.tsx:258`
- **`renderLeaveModal`** (Function) — `src/screens/Groups/GroupDetailsScreen.tsx:685`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `GroupDetailsScreen` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 47 |
| `renderHeader` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 201 |
| `renderGroupInfo` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 233 |
| `renderTabs` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 258 |
| `renderLeaveModal` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 685 |
| `renderDeleteModal` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 759 |
| `renderTransferAdminModal` | Function | `src/screens/Groups/GroupDetailsScreen.tsx` | 831 |
| `GroupManagementScreen` | Function | `src/screens/Groups/GroupManagementScreen.tsx` | 62 |
| `renderHeader` | Function | `src/screens/Groups/GroupManagementScreen.tsx` | 527 |
| `renderGroupInfo` | Function | `src/screens/Groups/GroupManagementScreen.tsx` | 549 |
| `renderMembers` | Function | `src/screens/Groups/GroupManagementScreen.tsx` | 717 |
| `renderAddMembersModal` | Function | `src/screens/Groups/GroupManagementScreen.tsx` | 860 |
| `getGroupStats` | Method | `src/services/groups/api.ts` | 186 |
| `getGroupLogs` | Method | `src/services/groups/api.ts` | 216 |
| `getGroupSettings` | Method | `src/services/groups/api.ts` | 229 |
| `addMembers` | Method | `src/services/groups/api.ts` | 246 |
| `removeMember` | Method | `src/services/groups/api.ts` | 310 |
| `transferAdmin` | Method | `src/services/groups/api.ts` | 330 |
| `getGroupDetails` | Method | `src/services/groups/api.ts` | 82 |
| `getGroupMembers` | Method | `src/services/groups/api.ts` | 125 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GroupDetailsScreen → GetSecureStore` | cross_community | 6 |
| `GroupManagementScreen → GetSecureStore` | cross_community | 6 |
| `GroupDetailsScreen → DecodeJwtPayload` | cross_community | 5 |
| `GroupManagementScreen → DecodeJwtPayload` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Chat | 8 calls |
| Services | 3 calls |
| Contacts | 1 calls |

## How to Explore

1. `gitnexus_context({name: "GroupDetailsScreen"})` — see callers and callees
2. `gitnexus_query({query: "groups"})` — find related execution flows
3. Read key files listed above for implementation details
