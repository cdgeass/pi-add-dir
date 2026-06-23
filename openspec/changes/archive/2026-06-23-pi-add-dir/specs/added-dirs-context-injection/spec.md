## ADDED Requirements

### Requirement: Declare working-context in system prompt
The package SHALL append a section to the system prompt on every agent turn that lists the primary cwd and all added directories.

#### Scenario: Added directories exist
- **WHEN** the agent is about to start a turn and the added-directories list is non-empty
- **THEN** the package appends a section to the system prompt containing:
  - the primary cwd labeled as the primary working directory
  - every added directory as an additional working directory
  - guidance that files outside the primary cwd must be referenced with absolute paths or correct relative paths
  - a note that the `search_all_dirs` tool can search across all working directories

#### Scenario: No added directories
- **WHEN** the agent is about to start a turn and the added-directories list is empty
- **THEN** the package does not modify the system prompt

### Requirement: Avoid duplicate or stale declarations
The package SHALL ensure the injected section reflects the current in-memory added-directories list.

#### Scenario: Directory removed mid-session
- **WHEN** the user removes an added directory and then starts a new agent turn
- **THEN** the injected system prompt no longer lists the removed directory

#### Scenario: Multiple turns
- **WHEN** the user starts several agent turns in the same session
- **THEN** each turn receives a fresh working-context section based on the latest list
