/**
 * Demo mode swaps every disconnected port for in-memory adapters filled with fictional data so the
 * UI can be reviewed before the API, Electric and auth exist. It is opt-in only:
 * `pnpm --filter @argus/web dev:demo` (sets VITE_ARGUS_DEMO=true via `.env.demo`).
 * Demo data is never fetched from or written to a server and the shell shows a permanent banner.
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_ARGUS_DEMO === "true";
}
