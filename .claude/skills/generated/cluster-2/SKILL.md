---
name: cluster-2
description: "Skill for the Cluster_2 area of mobile-app. 5 symbols across 1 files."
---

# Cluster_2

5 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how shouldLog, error, warn work
- Modifying cluster_2-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/utils/logger.ts` | shouldLog, error, warn, info, debug |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `shouldLog` | Method | `src/utils/logger.ts` | 18 |
| `error` | Method | `src/utils/logger.ts` | 25 |
| `warn` | Method | `src/utils/logger.ts` | 31 |
| `info` | Method | `src/utils/logger.ts` | 37 |
| `debug` | Method | `src/utils/logger.ts` | 43 |

## How to Explore

1. `gitnexus_context({name: "shouldLog"})` — see callers and callees
2. `gitnexus_query({query: "cluster_2"})` — find related execution flows
3. Read key files listed above for implementation details
