## Why

pi currently operates on a single working directory per session. Users working across related codebases (monorepos, shared libraries, sibling projects) must either launch multiple pi sessions or use absolute paths manually. Claude Code solves this with `/add-dir`, which extends the session's working-context without changing the primary cwd. We want the same capability in pi, implemented as a pi package so it can be installed without modifying pi core.

## What Changes

- Create a new pi package `pi-add-dir` that registers slash commands:
  - `/add-dir <path>` — add a directory to the session's working-context
  - `/remove-dir [path]` — remove an added directory
  - `/list-dirs` — show the primary cwd plus all added directories
- Persist the added-directories list to the session JSONL via pi's `custom` entry mechanism.
- Restore the list on session start, resume, fork, and branch navigation.
- Inject a system-prompt section declaring the working-context so the model knows which directories are available.
- Provide a custom tool `search_all_dirs` that explicitly searches across the primary cwd and all added directories.
- Do **not** rewrite built-in tool path resolution. Relative paths still resolve to the primary cwd, matching Claude Code semantics.

## Capabilities

### New Capabilities

- `add-dir-command`: User-facing slash commands to manage additional working directories.
- `added-dirs-session-persistence`: Storing and restoring the added-directories list in the session file.
- `added-dirs-context-injection`: Declaring added directories in the system prompt each turn.
- `search-across-added-dirs`: Explicit cross-directory search tool spanning cwd + added dirs.

### Modified Capabilities

- None. This is a pure add-on package and does not change existing pi capabilities.

## Impact

- New npm/git-installable pi package under the current project.
- No changes to pi core, built-in tools, or session format beyond the existing `custom` entry type.
- Users must install the package via `pi install` or load it as a local extension to use the commands.
