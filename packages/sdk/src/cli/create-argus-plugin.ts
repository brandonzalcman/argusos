#!/usr/bin/env node

export interface CreatePluginCliOptions {
  readonly directory: string;
  readonly pluginName: string;
  readonly template: "default";
  readonly force: boolean;
}

export interface CreatePluginCliIo {
  readonly cwd: string;
  readonly stdout: Pick<typeof process.stdout, "write">;
  readonly stderr: Pick<typeof process.stderr, "write">;
}

/**
 * TODO(implementation): parse arguments, safely instantiate the default template, and print next steps.
 * Input: CLI arguments, destination directory, and injectable terminal streams for tests.
 * Output: a validated plugin scaffold without installing dependencies, running code, or mutating git.
 * Errors: rejects invalid package IDs, path traversal, existing files without force, and unsafe templates.
 * Depends on: Node filesystem/path APIs, packaged templates/default, and manifest/package-name validators.
 * Security: writes only beneath the selected destination, never follows template symlinks, and creates no secrets.
 */
export function main(_arguments: readonly string[], _io: CreatePluginCliIo): Promise<void> {
  throw new Error("TODO(implementation): createArgusPluginCli");
}

await main(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});
