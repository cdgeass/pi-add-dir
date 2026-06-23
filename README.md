# pi-add-dir

Add additional working directories to a [pi](https://pi.dev) session, inspired by Claude Code's `/add-dir`.

## Motivation

pi operates on a single primary working directory (`cwd`) per session. When you work across related codebases — monorepos, shared libraries, sibling projects — you'd normally need to launch multiple pi sessions or type absolute paths constantly. This package gives you slash commands to manage a set of "working context" directories, and a tool that can search across all of them at once.

## Design Philosophy

`pi-add-dir` follows Claude Code's `/add-dir` semantics:

- **No implicit path rewriting.** Built-in tools like `read`, `write`, `edit`, and `bash` still resolve relative paths against the primary `cwd` only. The model is told to use absolute paths for files in added directories.
- **Explicit cross-directory search.** The custom `search_all_dirs` tool searches across the primary cwd and all added directories when the model calls it.
- **Session-persistent.** Added directories are stored as `custom` entries in the session JSONL and restored on resume, fork, or branch navigation.

## Installation

```bash
# Local development
pi -e ./src/index.ts

# From a local path
pi install /path/to/pi-add-dir

# From git (once published)
pi install git:github.com/your-org/pi-add-dir

# From npm (once published)
pi install npm:pi-add-dir
```

## Usage

### Manage working directories

```
/add-dir /path/to/shared-lib     # Add a directory
/add-dir ../sibling-project      # Relative paths are resolved to absolute
/add-dir                         # Prompt for a path interactively

/remove-dir /path/to/shared-lib  # Remove a directory
/remove-dir                      # Select a directory to remove interactively

/list-dirs                       # Show current working context
```

### Search across all directories

Once added, the model can use the `search_all_dirs` tool to search the primary cwd and all added directories:

```
search_all_dirs({ pattern: "useEffect", glob: "*.tsx" })
```

Returns absolute paths so the model can then `read` or `edit` them directly.

## How It Works

1. **State** — An in-memory `addedDirs: string[]` is managed by the extension.
2. **Persistence** — Every add/remove writes a `custom` entry to the session via `pi.appendEntry("add-dir", { addedDirs })`.
3. **Restoration** — On `session_start`, the extension walks `sessionManager.getBranch()` and reconstructs `addedDirs` from the latest matching `custom` entry.
4. **System prompt** — On each agent turn, a "Working context" section is appended to the system prompt listing the primary cwd and added directories, along with guidance to use absolute paths.
5. **Search** — The `search_all_dirs` tool invokes `ripgrep` separately in each root, merges results, deduplicates, and returns absolute paths.

## Non-Goals

- This package does **not** rewrite paths in built-in tools. Relative paths still resolve to the primary cwd.
- This package does **not** load `AGENTS.md`, `.pi/skills`, or other resources from added directories.
- This package does **not** modify pi's `@` file autocomplete to include added directories.

## Requirements

- pi >= 0.79.0
- `ripgrep` on PATH (for `search_all_dirs`)
