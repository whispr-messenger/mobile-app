---
name: moderation
description: "Skill for the Moderation area of mobile-app. 9 symbols across 3 files."
---

# Moderation

9 symbols | 3 files | Cohesion: 95%

## When to Use

- Working with code in `src/`
- Understanding how imageUriToFloatTensor_0_255, gateChatImageBeforeSend work
- Modifying moderation-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/moderation/tflite.service.ts` | init, warmup, isAllowed, gate, firstFloatArray |
| `src/services/moderation/image-to-tensor.ts` | base64ToUint8Array, resizeToJpegBase64, imageUriToFloatTensor_0_255 |
| `src/services/moderation/gate-chat-image.ts` | gateChatImageBeforeSend |

## Entry Points

Start here when exploring this area:

- **`imageUriToFloatTensor_0_255`** (Function) — `src/services/moderation/image-to-tensor.ts:43`
- **`gateChatImageBeforeSend`** (Function) — `src/services/moderation/gate-chat-image.ts:10`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `imageUriToFloatTensor_0_255` | Function | `src/services/moderation/image-to-tensor.ts` | 43 |
| `gateChatImageBeforeSend` | Function | `src/services/moderation/gate-chat-image.ts` | 10 |
| `firstFloatArray` | Function | `src/services/moderation/tflite.service.ts` | 142 |
| `base64ToUint8Array` | Function | `src/services/moderation/image-to-tensor.ts` | 4 |
| `resizeToJpegBase64` | Function | `src/services/moderation/image-to-tensor.ts` | 20 |
| `init` | Method | `src/services/moderation/tflite.service.ts` | 49 |
| `warmup` | Method | `src/services/moderation/tflite.service.ts` | 64 |
| `isAllowed` | Method | `src/services/moderation/tflite.service.ts` | 72 |
| `gate` | Method | `src/services/moderation/tflite.service.ts` | 80 |

## How to Explore

1. `gitnexus_context({name: "imageUriToFloatTensor_0_255"})` — see callers and callees
2. `gitnexus_query({query: "moderation"})` — find related execution flows
3. Read key files listed above for implementation details
