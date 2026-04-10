---
name: security
description: "Skill for the Security area of mobile-app. 46 symbols across 10 files."
---

# Security

46 symbols | 10 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how getLocalizedText, handleLogout, handleDeleteAccount work
- Modifying security-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/screens/Security/SecurityKeysScreen.tsx` | SecurityKeysScreen, triggerHaptic, showToast, handleDisconnectDevice, handleShowSecurityCode (+7) |
| `src/screens/Security/TwoFactorSetupScreen.tsx` | buildStarPath, buildSparkPath, TwoFactorSetupScreen, showToast, triggerHaptic (+2) |
| `src/services/TwoFactorService.ts` | apiFetch, getStatus, setup, disable, getBackupCodes (+1) |
| `src/screens/Security/TwoFactorAuthScreen.tsx` | TwoFactorAuthScreen, showToast, triggerHaptic, handleToggle2FA, handleDisable2FA (+1) |
| `src/screens/Security/TwoFactorBackupCodesScreen.tsx` | TwoFactorBackupCodesScreen, showToast, triggerHaptic, handleCopyCode, handleCopyAll (+1) |
| `src/screens/Security/TwoFactorVerifyScreen.tsx` | TwoFactorVerifyScreen, showToast, triggerHaptic, handleVerify |
| `src/screens/Settings/SettingsScreen.tsx` | handleLogout, handleDeleteAccount |
| `src/context/ThemeContext.tsx` | getLocalizedText |
| `src/screens/Auth/ProfileSetupScreen.tsx` | pickImage |
| `src/utils/clipboard.ts` | copyToClipboard |

## Entry Points

Start here when exploring this area:

- **`getLocalizedText`** (Function) — `src/context/ThemeContext.tsx:606`
- **`handleLogout`** (Function) — `src/screens/Settings/SettingsScreen.tsx:351`
- **`handleDeleteAccount`** (Function) — `src/screens/Settings/SettingsScreen.tsx:384`
- **`SecurityKeysScreen`** (Function) — `src/screens/Security/SecurityKeysScreen.tsx:49`
- **`triggerHaptic`** (Function) — `src/screens/Security/SecurityKeysScreen.tsx:171`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getLocalizedText` | Function | `src/context/ThemeContext.tsx` | 606 |
| `handleLogout` | Function | `src/screens/Settings/SettingsScreen.tsx` | 351 |
| `handleDeleteAccount` | Function | `src/screens/Settings/SettingsScreen.tsx` | 384 |
| `SecurityKeysScreen` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 49 |
| `triggerHaptic` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 171 |
| `showToast` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 187 |
| `handleDisconnectDevice` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 194 |
| `handleShowSecurityCode` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 227 |
| `handleVerifySecurityCode` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 233 |
| `handleCopySecurityCode` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 246 |
| `handleScanQRCode` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 257 |
| `getDeviceIcon` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 267 |
| `formatDate` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 283 |
| `DeviceCard` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 292 |
| `SecurityKeyCard` | Function | `src/screens/Security/SecurityKeysScreen.tsx` | 528 |
| `pickImage` | Function | `src/screens/Auth/ProfileSetupScreen.tsx` | 54 |
| `TwoFactorAuthScreen` | Function | `src/screens/Security/TwoFactorAuthScreen.tsx` | 29 |
| `showToast` | Function | `src/screens/Security/TwoFactorAuthScreen.tsx` | 50 |
| `triggerHaptic` | Function | `src/screens/Security/TwoFactorAuthScreen.tsx` | 57 |
| `handleToggle2FA` | Function | `src/screens/Security/TwoFactorAuthScreen.tsx` | 105 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TwoFactorSetupScreen → GetSecureStore` | cross_community | 6 |
| `HandleVerify → GetSecureStore` | cross_community | 6 |
| `TwoFactorAuthScreen → GetSecureStore` | cross_community | 6 |
| `HandleDisable2FA → GetSecureStore` | cross_community | 6 |
| `HandleViewBackupCodes → GetSecureStore` | cross_community | 6 |
| `DeviceCard → TriggerHaptic` | intra_community | 3 |
| `DeviceCard → ShowToast` | intra_community | 3 |
| `DeviceCard → GetLocalizedText` | intra_community | 3 |
| `SecurityKeyCard → TriggerHaptic` | intra_community | 3 |
| `SecurityKeyCard → CopyToClipboard` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Auth | 7 calls |
| Chat | 5 calls |
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getLocalizedText"})` — see callers and callees
2. `gitnexus_query({query: "security"})` — find related execution flows
3. Read key files listed above for implementation details
