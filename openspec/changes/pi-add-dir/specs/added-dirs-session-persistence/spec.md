## ADDED Requirements

### Requirement: Persist added directories in session
The package SHALL store the current added-directories list as a custom entry in the pi session whenever the list changes.

#### Scenario: Add triggers persistence
- **WHEN** the user successfully adds a directory via `/add-dir`
- **THEN** the package appends a `custom` session entry with `customType: "add-dir"` containing the full updated list

#### Scenario: Remove triggers persistence
- **WHEN** the user successfully removes a directory via `/remove-dir`
- **THEN** the package appends a `custom` session entry with `customType: "add-dir"` containing the full updated list

### Requirement: Restore added directories on session start
The package SHALL reconstruct the added-directories list from the session when a session starts or resumes.

#### Scenario: Startup restoration
- **WHEN** pi emits a `session_start` event
- **THEN** the package walks the current branch of session entries
- **AND** it finds every `custom` entry with `customType: "add-dir"`
- **AND** it applies the most recent entry's data to the in-memory added-directories list

#### Scenario: Branch-aware restoration
- **WHEN** the user navigates to an earlier branch point via `/tree`
- **THEN** the package reconstructs the added-directories list from the entries on the new active branch
- **AND** the list reflects the state that existed at that point in the branch history

### Requirement: Validate restored directories
The package SHALL tolerate missing or invalid directories when restoring state.

#### Scenario: Restored directory no longer exists
- **WHEN** the package restores an added directory that has been deleted or is no longer accessible
- **THEN** it keeps the path in the list
- **AND** it warns the user once per missing directory
- **AND** it does not crash

#### Scenario: Empty restored list
- **WHEN** the package restores state and finds no `add-dir` custom entries
- **THEN** it initializes the added-directories list as empty
