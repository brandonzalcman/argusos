import {
  type DefinitionIssue,
  type SessionSnapshot,
  type StudioApi,
  type StudioCreateInput,
  type StudioDefinitionKind,
  type StudioDefinitionSummary,
  type StudioDocument,
  type StudioGetOutput,
  type StudioItemPermissions,
  type StudioMutationOutput,
  type StudioVersionSummary,
  studioDocumentSchema,
} from "@argus/schema";
import type { SessionPort } from "../../services/studio.js";
import { demoDelay, demoId } from "../scenario.js";
import {
  blankBoard,
  blankComponent,
  blankPage,
  contentKey,
  duplicateDocument,
  fromTable,
  infoOf,
  metaOf,
  placeholderBlockTemplate,
  slugFromKey,
  withMeta,
} from "./documents.js";
import { createSeedHistories } from "./seed.js";
import { createDemoSessionPort } from "./session.js";
import { type ValidationContext, validateDocument } from "./validation.js";

/** One audit record per create, save, publish, rollback and archive (demo-only, in memory). */
export interface DemoAuditEvent {
  readonly id: string;
  readonly action: "create" | "save-draft" | "publish" | "rollback" | "archive";
  readonly kind: StudioDefinitionKind;
  readonly definitionId: string;
  readonly version: number;
  readonly actorUserId: string;
  readonly actorPositionId: string;
  readonly at: string;
}

/** StudioApi plus a read-only audit trail so the demo can show what the real server records. */
export interface DemoStudioPort extends StudioApi {
  readonly auditLog: () => readonly DemoAuditEvent[];
}

export interface DemoStudioPortOptions {
  /** Simulated latency per call; 0 in tests. Default 200 ms. */
  readonly latencyMs?: number;
}

interface StoredDefinition {
  readonly id: string;
  readonly kind: StudioDefinitionKind;
  /** Every version, oldest first. Lifecycle and metadata live inside each document. */
  docs: StudioDocument[];
  updatedAt: string;
  updatedBy: string;
}

const conflict = (expected: number, current: number | null): Error =>
  new Error(
    `definition-version-conflict: expected version ${expected}, current is ${current ?? "none"}`,
  );

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * In-memory StudioApi for demo mode (FICTIONAL data only). Semantics follow the contract in
 * @argus/schema `studio.ts`:
 * - per-definition immutable version history (draft / published / archived);
 * - optimistic versions: mismatches throw an Error starting with "definition-version-conflict";
 * - idempotency keys replay the original result for create, publish, rollback and archive;
 * - permissions come from the session's StudioPermissions; nothing is sent to a server.
 */
export function createDemoStudioPort(
  session: SessionPort = createDemoSessionPort(),
  options: DemoStudioPortOptions = {},
): DemoStudioPort {
  const latency = options.latencyMs ?? 200;
  const definitions = new Map<string, StoredDefinition>();
  const idempotent = new Map<string, StudioMutationOutput>();
  const audit: DemoAuditEvent[] = [];

  for (const docs of createSeedHistories()) {
    const first = docs[0];
    if (!first) continue;
    const meta = metaOf(first);
    const last = docs[docs.length - 1] ?? first;
    definitions.set(meta.id, {
      id: meta.id,
      kind: first.kind,
      docs,
      updatedAt: metaOf(last).publishedAt ?? metaOf(last).createdAt,
      updatedBy: metaOf(last).publishedBy ?? metaOf(last).createdBy,
    });
  }

  // ---- lookups -------------------------------------------------------------------------------

  const lifecycleDoc = (
    definition: StoredDefinition,
    lifecycle: "draft" | "published",
  ): StudioDocument | undefined =>
    definition.docs.find((doc) => metaOf(doc).lifecycle === lifecycle);
  const latestVersion = (definition: StoredDefinition): number =>
    Math.max(...definition.docs.map((doc) => metaOf(doc).version));
  const isLive = (definition: StoredDefinition): boolean =>
    definition.docs.some((doc) => metaOf(doc).lifecycle !== "archived");

  const requireDefinition = (id: string, kind?: StudioDefinitionKind): StoredDefinition => {
    const definition = definitions.get(id);
    if (!definition || (kind && definition.kind !== kind)) {
      throw new Error("not-found: definition does not exist or is not accessible");
    }
    return definition;
  };

  const requireSession = async (): Promise<SessionSnapshot> => {
    const snapshot = await session.get();
    if (!snapshot) throw new Error("unauthenticated: sign in to use dev mode");
    return snapshot;
  };

  const permissionsOf = (snapshot: SessionSnapshot): StudioItemPermissions => ({
    view: snapshot.studio.viewStudio,
    edit: snapshot.studio.viewStudio && snapshot.studio.editDefinitions,
    publish: snapshot.studio.viewStudio && snapshot.studio.publishDefinitions,
    editCode: snapshot.studio.viewStudio && snapshot.studio.editCode,
  });

  const need = (
    snapshot: SessionSnapshot,
    permission: keyof StudioItemPermissions,
    kind?: StudioDefinitionKind,
  ): void => {
    const granted = permissionsOf(snapshot);
    if (!granted[permission]) throw new Error(`forbidden: missing studio ${permission} permission`);
    if (kind === "component" && permission !== "view" && !granted.editCode) {
      throw new Error("forbidden: custom components require the editCode permission");
    }
  };

  const summaryOf = (
    definition: StoredDefinition,
    snapshot: SessionSnapshot,
  ): StudioDefinitionSummary => {
    const draft = lifecycleDoc(definition, "draft");
    const published = lifecycleDoc(definition, "published");
    const current = draft ?? published ?? definition.docs[definition.docs.length - 1];
    if (!current) throw new Error("definition has no versions");
    const info = infoOf(current);
    return {
      id: definition.id,
      kind: definition.kind,
      key: info.key,
      name: info.name,
      description: info.description,
      slug: info.slug,
      publishedVersion: published ? metaOf(published).version : null,
      draftVersion: draft ? metaOf(draft).version : null,
      hasUnpublishedChanges:
        draft !== undefined && (!published || contentKey(draft) !== contentKey(published)),
      updatedAt: definition.updatedAt,
      updatedBy: definition.updatedBy,
      publishedAt: published ? metaOf(published).publishedAt : null,
      permissions: permissionsOf(snapshot),
    };
  };

  const validationContext = (selfId: string | null): ValidationContext => {
    const otherPageSlugs = new Set<string>();
    const boardIds = new Set<string>();
    for (const definition of definitions.values()) {
      if (!isLive(definition)) continue;
      if (definition.kind === "board") boardIds.add(definition.id);
      if (definition.kind === "page" && definition.id !== selfId) {
        for (const doc of definition.docs) {
          const slug = infoOf(doc).slug;
          if (slug && metaOf(doc).lifecycle !== "archived") otherPageSlugs.add(slug);
        }
      }
    }
    return {
      selfId,
      otherPageSlugs,
      boardIds,
      publishedComponentVersions: (componentId) => {
        const definition = definitions.get(componentId);
        if (definition?.kind !== "component") return null;
        return new Set(
          definition.docs
            .filter((doc) => metaOf(doc).publishedAt !== null)
            .map((doc) => metaOf(doc).version),
        );
      },
    };
  };

  const recordAudit = (
    snapshot: SessionSnapshot,
    action: DemoAuditEvent["action"],
    definition: StoredDefinition,
    version: number,
  ): string => {
    const event: DemoAuditEvent = {
      id: demoId(),
      action,
      kind: definition.kind,
      definitionId: definition.id,
      version,
      actorUserId: snapshot.user.id,
      actorPositionId: snapshot.position.id,
      at: nowIso(),
    };
    audit.push(event);
    definition.updatedAt = event.at;
    definition.updatedBy = snapshot.user.id;
    return event.id;
  };

  const replaceDoc = (
    definition: StoredDefinition,
    version: number,
    next: StudioDocument,
  ): void => {
    definition.docs = definition.docs.map((doc) => (metaOf(doc).version === version ? next : doc));
  };

  const assertPublishable = (document: StudioDocument, selfId: string): void => {
    const errors = validateDocument(document, validationContext(selfId)).filter(
      (issue) => issue.severity === "error",
    );
    if (errors.length > 0) {
      const first = errors[0];
      throw new Error(
        `validation-failed: ${errors.length} error(s); first: ${first?.path.join(".")} ${first?.message}`,
      );
    }
  };

  const replay = (operation: string, key: string): StudioMutationOutput | undefined =>
    idempotent.get(`${operation}:${key}`);
  const remember = (
    operation: string,
    key: string,
    output: StudioMutationOutput,
  ): StudioMutationOutput => {
    idempotent.set(`${operation}:${key}`, output);
    return output;
  };

  // ---- create ---------------------------------------------------------------------------------

  const createDocument = (
    input: StudioCreateInput,
    snapshot: SessionSnapshot,
    meta: { createdAt: string; createdBy: string; createdPositionId: string },
  ): StudioDocument => {
    const slugBase = slugFromKey(input.key);
    const slug = uniquePageSlug(slugBase);
    const { template } = input;
    switch (template.type) {
      case "blank":
        if (input.kind === "board") return blankBoard(input.key, input.name, meta);
        if (input.kind === "page") return blankPage(input.key, input.name, slug, meta);
        return blankComponent(input.key, input.name, meta);
      case "from-table":
        if (input.kind === "component") {
          throw new Error("template-invalid: components cannot start from a table");
        }
        return fromTable(input.kind, input.key, input.name, slug, template.tableId, meta);
      case "eject-block":
        if (input.kind !== "component") {
          throw new Error("template-invalid: only components can start from a built-in block");
        }
        return blankComponent(
          input.key,
          input.name,
          meta,
          placeholderBlockTemplate(template.blockType),
          template.blockType,
        );
      case "duplicate": {
        const source = requireDefinition(template.sourceId, input.kind);
        const original =
          lifecycleDoc(source, "published") ??
          lifecycleDoc(source, "draft") ??
          source.docs[source.docs.length - 1];
        if (!original) throw new Error("not-found: nothing to duplicate");
        need(snapshot, "view");
        return duplicateDocument(original, input.key, input.name, slug, meta);
      }
    }
  };

  const uniquePageSlug = (base: string): string => {
    const used = validationContext(null).otherPageSlugs;
    if (!used.has(base)) return base;
    for (let n = 2; ; n += 1) {
      if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
    }
  };

  // ---- the port -------------------------------------------------------------------------------

  return {
    auditLog: () => [...audit],

    async list(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "view");
      const search = input.search?.trim().toLowerCase() ?? "";
      const rows = [...definitions.values()]
        .filter((definition) => definition.kind === input.kind && isLive(definition))
        .map((definition) => summaryOf(definition, snapshot))
        .filter(
          (row) =>
            search === "" ||
            [row.name, row.key, row.slug ?? ""].some((text) => text.toLowerCase().includes(search)),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const start = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
      const items = rows.slice(start, start + input.limit);
      const next = start + input.limit;
      return { items, nextCursor: next < rows.length ? String(next) : null };
    },

    async get(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "view");
      const definition = requireDefinition(input.id, input.kind);
      const document =
        input.revision === "draft"
          ? lifecycleDoc(definition, "draft")
          : input.revision === "published"
            ? lifecycleDoc(definition, "published")
            : definition.docs.find((doc) => metaOf(doc).version === input.revision);
      if (!document) return null;
      return {
        summary: summaryOf(definition, snapshot),
        version: metaOf(document).version,
        document: structuredClone(document),
      } satisfies StudioGetOutput;
    },

    async getPageBySlug(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      for (const definition of definitions.values()) {
        if (definition.kind !== "page") continue;
        const published = lifecycleDoc(definition, "published");
        if (published?.kind !== "page" || published.definition.slug !== input.slug) {
          continue;
        }
        const allowed = published.definition.access.positionIds;
        if (allowed.length > 0 && !allowed.includes(snapshot.position.id)) return null;
        return {
          summary: summaryOf(definition, snapshot),
          version: metaOf(published).version,
          document: structuredClone(published),
        };
      }
      return null;
    },

    async listVersions(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "view");
      const definition = requireDefinition(input.id, input.kind);
      return definition.docs
        .map((doc): StudioVersionSummary => {
          const meta = metaOf(doc);
          return {
            version: meta.version,
            lifecycle: meta.lifecycle,
            changeSummary: meta.changeSummary,
            createdAt: meta.createdAt,
            createdBy: meta.createdBy,
            publishedAt: meta.publishedAt,
            publishedBy: meta.publishedBy,
          };
        })
        .sort((a, b) => b.version - a.version);
    },

    async create(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "edit", input.kind);
      const earlier = replay("create", input.idempotencyKey);
      if (earlier) return earlier;
      for (const definition of definitions.values()) {
        if (definition.kind !== input.kind) continue;
        const current = definition.docs[definition.docs.length - 1];
        if (current && infoOf(current).key === input.key && isLive(definition)) {
          throw new Error(
            `definition-key-conflict: a ${input.kind} with key "${input.key}" exists`,
          );
        }
      }
      const document = createDocument(input, snapshot, {
        createdAt: nowIso(),
        createdBy: snapshot.user.id,
        createdPositionId: snapshot.position.id,
      });
      const parsed = studioDocumentSchema.parse(document);
      const meta = metaOf(parsed);
      const definition: StoredDefinition = {
        id: meta.id,
        kind: input.kind,
        docs: [parsed],
        updatedAt: meta.createdAt,
        updatedBy: snapshot.user.id,
      };
      definitions.set(definition.id, definition);
      const auditEventId = recordAudit(snapshot, "create", definition, 1);
      return remember("create", input.idempotencyKey, {
        id: definition.id,
        version: 1,
        auditEventId,
      });
    },

    async saveDraft(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      const definition = requireDefinition(input.id, input.document.kind);
      need(snapshot, "edit", definition.kind);
      const parsed = studioDocumentSchema.safeParse(input.document);
      if (!parsed.success) {
        throw new Error(
          `validation-failed: ${parsed.error.issues[0]?.message ?? "invalid document"}`,
        );
      }
      if (metaOf(parsed.data).id !== definition.id) {
        throw new Error("validation-failed: document id does not match the definition id");
      }
      const draft = lifecycleDoc(definition, "draft");
      const published = lifecycleDoc(definition, "published");
      const current = draft ? metaOf(draft).version : published ? metaOf(published).version : null;
      if (current === null || input.baseVersion !== current)
        throw conflict(input.baseVersion, current);
      const createdAt = draft ? metaOf(draft).createdAt : nowIso();
      const version = draft ? metaOf(draft).version : latestVersion(definition) + 1;
      const next = withMeta(parsed.data, {
        version,
        lifecycle: "draft",
        changeSummary: null,
        createdAt,
        createdBy: draft ? metaOf(draft).createdBy : snapshot.user.id,
        createdPositionId: snapshot.position.id,
        publishedAt: null,
        publishedBy: null,
      });
      if (draft) replaceDoc(definition, version, next);
      else definition.docs = [...definition.docs, next];
      const auditEventId = recordAudit(snapshot, "save-draft", definition, version);
      return { id: definition.id, version, auditEventId };
    },

    async publish(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "publish", input.kind);
      const earlier = replay("publish", input.idempotencyKey);
      if (earlier) return earlier;
      const definition = requireDefinition(input.id, input.kind);
      const draft = lifecycleDoc(definition, "draft");
      if (!draft) throw new Error("no-draft: there is no draft to publish");
      const draftVersion = metaOf(draft).version;
      if (input.expectedVersion !== draftVersion)
        throw conflict(input.expectedVersion, draftVersion);
      assertPublishable(draft, definition.id);
      const at = nowIso();
      const previous = lifecycleDoc(definition, "published");
      if (previous) {
        replaceDoc(
          definition,
          metaOf(previous).version,
          withMeta(previous, { lifecycle: "archived" }),
        );
      }
      replaceDoc(
        definition,
        draftVersion,
        withMeta(draft, {
          lifecycle: "published",
          changeSummary: input.changeSummary,
          publishedAt: at,
          publishedBy: snapshot.user.id,
        }),
      );
      const auditEventId = recordAudit(snapshot, "publish", definition, draftVersion);
      return remember("publish", input.idempotencyKey, {
        id: definition.id,
        version: draftVersion,
        auditEventId,
      });
    },

    async rollback(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "publish", input.kind);
      const earlier = replay("rollback", input.idempotencyKey);
      if (earlier) return earlier;
      const definition = requireDefinition(input.id, input.kind);
      const published = lifecycleDoc(definition, "published");
      const publishedVersion = published ? metaOf(published).version : null;
      if (input.expectedPublishedVersion !== publishedVersion) {
        throw conflict(input.expectedPublishedVersion, publishedVersion);
      }
      const source = definition.docs.find(
        (doc) => metaOf(doc).version === input.restoreVersion && metaOf(doc).publishedAt !== null,
      );
      if (!source) {
        throw new Error("not-found: restoreVersion is not an earlier published version");
      }
      if (input.restoreVersion === publishedVersion) {
        throw new Error("validation-failed: restoreVersion is already the published version");
      }
      const version = latestVersion(definition) + 1;
      const at = nowIso();
      const draft = lifecycleDoc(definition, "draft");
      if (published) {
        replaceDoc(
          definition,
          metaOf(published).version,
          withMeta(published, { lifecycle: "archived" }),
        );
      }
      const restored = withMeta(source, {
        version,
        lifecycle: "published",
        changeSummary: input.changeSummary,
        createdAt: at,
        createdBy: snapshot.user.id,
        createdPositionId: snapshot.position.id,
        publishedAt: at,
        publishedBy: snapshot.user.id,
      });
      if (draft) {
        // Keep the in-progress draft, renumbered above the restored version.
        replaceDoc(definition, metaOf(draft).version, withMeta(draft, { version: version + 1 }));
      }
      definition.docs = [...definition.docs, restored].sort(
        (a, b) => metaOf(a).version - metaOf(b).version,
      );
      const auditEventId = recordAudit(snapshot, "rollback", definition, version);
      return remember("rollback", input.idempotencyKey, {
        id: definition.id,
        version,
        auditEventId,
      });
    },

    async archive(input) {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "publish", input.kind);
      const earlier = replay("archive", input.idempotencyKey);
      if (earlier) return earlier;
      const definition = requireDefinition(input.id, input.kind);
      const draft = lifecycleDoc(definition, "draft");
      const published = lifecycleDoc(definition, "published");
      const live = draft ?? published;
      const liveVersion = live ? metaOf(live).version : null;
      const newest = Math.max(
        draft ? metaOf(draft).version : 0,
        published ? metaOf(published).version : 0,
      );
      if (liveVersion === null || input.expectedVersion !== newest) {
        throw conflict(input.expectedVersion, liveVersion === null ? null : newest);
      }
      definition.docs = definition.docs.map((doc) =>
        metaOf(doc).lifecycle === "archived" ? doc : withMeta(doc, { lifecycle: "archived" }),
      );
      const auditEventId = recordAudit(snapshot, "archive", definition, newest);
      return remember("archive", input.idempotencyKey, {
        id: definition.id,
        version: newest,
        auditEventId,
      });
    },

    async validate(input): Promise<{ issues: DefinitionIssue[] }> {
      await demoDelay(undefined, latency);
      const snapshot = await requireSession();
      need(snapshot, "view");
      const raw: unknown = input.document;
      const selfId = (() => {
        const parsed = studioDocumentSchema.safeParse(raw);
        return parsed.success ? metaOf(parsed.data).id : null;
      })();
      return { issues: validateDocument(raw, validationContext(selfId)) };
    },
  };
}
