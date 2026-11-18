import type { PluginManifest, ServerPluginDefinition } from "@argus/sdk/server";
import manifestJson from "../argus.plugin.json" with { type: "json" };

const manifest = manifestJson as PluginManifest;

export const plugin: ServerPluginDefinition = {
  manifest,
  /**
   * TODO(implementation): activate this integration using only its declared scoped capabilities.
   * Input: tenant-scoped API, redacted logger, grants, and cancellation supplied by the host.
   * Output: lifecycle hooks for activation, suspension, revocation, and exactly-once cleanup.
   * Errors: throws safe setup errors without exposing credentials or untrusted feed payloads.
   * Depends on: host plugin runtime and an explicitly granted feed/destination configuration.
   */
  async activate(_context) {
    throw new Error("TODO(implementation): activate plugin");
  },
};
