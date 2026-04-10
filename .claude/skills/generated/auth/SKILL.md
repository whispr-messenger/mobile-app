---
name: auth
description: "Skill for the Auth area of mobile-app. 16 symbols across 8 files."
---

# Auth

16 symbols | 8 files | Cohesion: 54%

## When to Use

- Working with code in `src/`
- Understanding how getFontSize, SettingItem, SettingSection work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/screens/Auth/OtpScreen.tsx` | OtpScreen, shake, generateAndUploadSignalKeys, handleDigitChange, handleKeyPress |
| `src/components/Toast/Toast.tsx` | Toast, hideToast, getIconAndColor |
| `src/screens/Settings/SettingsScreen.tsx` | SettingItem, SettingSection |
| `src/services/SecurityService.ts` | uploadSignedPrekey, uploadPrekeys |
| `src/context/ThemeContext.tsx` | getFontSize |
| `src/screens/Auth/WelcomeScreen.tsx` | WelcomeScreen |
| `src/screens/Auth/ProfileSetupScreen.tsx` | ProfileSetupScreen |
| `src/screens/Auth/PhoneInputScreen.tsx` | PhoneInputScreen |

## Entry Points

Start here when exploring this area:

- **`getFontSize`** (Function) — `src/context/ThemeContext.tsx:597`
- **`SettingItem`** (Function) — `src/screens/Settings/SettingsScreen.tsx:423`
- **`SettingSection`** (Function) — `src/screens/Settings/SettingsScreen.tsx:505`
- **`WelcomeScreen`** (Function) — `src/screens/Auth/WelcomeScreen.tsx:12`
- **`ProfileSetupScreen`** (Function) — `src/screens/Auth/ProfileSetupScreen.tsx:32`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getFontSize` | Function | `src/context/ThemeContext.tsx` | 597 |
| `SettingItem` | Function | `src/screens/Settings/SettingsScreen.tsx` | 423 |
| `SettingSection` | Function | `src/screens/Settings/SettingsScreen.tsx` | 505 |
| `WelcomeScreen` | Function | `src/screens/Auth/WelcomeScreen.tsx` | 12 |
| `ProfileSetupScreen` | Function | `src/screens/Auth/ProfileSetupScreen.tsx` | 32 |
| `PhoneInputScreen` | Function | `src/screens/Auth/PhoneInputScreen.tsx` | 35 |
| `OtpScreen` | Function | `src/screens/Auth/OtpScreen.tsx` | 32 |
| `shake` | Function | `src/screens/Auth/OtpScreen.tsx` | 72 |
| `generateAndUploadSignalKeys` | Function | `src/screens/Auth/OtpScreen.tsx` | 89 |
| `handleDigitChange` | Function | `src/screens/Auth/OtpScreen.tsx` | 174 |
| `handleKeyPress` | Function | `src/screens/Auth/OtpScreen.tsx` | 203 |
| `uploadSignedPrekey` | Method | `src/services/SecurityService.ts` | 189 |
| `uploadPrekeys` | Method | `src/services/SecurityService.ts` | 204 |
| `Toast` | Function | `src/components/Toast/Toast.tsx` | 28 |
| `hideToast` | Function | `src/components/Toast/Toast.tsx` | 78 |
| `getIconAndColor` | Function | `src/components/Toast/Toast.tsx` | 97 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OtpScreen → ApiFetch` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Chat | 5 calls |
| Services | 5 calls |
| Security | 4 calls |

## How to Explore

1. `gitnexus_context({name: "getFontSize"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
