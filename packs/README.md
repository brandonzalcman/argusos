# Starter board-pack placeholders

This directory contains the nine `.argus.json` placeholders named in product plan section 6.5:

1. Significant Events Log
2. Resource Requests
3. Task Tracker
4. Situation Report
5. Shelter / Evacuation Centre Status
6. Contacts and Call Lists
7. Damage Assessment
8. Position Log / Shift Handover
9. Asset and Vehicle Tracking

**None is importable or operational.** Every file has `status: "scaffold-not-importable"`, version `0.0.0`, and intentionally empty `tables`, `boards`, `workflows` and `menus` arrays. Capability names describe future import prerequisites; they are not granted or implemented features. All pack dependency arrays are empty because no install-ready relationships have been designed or validated.

The files contain manifest metadata only. They deliberately omit operational table fields, approval logic, report templates, personal-data schemas, map feeds and workflow definitions. Do not replace the placeholders with plausible but untested incident boards.

## Manifest status

- `format: "argus.board-pack"` identifies the intended file family.
- `schemaVersion: "1.0.0-draft"` identifies an unpublished manifest dialect, not a released compatibility guarantee.
- `version` is the placeholder pack's semantic version.
- `dependencies` will later declare stable pack IDs, semver ranges and integrity metadata.
- `requiredCapabilities` and `optionalCapabilities` express future compatibility checks.
- `definitions` reserves the product-plan definition groups and remains empty.

`pack-validation.test.ts` contains TODO-only tests for future validation/import behavior. It is not a separate workspace package and does not execute a validator. No pack schema or importer is claimed by this task.

## Implementation order

1. Define and version the pack manifest and safe-IO schemas in `@argus/schema`.
2. Implement format/schema/semver/dependency/capability validation and artifact digests.
3. Define stable definition IDs, dependency references, publish compatibility and migration planning.
4. Implement tenant-authorized install preview, RLS-safe atomic import, audit and rollback as a new version.
5. Add malicious/invalid archive and manifest tests, including executable-content and resource-limit cases.
6. Build and verify one pack at a time from an implemented operational vertical slice.
7. Only after validation and tests pass, replace `scaffold-not-importable` with an explicitly supported import state.

Do not add a registry, signing claim or real operational definitions until those systems and review processes exist.
