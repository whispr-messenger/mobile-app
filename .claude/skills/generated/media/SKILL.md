---
name: media
description: "Skill for the Media area of mobile-app. 6 symbols across 2 files."
---

# Media

6 symbols | 2 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how emitSessionExpired, doUpload, uploadImage work
- Modifying media-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/media/api.ts` | guessImageMimeType, uploadImage, doUpload, uploadAvatar, uploadGroupIcon |
| `src/services/sessionEvents.ts` | emitSessionExpired |

## Entry Points

Start here when exploring this area:

- **`emitSessionExpired`** (Function) — `src/services/sessionEvents.ts:4`
- **`doUpload`** (Function) — `src/services/media/api.ts:47`
- **`uploadImage`** (Method) — `src/services/media/api.ts:30`
- **`uploadAvatar`** (Method) — `src/services/media/api.ts:83`
- **`uploadGroupIcon`** (Method) — `src/services/media/api.ts:90`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `emitSessionExpired` | Function | `src/services/sessionEvents.ts` | 4 |
| `doUpload` | Function | `src/services/media/api.ts` | 47 |
| `uploadImage` | Method | `src/services/media/api.ts` | 30 |
| `uploadAvatar` | Method | `src/services/media/api.ts` | 83 |
| `uploadGroupIcon` | Method | `src/services/media/api.ts` | 90 |
| `guessImageMimeType` | Function | `src/services/media/api.ts` | 16 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 2 calls |

## How to Explore

1. `gitnexus_context({name: "emitSessionExpired"})` — see callers and callees
2. `gitnexus_query({query: "media"})` — find related execution flows
3. Read key files listed above for implementation details
