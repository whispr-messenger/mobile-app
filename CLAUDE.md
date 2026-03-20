# AI Agent Workflow — whispr-messenger/mobile-app

This document describes the full development workflow an AI agent must follow
when picking up and completing a Jira ticket for this repository.

---

## 0. Prerequisites

- Jira cloud ID: fetch at runtime via `mcp__atlassian__getAccessibleAtlassianResources` (select the resource whose `name` matches the Jira site)
- GitHub org/repo: `whispr-messenger/mobile-app`
- Default base branch: `main`
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
git checkout main
git pull origin main
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

---

## 8. Open a Pull Request

Use `mcp__github__create_pull_request`:

```json
{
  "owner": "whispr-messenger",
  "repo": "mobile-app",
  "title": "<same as commit title>",
  "head": "<branch-name>",
  "base": "main",
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
  "merge_method": "squash"
}
```

Always use **squash** merge to keep `main` history linear.

---

## 10. Close the Jira ticket

Use `mcp__atlassian__transitionJiraIssue` with the transition whose `name` is
`"Terminé"` (currently id `"31"`) to move the ticket to done.

---

## 11. Return to main

```bash
git checkout main
git pull origin main
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
