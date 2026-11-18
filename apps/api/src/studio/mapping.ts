import {
  type StudioDefinitionKind,
  type StudioDefinitionSummary,
  type StudioDocument,
  type StudioItemPermissions,
  studioDocumentSchema,
  type ViewAccessPolicy,
} from "@argus/schema";
import { z } from "zod";
import { apiError } from "../errors.js";
import type { studioDefinitions, studioDefinitionVersions } from "../persistence/system-schema.js";

export type DefinitionRow = typeof studioDefinitions.$inferSelect;
export type VersionRow = typeof studioDefinitionVersions.$inferSelect;

/** Server-owned revision metadata (Decision 5): never taken from client documents. */
export interface VersionMetadata {
  readonly version: number;
  readonly lifecycle: "draft" | "published" | "archived";
  readonly changeSummary: string | null;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly createdPositionId: string;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
}

export function metadataOf(row: VersionRow): VersionMetadata {
  return {
    version: row.version,
    lifecycle: row.lifecycle,
    changeSummary: row.changeSummary,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    createdPositionId: row.createdPositionId,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
  };
}

function metadataFields(definitionId: string, tenantId: string, meta: VersionMetadata) {
  return {
    id: definitionId,
    tenantId,
    version: meta.version,
    lifecycle: meta.lifecycle,
    changeSummary: meta.changeSummary,
    createdAt: meta.createdAt.toISOString(),
    createdBy: meta.createdBy,
    createdPositionId: meta.createdPositionId,
    publishedAt: meta.publishedAt === null ? null : meta.publishedAt.toISOString(),
    publishedBy: meta.publishedBy,
  };
}

export interface StampTarget {
  readonly definitionId: string;
  readonly tenantId: string;
  /** Stable layout id for boards; null keeps the document's own layout id. */
  readonly layoutId: string | null;
}

/**
 * Overwrite every server-owned metadata field of a document: identity, tenant, revision, lifecycle,
 * audit stamps and, for boards, `layout.boardId` / `definition.layoutId`. Used on write and on read
 * so client-supplied values never survive.
 */
export function stampDocument(
  document: StudioDocument,
  target: StampTarget,
  meta: VersionMetadata,
): StudioDocument {
  const base = metadataFields(target.definitionId, target.tenantId, meta);
  switch (document.kind) {
    case "page":
      return { kind: "page", definition: { ...document.definition, ...base } };
    case "component":
      return { kind: "component", definition: { ...document.definition, ...base } };
    case "board": {
      const layoutId = target.layoutId ?? document.bundle.layout.id;
      return {
        kind: "board",
        bundle: {
          definition: { ...document.bundle.definition, ...base, layoutId },
          layout: {
            ...document.bundle.layout,
            ...base,
            id: layoutId,
            boardId: target.definitionId,
          },
        },
      };
    }
  }
}

/** Re-parse a stored document; a failure means catalog drift and surfaces as an internal error. */
export function parseStoredDocument(value: unknown): StudioDocument {
  const parsed = studioDocumentSchema.safeParse(value);
  if (!parsed.success) {
    throw apiError("internal", "A stored definition could not be read.");
  }
  return parsed.data;
}

export function accessOf(document: StudioDocument): ViewAccessPolicy | null {
  switch (document.kind) {
    case "board":
      return document.bundle.definition.access;
    case "page":
      return document.definition.access;
    case "component":
      return null;
  }
}

export function slugFromKey(key: string): string {
  return key.replace(/_+/g, "-").replace(/-+$/, "");
}

/** Catalog columns mirrored from a document. */
export function catalogFieldsOf(document: StudioDocument): {
  key: string;
  name: string;
  description: string | null;
  slug: string | null;
} {
  switch (document.kind) {
    case "board": {
      const d = document.bundle.definition;
      return { key: d.key, name: d.name, description: d.description, slug: null };
    }
    case "page": {
      const d = document.definition;
      return { key: d.key, name: d.title, description: d.description, slug: d.slug };
    }
    case "component": {
      const d = document.definition;
      return { key: d.key, name: d.name, description: d.description, slug: null };
    }
  }
}

export function toSummary(
  row: DefinitionRow,
  publishedAt: Date | null,
  permissions: StudioItemPermissions,
): StudioDefinitionSummary {
  return {
    id: row.id,
    kind: row.kind,
    key: row.key,
    name: row.name,
    description: row.description,
    slug: row.kind === "page" ? row.slug : null,
    publishedVersion: row.publishedVersion,
    draftVersion: row.draftVersion,
    hasUnpublishedChanges: row.draftVersion !== null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    publishedAt: publishedAt === null ? null : publishedAt.toISOString(),
    permissions,
  };
}

export function currentVersionOf(row: DefinitionRow): number | null {
  return row.draftVersion ?? row.publishedVersion;
}

/** Opaque keyset cursor over `(updated_at, id)`. */
export function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([updatedAt.getTime(), id]), "utf8").toString("base64url");
}

/** Cursor timestamps must be plausible catalog times (2000-01-01 .. 2100-01-01 UTC), in ms. */
const CURSOR_MIN_MS = Date.UTC(2000, 0, 1);
const CURSOR_MAX_MS = Date.UTC(2100, 0, 1);

const cursorSchema = z.tuple([
  z.number().int().min(CURSOR_MIN_MS).max(CURSOR_MAX_MS),
  z.string().uuid(),
]);

export function decodeCursor(cursor: string): { updatedAt: Date; id: string } {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (parsed.success) {
      const updatedAt = new Date(parsed.data[0]);
      if (!Number.isNaN(updatedAt.getTime())) return { updatedAt, id: parsed.data[1] };
    }
  } catch {
    // fall through to the validation error
  }
  throw apiError("validation-failed", "The list cursor is invalid.", {
    fieldErrors: { cursor: ["Invalid cursor."] },
  });
}

/** Escape `%`, `_` and `\` so user text matches literally inside a LIKE pattern. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

interface DbErrorInfo {
  readonly code: string | null;
  readonly constraint: string | null;
}

function dbErrorInfo(error: unknown): DbErrorInfo {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current instanceof Error; depth += 1) {
    const candidate = current as Error & { code?: unknown; constraint?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : null,
      };
    }
    current = current.cause;
  }
  return { code: null, constraint: null };
}

/**
 * Translate catalog unique violations (definition key, page slug) into `validation-failed` with
 * field errors; anything else is returned untouched. Never echoes SQL.
 */
export function translateUniqueViolation(error: unknown, kind: StudioDefinitionKind): unknown {
  const info = dbErrorInfo(error);
  if (info.code !== "23505") return error;
  if (info.constraint === "studio_definitions_page_slug_uq") {
    return apiError("validation-failed", "A page with this slug already exists.", {
      fieldErrors: { slug: ["This slug is already used by another page."] },
    });
  }
  if (info.constraint === "studio_definitions_tenant_kind_key_uq") {
    return apiError("validation-failed", `A ${kind} with this key already exists.`, {
      fieldErrors: { key: ["This key is already used."] },
    });
  }
  return error;
}
