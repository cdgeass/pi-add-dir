import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { homedir } from "node:os";
import { isAbsolute, resolve, normalize, dirname, basename, join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";

const CUSTOM_TYPE = "add-dir";

interface AddDirState {
  addedDirs: string[];
}

function expandPath(input: string, cwd: string): string {
  const trimmed = input.trim();
  if (!trimmed) return normalize(cwd);
  if (trimmed === "~") return normalize(homedir());
  if (trimmed.startsWith("~/")) {
    return normalize(resolve(homedir(), trimmed.slice(2)));
  }
  if (isAbsolute(trimmed)) {
    return normalize(trimmed);
  }
  return normalize(resolve(cwd, trimmed));
}

async function resolveAndValidateDir(
  path: string,
  cwd: string
): Promise<{ ok: true; absolutePath: string } | { ok: false; message: string }> {
  const absolutePath = expandPath(path, cwd);
  try {
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      return { ok: false, message: `${absolutePath} is not a directory.` };
    }
    return { ok: true, absolutePath };
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { ok: false, message: `Directory not found: ${absolutePath}` };
    }
    if (code === "EACCES" || code === "EPERM") {
      return { ok: false, message: `Permission denied: ${absolutePath}` };
    }
    return { ok: false, message: `Could not access ${absolutePath}: ${String(e)}` };
  }
}

function dedupeAddedDirs(dirs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const d of dirs) {
    const normalized = normalize(d);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function formatWorkingContext(cwd: string, addedDirs: string[]): string {
  const lines = [
    "## Working context",
    "",
    `Primary working directory: ${cwd}`,
  ];
  if (addedDirs.length > 0) {
    lines.push("", "Additional working directories:");
    for (const d of addedDirs) {
      lines.push(`- ${d}`);
    }
  }
  lines.push(
    "",
    "Files outside the primary working directory must be referenced with absolute paths or paths that resolve correctly from the primary cwd.",
    "To search across all working directories, use the search_all_dirs tool."
  );
  return lines.join("\n");
}

function getDirectoryCompletions(input: string): Array<{ value: string; label: string }> | null {
  const trimmed = input.trim();

  // Determine the directory to list and the partial name to filter
  let listDir: string;
  let partial: string;
  const lastSlash = trimmed.lastIndexOf("/");

  if (!trimmed) {
    // No input yet — show cwd subdirectories
    listDir = ".";
    partial = "";
  } else if (lastSlash >= 0) {
    const dirPart = trimmed.slice(0, lastSlash + 1);
    partial = trimmed.slice(lastSlash + 1);
    if (dirPart.startsWith("~")) {
      listDir = join(homedir(), dirPart.slice(1) || ".");
    } else if (isAbsolute(dirPart)) {
      listDir = dirPart;
    } else {
      listDir = dirPart || ".";
    }
  } else {
    // No slash — list cwd
    listDir = ".";
    partial = trimmed;
  }

  let entries: string[];
  try {
    entries = readdirSync(listDir);
  } catch {
    return null;
  }

  const items: Array<{ value: string; label: string }> = [];
  for (const entry of entries) {
    if (partial && !entry.toLowerCase().startsWith(partial.toLowerCase())) continue;
    if (entry.startsWith(".") && !partial.startsWith(".")) continue;

    const fullPath = join(listDir, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    // Build the completion value as a relative path from where the user started typing
    let completionPath: string;
    if (lastSlash >= 0) {
      const prefix = trimmed.slice(0, lastSlash + 1);
      completionPath = prefix + entry + "/";
    } else {
      completionPath = entry + "/";
    }
    items.push({ value: completionPath, label: completionPath });
  }

  return items.length > 0 ? items.slice(0, 50) : null;
}

function runRipgrep(
  cwd: string,
  pattern: string,
  options: {
    glob?: string;
    outputMode: "files_with_matches" | "content" | "count";
  },
  signal?: AbortSignal
): Promise<{ lines: string[]; cancelled: boolean }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ["--hidden", "--max-columns", "500"];

    if (options.outputMode === "files_with_matches") {
      args.push("-l");
    } else if (options.outputMode === "count") {
      args.push("-c");
    } else {
      args.push("-n");
    }

    if (options.glob) {
      for (const g of options.glob.split(/[,\s]+/).filter(Boolean)) {
        args.push("--glob", g);
      }
    }

    if (pattern.startsWith("-")) {
      args.push("-e", pattern);
    } else {
      args.push(pattern);
    }

    args.push(cwd);

    const child = spawn("rg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let cancelled = false;

    const cleanup = () => {
      if (!child.killed) {
        child.kill();
      }
    };

    signal?.addEventListener("abort", cleanup, { once: true });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", cleanup);
      rejectPromise(err);
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", cleanup);
      if (signal?.aborted) {
        cancelled = true;
      }
      if (code === 0 || code === 1) {
        // ripgrep returns 1 when no matches found
        const lines = stdout
          .split("\n")
          .map((l) => l.trimEnd())
          .filter((l) => l.length > 0);
        resolvePromise({ lines, cancelled });
      } else {
        const errMsg = stderr.trim() || `ripgrep exited with code ${code}`;
        rejectPromise(new Error(errMsg));
      }
    });
  });
}

function parseContentLine(line: string): { filePath: string; rest: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) return null;
  const filePath = line.slice(0, colonIndex);
  const rest = line.slice(colonIndex);
  return { filePath, rest };
}

function mergeSearchResults(
  results: { cwd: string; lines: string[]; outputMode: "files_with_matches" | "content" | "count" }[],
  headLimit: number
): { content: string; truncated: boolean } {
  if (results.length === 0) {
    return { content: "No working directories to search.", truncated: false };
  }

  const outputMode = results[0].outputMode;
  const allLines: string[] = [];

  if (outputMode === "files_with_matches") {
    const seen = new Set<string>();
    for (const r of results) {
      for (const line of r.lines) {
        const absolutePath = isAbsolute(line) ? line : resolve(r.cwd, line);
        if (!seen.has(absolutePath)) {
          seen.add(absolutePath);
          allLines.push(absolutePath);
        }
      }
    }
  } else if (outputMode === "count") {
    const counts = new Map<string, number>();
    for (const r of results) {
      for (const line of r.lines) {
        const lastColon = line.lastIndexOf(":");
        if (lastColon <= 0) continue;
        const filePath = line.slice(0, lastColon);
        const countStr = line.slice(lastColon + 1);
        const count = parseInt(countStr, 10);
        if (Number.isNaN(count)) continue;
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(r.cwd, filePath);
        counts.set(absolutePath, (counts.get(absolutePath) ?? 0) + count);
      }
    }
    for (const [path, count] of counts) {
      allLines.push(`${path}:${count}`);
    }
  } else {
    // content mode
    for (const r of results) {
      for (const line of r.lines) {
        const parsed = parseContentLine(line);
        if (!parsed) {
          allLines.push(line);
          continue;
        }
        const absolutePath = isAbsolute(parsed.filePath)
          ? parsed.filePath
          : resolve(r.cwd, parsed.filePath);
        allLines.push(`${absolutePath}${parsed.rest}`);
      }
    }
  }

  const effectiveLimit = headLimit > 0 ? headLimit : 250;
  const truncated = allLines.length > effectiveLimit;
  const limitedLines = allLines.slice(0, effectiveLimit);

  if (outputMode === "files_with_matches") {
    const count = limitedLines.length;
    const header = `Found ${count} file${count === 1 ? "" : "s"}:`;
    return {
      content: [header, "", ...limitedLines].join("\n"),
      truncated,
    };
  }

  if (truncated) {
    limitedLines.push(`\n[Results truncated to ${effectiveLimit} lines. Use a smaller scope or lower head_limit to reduce matches.]`);
  }

  return { content: limitedLines.join("\n"), truncated };
}

export default function addDirExtension(pi: ExtensionAPI) {
  let addedDirs: string[] = [];
  let warnedMissingDirs = new Set<string>();

  const persistAddedDirs = () => {
    pi.appendEntry(CUSTOM_TYPE, { addedDirs } as AddDirState);
  };

  const restoreAddedDirs = (ctx: ExtensionContext) => {
    const branch = ctx.sessionManager.getBranch();
    const stateEntries = branch.filter(
      (entry): entry is typeof entry & { type: "custom"; customType: string; data: AddDirState } =>
        entry.type === "custom" &&
        "customType" in entry &&
        entry.customType === CUSTOM_TYPE &&
        "data" in entry &&
        entry.data != null &&
        typeof entry.data === "object" &&
        "addedDirs" in entry.data &&
        Array.isArray((entry.data as AddDirState).addedDirs)
    );
    if (stateEntries.length > 0) {
      const latest = stateEntries[stateEntries.length - 1];
      addedDirs = dedupeAddedDirs(latest.data.addedDirs);
    } else {
      addedDirs = [];
    }
    warnedMissingDirs = new Set();
  };

  const warnMissingRestoredDirs = async (ctx: ExtensionContext) => {
    for (const d of addedDirs) {
      if (warnedMissingDirs.has(d)) continue;
      try {
        const stats = await stat(d);
        if (!stats.isDirectory()) {
          warnedMissingDirs.add(d);
          ctx.ui.notify(`Added directory no longer exists or is not a directory: ${d}`, "warning");
        }
      } catch {
        warnedMissingDirs.add(d);
        ctx.ui.notify(`Added directory no longer accessible: ${d}`, "warning");
      }
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    restoreAddedDirs(ctx);
    await warnMissingRestoredDirs(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setStatus("add-dir", undefined);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    if (addedDirs.length === 0) return;
    const section = formatWorkingContext(ctx.cwd, addedDirs);
    return { systemPrompt: _event.systemPrompt + "\n\n" + section };
  });

  pi.registerCommand("add-dir", {
    description: "Add a directory to the session working context",
    getArgumentCompletions: (prefix: string) => {
      return getDirectoryCompletions(prefix);
    },
    handler: async (args, ctx) => {
      const rawPath = args?.trim();
      let pathToAdd = rawPath;

      if (!pathToAdd) {
        if (!ctx.hasUI) {
          ctx.ui.notify("Usage: /add-dir <path>", "warning");
          return;
        }
        const input = await ctx.ui.input("Add directory:", "path/to/dir");
        if (!input) {
          ctx.ui.notify("No directory added.", "info");
          return;
        }
        pathToAdd = input;
      }

      const result = await resolveAndValidateDir(pathToAdd, ctx.cwd);
      if (!result.ok) {
        ctx.ui.notify(result.message, "error");
        return;
      }

      const cwdNormalized = normalize(ctx.cwd);
      if (result.absolutePath === cwdNormalized) {
        ctx.ui.notify(`${result.absolutePath} is already the primary working directory.`, "info");
        return;
      }

      if (addedDirs.includes(result.absolutePath)) {
        ctx.ui.notify(`${result.absolutePath} is already in the working context.`, "info");
        return;
      }

      addedDirs = dedupeAddedDirs([...addedDirs, result.absolutePath]);
      persistAddedDirs();
      ctx.ui.notify(`Added ${result.absolutePath} to working context.`, "info");
    },
  });

  pi.registerCommand("remove-dir", {
    description: "Remove a directory from the session working context",
    getArgumentCompletions: (prefix: string) => {
      let target = prefix;
      if (!target) return addedDirs.map((d) => ({ value: d, label: d }));
      return addedDirs
        .filter((d) => d.includes(target))
        .map((d) => ({ value: d, label: d }));
    },
    handler: async (args, ctx) => {
      if (addedDirs.length === 0) {
        ctx.ui.notify("No additional directories to remove.", "info");
        return;
      }

      let target = args?.trim();
      if (!target) {
        if (!ctx.hasUI) {
          ctx.ui.notify("Usage: /remove-dir <path>", "warning");
          return;
        }
        const selected = await ctx.ui.select("Remove directory:", addedDirs);
        if (!selected) {
          ctx.ui.notify("No directory removed.", "info");
          return;
        }
        target = selected;
      }

      const absoluteTarget = expandPath(target, ctx.cwd);
      const normalizedTarget = normalize(absoluteTarget);
      if (!addedDirs.includes(normalizedTarget)) {
        ctx.ui.notify(`${normalizedTarget} is not in the working context.`, "warning");
        return;
      }

      addedDirs = addedDirs.filter((d) => d !== normalizedTarget);
      persistAddedDirs();
      ctx.ui.notify(`Removed ${normalizedTarget} from working context.`, "info");
    },
  });

  pi.registerCommand("list-dirs", {
    description: "List the session working context directories",
    handler: async (_args, ctx) => {
      const lines = [
        "Working context:",
        `  (cwd) ${ctx.cwd}`,
        ...addedDirs.map((d) => `  (added) ${d}`),
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerTool({
    name: "search_all_dirs",
    label: "Search all working directories",
    description:
      "Search file contents across the primary cwd and all directories added via /add-dir. Returns absolute file paths. Use this when you need to find files that might live in any of the session's working directories.",
    promptSnippet: "Search across all working directories (cwd + added dirs)",
    promptGuidelines: [
      "Use search_all_dirs when the file you need could be in the primary cwd or any directory added with /add-dir.",
      "Use absolute paths returned by search_all_dirs for subsequent read or edit calls.",
    ],
    parameters: Type.Object({
      pattern: Type.String({
        description: "Regular expression pattern to search for in file contents",
      }),
      glob: Type.Optional(
        Type.String({
          description: "Glob pattern to filter files, e.g. '*.ts' or '*.{ts,tsx}'",
        })
      ),
      output_mode: Type.Optional(
        StringEnum(["files_with_matches", "content", "count"] as const, {
          description: '"files_with_matches" returns paths; "content" returns matching lines with line numbers; "count" returns per-file match counts.',
        })
      ),
      head_limit: Type.Optional(
        Type.Number({
          description: "Maximum number of result lines/files to return (default 250, 0 for unlimited)",
        })
      ),
    }),
    async execute(_toolCallId, input, signal, _onUpdate, ctx) {
      const outputMode = input.output_mode ?? "files_with_matches";
      const headLimit = input.head_limit ?? 250;
      const roots = [ctx.cwd, ...addedDirs];

      const results = await Promise.all(
        roots.map(async (cwd) => {
          try {
            const { lines } = await runRipgrep(
              cwd,
              input.pattern,
              { glob: input.glob, outputMode },
              signal
            );
            return { cwd, lines, outputMode };
          } catch (err) {
            // If a root is missing or rg fails for one root, skip it but include a note
            const message = err instanceof Error ? err.message : String(err);
            return { cwd, lines: [`[Error searching ${cwd}: ${message}]`], outputMode };
          }
        })
      );

      const { content, truncated } = mergeSearchResults(results, headLimit);
      return {
        content: [
          { type: "text", text: content + (truncated ? "" : "") },
        ],
        details: { truncated },
      };
    },
  });
}
