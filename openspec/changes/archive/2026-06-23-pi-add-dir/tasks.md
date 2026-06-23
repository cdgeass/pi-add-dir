## 1. Package scaffolding

- [x] 1.1 Create `package.json` with `pi-package` keyword, `pi.extensions` manifest, and `@earendil-works/pi-coding-agent` peer dependency
- [x] 1.2 Create `tsconfig.json` for TypeScript extension development
- [x] 1.3 Create `src/index.ts` as the extension entry point
- [x] 1.4 Add a `README.md` with installation and usage instructions

## 2. Added-directories state management

- [x] 2.1 Implement in-memory `addedDirs: string[]` store scoped to the extension instance
- [x] 2.2 Implement `resolveAndValidateDir(path, cwd)` that expands tilde, resolves relative paths, and verifies the result is a directory
- [x] 2.3 Implement `dedupeAddedDirs(dirs)` using canonical absolute paths
- [x] 2.4 Implement `persistAddedDirs()` using `pi.appendEntry("add-dir", { addedDirs })`
- [x] 2.5 Implement `restoreAddedDirs(sessionManager)` that walks `getBranch()` and applies the latest `customType: "add-dir"` entry

## 3. Slash commands

- [x] 3.1 Register `/add-dir` command with optional path argument; validate and persist
- [x] 3.2 Register `/add-dir` interactive flow that prompts for a path when no argument is provided
- [x] 3.3 Register `/remove-dir` command with optional path argument
- [x] 3.4 Register `/remove-dir` interactive selector when no argument is provided
- [x] 3.5 Register `/list-dirs` command that displays the primary cwd and added directories
- [x] 3.6 Handle edge cases: non-directory path, duplicate add, empty remove list, missing restored directories

## 4. Session lifecycle integration

- [x] 4.1 Hook `session_start` to restore added directories from the current branch
- [x] 4.2 Hook `session_shutdown` to clear any transient UI status
- [x] 4.3 Verify restoration works after `/resume`, `/fork`, `/clone`, and `/tree` navigation
  - Open pi in a directory, add a dir, send a message, verify resume restores it
  - Test that `/tree` to a branch before add-dir clears the list
- [x] 4.4 Warn the user once for any restored directory that no longer exists

## 5. System prompt injection

- [x] 5.1 Hook `before_agent_start` to append a working-context section when `addedDirs` is non-empty
- [x] 5.2 Format the section with primary cwd, added directories, and usage guidance
- [x] 5.3 Ensure the section updates immediately after `/add-dir` or `/remove-dir`

## 6. `search_all_dirs` custom tool

- [x] 6.1 Define tool schema with `pattern`, optional `glob`, `output_mode`, and `head_limit`
- [x] 6.2 Implement per-directory ripgrep invocation for `files_with_matches` and `content` modes
- [x] 6.3 Merge results across the primary cwd and all added directories
- [x] 6.4 Deduplicate file paths and apply `head_limit`
- [x] 6.5 Return absolute paths and include truncation notice when results are capped
- [x] 6.6 Add `promptSnippet` and `promptGuidelines` so the model knows when to use the tool

## 7. Testing and validation

- [x] 7.1 Test `/add-dir`, `/remove-dir`, and `/list-dirs` in interactive TUI mode
  - `pi -e ./src/index.ts` then run each command
  - Test with absolute path, relative path, interactive mode
- [x] 7.2 Test session persistence by restarting pi and resuming the session
  - Add a dir, exit pi, restart with `pi -c`, verify `/list-dirs` shows it
- [x] 7.3 Test branch navigation with `/tree` to verify branch-aware restoration
  - Add a dir, fork a session, verify the new session carries the state
- [x] 7.4 Test `search_all_dirs` across multiple directories with overlapping file names
  - Add a dir with overlapping filenames, verify tool returns absolute paths
- [x] 7.5 Verify no implicit path rewriting occurs for built-in `read`/`write`/`edit`/`bash` tools
  - Try `read relative-file.tsx` after adding a dir that also has that file
  - Confirm it reads from cwd, not the added dir

## 8. Packaging and documentation

- [x] 8.1 Add a simple example session to the README
- [x] 8.2 Document the decision not to rewrite built-in tool paths
- [x] 8.3 Ensure the package can be loaded with `pi -e ./src/index.ts` for local testing
- [x] 8.4 Prepare the package for npm or git publishing
