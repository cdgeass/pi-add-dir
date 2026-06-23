## ADDED Requirements

### Requirement: Add directory command
The package SHALL provide a `/add-dir <path>` command that adds an existing directory to the session's working-context.

#### Scenario: Add an absolute directory path
- **WHEN** the user invokes `/add-dir /home/me/shared-lib`
- **THEN** the package validates that `/home/me/shared-lib` exists and is a directory
- **AND** it adds the canonical absolute path to the in-memory added-directories list
- **AND** it persists the updated list to the session
- **AND** it notifies the user of success

#### Scenario: Add a relative directory path
- **WHEN** the user invokes `/add-dir ../shared-lib`
- **THEN** the package resolves the path relative to the current working directory
- **AND** it validates that the resolved path exists and is a directory
- **AND** it adds the canonical absolute path to the in-memory list and persists it

#### Scenario: Reject adding a non-directory
- **WHEN** the user invokes `/add-dir /home/me/file.txt`
- **THEN** the package rejects the command and notifies the user that the path is not a directory

#### Scenario: Reject adding a path already in the working-context
- **WHEN** the user invokes `/add-dir` with a path that is identical to the cwd or already in the added-directories list
- **THEN** the package does not create a duplicate entry
- **AND** it notifies the user that the directory is already in the working-context

### Requirement: Remove directory command
The package SHALL provide a `/remove-dir [path]` command that removes a directory from the added-directories list.

#### Scenario: Remove by exact path
- **WHEN** the user invokes `/remove-dir /home/me/shared-lib`
- **THEN** the package removes that path from the added-directories list
- **AND** it persists the updated list to the session
- **AND** it notifies the user of success

#### Scenario: Remove interactively
- **WHEN** the user invokes `/remove-dir` without arguments and the added-directories list is not empty
- **THEN** the package presents a selector with the current added directories
- **AND** when the user selects one, it removes the selection, persists, and notifies

#### Scenario: Remove with empty list
- **WHEN** the user invokes `/remove-dir` without arguments and the added-directories list is empty
- **THEN** the package notifies the user that there are no added directories to remove

### Requirement: List directories command
The package SHALL provide a `/list-dirs` command that displays the session's working-context.

#### Scenario: Show working-context
- **WHEN** the user invokes `/list-dirs`
- **THEN** the package displays the primary cwd and every directory in the added-directories list

