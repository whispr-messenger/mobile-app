---
name: profile
description: "Skill for the Profile area of mobile-app. 6 symbols across 2 files."
---

# Profile

6 symbols | 2 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how ProfileScreen, handleSaveProfile, validateField work
- Modifying profile-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/screens/Profile/ProfileScreen.tsx` | ProfileScreen, handleSaveProfile, validateField, handleFieldChange |
| `src/services/UserService.ts` | updateProfile, validateProfileData |

## Entry Points

Start here when exploring this area:

- **`ProfileScreen`** (Function) — `src/screens/Profile/ProfileScreen.tsx:68`
- **`handleSaveProfile`** (Function) — `src/screens/Profile/ProfileScreen.tsx:205`
- **`validateField`** (Function) — `src/screens/Profile/ProfileScreen.tsx:311`
- **`handleFieldChange`** (Function) — `src/screens/Profile/ProfileScreen.tsx:352`
- **`updateProfile`** (Method) — `src/services/UserService.ts:91`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ProfileScreen` | Function | `src/screens/Profile/ProfileScreen.tsx` | 68 |
| `handleSaveProfile` | Function | `src/screens/Profile/ProfileScreen.tsx` | 205 |
| `validateField` | Function | `src/screens/Profile/ProfileScreen.tsx` | 311 |
| `handleFieldChange` | Function | `src/screens/Profile/ProfileScreen.tsx` | 352 |
| `updateProfile` | Method | `src/services/UserService.ts` | 91 |
| `validateProfileData` | Method | `src/services/UserService.ts` | 307 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleSaveProfile → GetSecureStore` | cross_community | 5 |
| `HandleSaveProfile → DecodeJwtPayload` | cross_community | 4 |
| `HandleSaveProfile → GetMediaBaseUrl` | cross_community | 3 |
| `HandleSaveProfile → UserService` | cross_community | 3 |
| `HandleSaveProfile → ValidateProfileData` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 5 calls |

## How to Explore

1. `gitnexus_context({name: "ProfileScreen"})` — see callers and callees
2. `gitnexus_query({query: "profile"})` — find related execution flows
3. Read key files listed above for implementation details
