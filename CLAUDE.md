# AI Agent Workflow — whispr-messenger/mobile-app

This document describes the full development workflow an AI agent must follow
when picking up and completing a Jira ticket for this repository.

---

## 0. Prerequisites

- Jira cloud ID: fetch at runtime via `mcp__atlassian__getAccessibleAtlassianResources` (select the resource whose `name` matches the Jira site)
- GitHub org/repo: `whispr-messenger/mobile-app`
- Default base branch: `deploy/preprod`
- Node package manager: `npm`

---

## 1. Pick the ticket

1. Use `mcp__atlassian__getJiraIssue` to fetch the target ticket (e.g. `WHISPR-290`).
2. Read the **description**, **acceptance criteria**, and **priority** carefully.
3. Use `mcp__atlassian__getTransitionsForJiraIssue` to list available transitions.
4. Transition the ticket from "À faire" → "En cours" using `mcp__atlassian__transitionJiraIssue`
   with the transition id whose `name` is `"En cours"` (currently `"21"`).

---

## 2. Prepare the branch

```bash
git checkout deploy/preprod
git pull origin deploy/preprod
git checkout -b <TICKET-KEY>-<short-kebab-description>
```

Branch naming convention: `WHISPR-XXX-short-description-of-the-fix`

Example: `WHISPR-310-fix-chat-screen-scroll-to-bottom`

---

## 3. Implement the fix

- Read all relevant files before modifying anything.
- Make the smallest change that fully addresses the ticket.
- Do not refactor unrelated code, add comments, or change formatting outside
  the touched lines.
- Prefer editing existing files over creating new ones.

---

## 4. Write tests

Current test layout:

| Kind | Location | Pattern |
|------|----------|---------|
| Unit | project root (alongside entry files such as `App.tsx`) | `*.test.ts` or `*.test.tsx` |

In this repository, unit tests currently live at the project root (for example, `App.test.tsx`). Follow this layout when adding new tests unless and until the project is reorganized to colocate tests with their corresponding source files.
### Rules

- **Test behaviour, not implementation.** Assert on observable outcomes
  (rendered output, navigation calls, state changes) rather than internal
  call sequences.
- Mock all network calls and native modules — never hit real services.
- Use React Native Testing Library (`@testing-library/react-native`) for
  component tests.

### Run tests

```bash
# All tests
npm test -- --watchAll=false

# Specific pattern
npm test -- --watchAll=false --testPathPattern="ChatScreen"
```

All tests must be green before committing.

---

## 5. Lint and format

```bash
npm run lint:fix
npx prettier --write "src/**/*.{ts,tsx}"
```

---

## 6. Commit

Stage only the files you changed:

```bash
git add <file1> <file2> ...
```

Commit message format (Conventional Commits):

```
<type>(<scope>): <short imperative summary>

<optional body — explain the why, not the what>
```

- **type**: `fix`, `feat`, `refactor`, `test`, `docs`, `chore`
- **scope**: screen or feature name, e.g. `chat`, `auth`, `profile`, `navigation`
- Do **not** mention Claude, AI, or any tooling in the commit message.
- Do **not** use `--no-verify` to skip hooks.

Example:
```
fix(chat): scroll to bottom on new message received
```

---

## 7. Push

```bash
git push -u origin <branch-name>
```

After every push, request a Copilot review on the pull request:

```bash
gh api repos/whispr-messenger/mobile-app/pulls/<PR-number>/requested_reviewers \
  --method POST -f 'reviewers[]=copilot'
```

---

## 8. Open a Pull Request

Use `mcp__github__create_pull_request`:

```json
{
  "owner": "whispr-messenger",
  "repo": "mobile-app",
  "title": "<same as commit title>",
  "head": "<branch-name>",
  "base": "deploy/preprod",
  "body": "## Summary\n- bullet 1\n- bullet 2\n\n## Test plan\n- [ ] Unit tests green\n- [ ] Lint clean\n- [ ] Tested on iOS simulator\n- [ ] Tested on Android emulator\n\nCloses <TICKET-KEY>"
}
```

After creation, check CI with:

```bash
gh pr checks <PR-number> --repo whispr-messenger/mobile-app
```

Fix any failing checks before merging.

---

## 9. Merge the PR

Once all CI checks are green, use `mcp__github__merge_pull_request`:

```json
{
  "owner": "whispr-messenger",
  "repo": "mobile-app",
  "pullNumber": <number>,
  "merge_method": "merge"
}
```

Always use **merge** (not squash — per user global rules §26) to keep the granular commit history.

---

## 10. Close the Jira ticket

Use `mcp__atlassian__transitionJiraIssue` with the transition whose `name` is
`"Terminé"` (currently id `"31"`) to move the ticket to done.

---

## 11. Return to deploy/preprod

```bash
git checkout deploy/preprod
git pull origin deploy/preprod
```

---

## Jira transition IDs (reference)

| Name | ID (example) |
|------|-------------|
| À faire | `11` |
| En cours | `21` |
| Terminé | `31` |

**Important:** transition IDs can change when Jira workflows are edited.
Always call `mcp__atlassian__getTransitionsForJiraIssue` and select the
transition by `name` — never hard-code the numeric ID. The values above
are examples only.

---

## Jira MCP — Usage Notes

### Tool parameter types

`mcp__atlassian__searchJiraIssuesUsingJql` requires:
- `maxResults`: **number**, not string (e.g. `10`, not `"10"`)
- `fields`: **array**, not string (e.g. `["summary", "status"]`, not `"summary,status"`)

### Fetching the sprint ID for issue creation

`mcp__atlassian__createJiraIssue` requires a **numeric** sprint ID in `additional_fields.customfield_10020`, not a name string.

To get it, query an existing issue from the target sprint and read `customfield_10020[0].id`:

```json
// mcp__atlassian__searchJiraIssuesUsingJql
{
  "jql": "project = WHISPR AND sprint in openSprints()",
  "fields": ["customfield_10020"],
  "maxResults": 1
}
// → customfield_10020[0].id  (e.g. 167 for Sprint 5)
```

Then pass it as a number in `createJiraIssue`:

```json
// mcp__atlassian__createJiraIssue
{
  "additional_fields": { "customfield_10020": 167 }
}
```

### Current sprint

| Sprint | ID | Board ID |
|--------|----|----------|
| Sprint 6 | `200` | `34` |

### Tools that do NOT work

- `mcp__atlassian__jiraRead` — requires an `action` enum parameter, not a free-form URL; not useful for agile/sprint endpoints.
- `mcp__atlassian__fetch` — requires an `id` parameter; cannot be used for arbitrary REST calls.

---

## Task Tracking with Beads

This repository uses **beads** (`bd`) — a git-backed, graph-based issue tracker optimised for AI agents — for local task tracking within a session or across long-horizon work.

Beads uses a Dolt (version-controlled SQL) database and assigns each task a short hash ID (e.g. `bd-a1b2`) to avoid merge collisions in multi-agent workflows.

### Key commands

| Command | Purpose |
|---------|---------|
| `bd ready` | List tasks with no blocking dependencies (pick your next task here) |
| `bd create "Title" -p 0` | Create a new task (`-p 0` = highest priority) |
| `bd update <id> --claim` | Atomically assign the task to yourself and mark it in-progress |
| `bd dep add <child> <parent>` | Declare that `<child>` depends on `<parent>` |
| `bd show <id>` | Show task details and history |

### Task hierarchy

Tasks use dot notation: `bd-a3f8` (epic) → `bd-a3f8.1` (task) → `bd-a3f8.1.1` (subtask).

### Workflow

1. Run `bd ready` to see what is available.
2. Run `bd update <id> --claim` to take ownership and start work.
3. Use `bd dep add` to express blocking relationships between tasks.
4. Close tasks with `bd update <id> --status done` when complete.

Use beads for **in-session planning and subtask decomposition**. Jira remains the source of truth for sprint-level tickets.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mobile-app** (946 symbols, 2610 relationships, 73 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/mobile-app/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "deploy/preprod"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mobile-app/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mobile-app/clusters` | All functional areas |
| `gitnexus://repo/mobile-app/processes` | All execution flows |
| `gitnexus://repo/mobile-app/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Services area (76 symbols) | `.claude/skills/generated/services/SKILL.md` |
| Work in the Chat area (61 symbols) | `.claude/skills/generated/chat/SKILL.md` |
| Work in the Messaging area (53 symbols) | `.claude/skills/generated/messaging/SKILL.md` |
| Work in the Security area (46 symbols) | `.claude/skills/generated/security/SKILL.md` |
| Work in the Contacts area (38 symbols) | `.claude/skills/generated/contacts/SKILL.md` |
| Work in the Groups area (25 symbols) | `.claude/skills/generated/groups/SKILL.md` |
| Work in the Auth area (16 symbols) | `.claude/skills/generated/auth/SKILL.md` |
| Work in the Moderation area (9 symbols) | `.claude/skills/generated/moderation/SKILL.md` |
| Work in the Settings area (8 symbols) | `.claude/skills/generated/settings/SKILL.md` |
| Work in the Media area (6 symbols) | `.claude/skills/generated/media/SKILL.md` |
| Work in the Profile area (6 symbols) | `.claude/skills/generated/profile/SKILL.md` |
| Work in the Cluster_2 area (5 symbols) | `.claude/skills/generated/cluster-2/SKILL.md` |
| Work in the Cluster_5 area (4 symbols) | `.claude/skills/generated/cluster-5/SKILL.md` |
| Work in the Button area (3 symbols) | `.claude/skills/generated/button/SKILL.md` |

<!-- gitnexus:end -->
