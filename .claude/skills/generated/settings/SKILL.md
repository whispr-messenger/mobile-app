---
name: settings
description: "Skill for the Settings area of mobile-app. 8 symbols across 3 files."
---

# Settings

8 symbols | 3 files | Cohesion: 52%

## When to Use

- Working with code in `src/`
- Understanding how updateSettings, SettingsScreen, capitalize work
- Modifying settings-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/screens/Settings/SettingsScreen.tsx` | SettingsScreen, capitalize, handleToggle, handleSelect, handlePrivacyItemPress (+1) |
| `src/services/UserService.ts` | updatePrivacySettings |
| `src/context/ThemeContext.tsx` | updateSettings |

## Entry Points

Start here when exploring this area:

- **`updateSettings`** (Function) — `src/context/ThemeContext.tsx:574`
- **`SettingsScreen`** (Function) — `src/screens/Settings/SettingsScreen.tsx:29`
- **`capitalize`** (Function) — `src/screens/Settings/SettingsScreen.tsx:135`
- **`handleToggle`** (Function) — `src/screens/Settings/SettingsScreen.tsx:273`
- **`handleSelect`** (Function) — `src/screens/Settings/SettingsScreen.tsx:307`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `updateSettings` | Function | `src/context/ThemeContext.tsx` | 574 |
| `SettingsScreen` | Function | `src/screens/Settings/SettingsScreen.tsx` | 29 |
| `capitalize` | Function | `src/screens/Settings/SettingsScreen.tsx` | 135 |
| `handleToggle` | Function | `src/screens/Settings/SettingsScreen.tsx` | 273 |
| `handleSelect` | Function | `src/screens/Settings/SettingsScreen.tsx` | 307 |
| `handlePrivacyItemPress` | Function | `src/screens/Settings/SettingsScreen.tsx` | 346 |
| `SelectionModal` | Function | `src/screens/Settings/SettingsScreen.tsx` | 542 |
| `updatePrivacySettings` | Method | `src/services/UserService.ts` | 230 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SettingsScreen → GetSecureStore` | cross_community | 7 |
| `SelectionModal → GetSecureStore` | cross_community | 5 |
| `SettingsScreen → GetNotificationBaseUrl` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 8 calls |
| Auth | 2 calls |
| Security | 2 calls |
| Chat | 1 calls |

## How to Explore

1. `gitnexus_context({name: "updateSettings"})` — see callers and callees
2. `gitnexus_query({query: "settings"})` — find related execution flows
3. Read key files listed above for implementation details
