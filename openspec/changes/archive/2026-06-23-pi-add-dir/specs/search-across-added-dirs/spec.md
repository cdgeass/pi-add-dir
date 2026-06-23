## ADDED Requirements

### Requirement: Provide a cross-directory search tool
The package SHALL register a custom tool named `search_all_dirs` that searches across the primary cwd and every directory in the added-directories list.

#### Scenario: Search all working directories
- **WHEN** the model invokes `search_all_dirs` with a `pattern`
- **THEN** the package runs a content search (ripgrep) in the primary cwd and each added directory
- **AND** it merges results from all directories
- **AND** it removes duplicate file paths
- **AND** it returns the results to the model

#### Scenario: Search with glob filter
- **WHEN** the model invokes `search_all_dirs` with `pattern` and `glob`
- **THEN** the package applies the glob filter to every searched directory
- **AND** it returns only matching files

### Requirement: Return absolute paths
The tool SHALL return file paths as absolute paths so the model can read them unambiguously.

#### Scenario: Result from primary cwd
- **WHEN** a match is found under the primary cwd
- **THEN** the tool returns the absolute path of the matching file

#### Scenario: Result from added directory
- **WHEN** a match is found under an added directory
- **THEN** the tool returns the absolute path of the matching file

### Requirement: Support common search output modes
The tool SHALL support at least `files_with_matches` and `content` output modes.

#### Scenario: Files-with-matches mode
- **WHEN** the model invokes `search_all_dirs` with `output_mode: "files_with_matches"`
- **THEN** the tool returns a list of absolute file paths that contain matches

#### Scenario: Content mode
- **WHEN** the model invokes `search_all_dirs` with `output_mode: "content"`
- **THEN** the tool returns matching lines with absolute file paths and line numbers

### Requirement: Limit result size
The tool SHALL cap the number of returned results to avoid flooding the context window.

#### Scenario: Too many matches
- **WHEN** a search returns more matches than the configured limit
- **THEN** the tool returns the top results up to the limit
- **AND** it includes a message indicating that results were truncated
