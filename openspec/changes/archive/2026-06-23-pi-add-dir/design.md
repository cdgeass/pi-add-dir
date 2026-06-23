## Context

pi is a coding agent that keeps a small core and pushes workflow features into extensions, skills, prompt templates, and packages. A session has a single primary working directory (`cwd`). There is no built-in concept of a multi-root workspace comparable to Claude Code's `/add-dir`.

Claude Code's `/add-dir` does **not** change the cwd or rewrite built-in tool path resolution. It adds directories to a session-wide "working-context" that is used for permission checks, system-prompt declarations, and optional explicit multi-directory search. Relative paths still resolve against the original cwd. We are adopting the same semantics so the behavior is familiar and predictable.

The implementation will be a pi package (`pi-add-dir`) so users can install it without modifying pi core.

## Goals / Non-Goals

**Goals:**
- Provide slash commands to manage a list of additional working directories for the current session.
- Persist that list in the session file so it survives restarts and branch navigation.
- Declare the working-context in the system prompt on every turn.
- Provide an explicit `search_all_dirs` tool for cross-directory content search.
- Match Claude Code's `/add-dir` semantics: no implicit path rewriting for built-in tools.

**Non-Goals:**
- Changing pi core or built-in tool behavior.
- Rewriting relative paths in `read`, `write`, `edit`, `ls`, `find`, `grep`, or `bash`.
- Loading context files (`AGENTS.md`/`CLAUDE.md`) or `.pi` resources from added directories.
- Modifying `@` file autocomplete to include added directories.
- Supporting nested aliases or project-specific add-dir configuration files.

## Decisions

### 1. Implement as a pi package, not a core change
**Rationale:** pi's design philosophy keeps the core small. A package can register slash commands, tools, event handlers, and custom entries via the public extension API. This avoids a fork or PR against pi and lets users opt in.

**Alternative considered:** Patch pi core to add `/add-dir` as a built-in slash command. Rejected because it violates pi's small-core philosophy and requires maintaining a fork.

### 2. Use pi's `custom` session entries for persistence
**Rationale:** pi already supports `pi.appendEntry(customType, data)` and `custom` entries in the JSONL session format. This is the intended extension state-persistence mechanism and requires no schema changes.

**Alternative considered:** Store state in a sidecar file keyed by session id. Rejected because sidecar files can drift from the session tree, especially after `/fork` or `/tree`.

### 3. Restore state from the current branch, not all entries
**Rationale:** pi sessions are trees. Walking `ctx.sessionManager.getBranch()` from the current leaf to the root gives the state that corresponds to the user's current timeline. This makes `/tree` navigation naturally branch-aware.

**Alternative considered:** Scan all entries with `getEntries()`. Rejected because it would merge state from abandoned branches.

### 4. Store the full list in every entry, not deltas
**Rationale:** Each `add-dir` custom entry stores the complete `addedDirs` array. This makes reconstruction trivial (take the latest entry) and avoids delta-apply bugs when entries are reordered or branches switch.

**Alternative considered:** Store `+path` / `-path` deltas. Rejected because reconstruction across branching is more fragile.

### 5. Do not rewrite built-in tool paths
**Rationale:** This matches Claude Code. Implicit multi-root resolution introduces ambiguity when the same relative path exists under multiple roots and hides which directory is actually being accessed. Models can use absolute paths or explicit `path` arguments to search tools.

**Alternative considered:** Intercept `tool_call` events and rewrite relative `read`/`write`/`edit` paths across added directories. Rejected for ambiguity and deviation from Claude Code semantics.

### 6. Return absolute paths from `search_all_dirs`
**Rationale:** Results may come from any root. Absolute paths are unambiguous and can be passed directly to `read` or `edit` by the model. Relative paths would require the model to know which root each result belongs to.

**Alternative considered:** Return paths relative to each root with a root alias prefix. Rejected because the prefixes are not valid `read` paths and would mislead the model.

### 7. Use `ripgrep` for `search_all_dirs`
**Rationale:** pi already bundles/expects `rg` for its own `grep` tool. Shelling out to `rg` per directory keeps the implementation simple and consistent with pi's existing search behavior.

**Alternative considered:** Use Node.js file walks and regex. Rejected because it is slower, requires reimplementing ignore rules, and diverges from pi's grep behavior.

## Risks / Trade-offs

- **Models may still try relative paths for added dirs.** The system prompt explicitly tells them to use absolute paths, but there is no enforcement. The failure mode is a standard "file not found" from pi's built-in tools, which is safe.
- **Duplicate file names across roots are visible to the model.** The system prompt and `/list-dirs` make roots explicit, and absolute paths disambiguate. No implicit selection is performed.
- **`search_all_dirs` performance on many/large added dirs.** Each directory spawns a separate `rg` invocation. In practice added dirs are few and small. If performance becomes an issue, the tool can be limited or parallelized later.
- **Restored directories may be deleted.** The package keeps stale paths and warns once. This matches the tolerant behavior of other session-restored state.
- **No autocomplete integration.** Added directories will not appear in pi's `@` file completion. This is accepted because pi's autocomplete API is core-owned and out of scope.

## Migration Plan

- This is a new package with no existing users.
- Installation: `pi install npm:pi-add-dir` or `pi install git:.../pi-add-dir` or `pi -e ./path` for local testing.
- No rollback is needed beyond removing the package.

## Open Questions

- Should `search_all_dirs` also support a `count` output mode? The spec lists `files_with_matches` and `content` as required; `count` can be added in a follow-up if useful.
- Should the package offer a setting to automatically add parent git repository roots? Deferred to a future version.
