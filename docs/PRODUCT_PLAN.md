# ArgusOS — Code Plan

Nov 18, 2026 · @Brandon

ArgusOS is an open-source alternative to Juvare WebEOC: a crisis and incident management platform built around a shared operating picture, configurable boards, mapping, alerting and workflows. This plan puts four things first: **tables that are easy to manage, a no-code board builder, deep customization, and a UI people want to use under pressure.**

## 1. Name

**Chosen: ArgusOS.** Argus was the hundred-eyed watchman in Greek myth: a system that sees the whole incident. Code identifiers use `argus` (repo `argus/`, packages `@argus/*`, packs `.argus.json`). Before branding work, check trademarks, the domain and the GitHub org. The shortlist is kept below for reference.

| Name                 | Why it fits                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **ArgusOS** (chosen) | Argus was the hundred-eyed watchman in Greek myth: a system that sees the whole incident. Fits a common operating picture, CCTV and SOC work. |
| **CommandOS**        | Says exactly what it is: the system you run command from.                                                                                     |
| **IncidentOS**       | Plain and searchable. Easy to explain to buyers.                                                                                              |
| **ResponseOS**       | Built around the response, not only the record.                                                                                               |
| **CitadelOS**        | A stronghold. Serious, security-leaning.                                                                                                      |
| **KestrelOS**        | A kestrel hovers, watches and strikes fast. Distinctive and easy to brand.                                                                    |
| **TalonOS**          | Short, sharp, tactical.                                                                                                                       |
| **StrataOS**         | Layers: maps, data, agencies, operational periods.                                                                                            |
| **BeaconOS**         | A signal fire for alerting and coordination.                                                                                                  |
| **VantaOS**          | From vantage: the high ground with the full view.                                                                                             |
| **TriageOS**         | Sorting what matters first. Clinical, suits health and duty-officer work.                                                                     |
| **HaloOS**           | A ring of protection around a site or event.                                                                                                  |

## 2. Product scope

What WebEOC offers, and what v1 has to match:

- **Incidents (events):** everything is scoped to an active incident, with exercises/drills kept apart from live ones.
- **Positions:** a user signs in as a role (Duty Officer, Logistics, Planning). The position decides homepage, boards and permissions.
- **Boards:** forms and views over data (Significant Events log, Resource Requests, Tasks, SitReps, Shelters, Contacts).
- **Board builder (DesignStudio equivalent):** drag-and-drop board and workflow creation.
- **Mapping:** layers, live feeds, annotations, measuring, board records on the map.
- **Multi-channel alerts:** SMS, push, voice, email, in-app inbox, Teams, Slack, webhooks.
- **Dashboards and homepages per position**, with quick actions and a side menu.
- **Public/external forms** (DesignStudio Pro equivalent) that send data in.
- **API and integrations**, SSO, mobile responder app.

Where this project should beat it: building boards without HTML/XSLT, tables you can see and edit like a spreadsheet, a modern real-time UI, and self-hosting with no per-seat licensing.

## 3. Design principles

1. **Metadata drives everything.** Tables, boards, workflows, menus and themes are versioned JSON definitions stored in the database. The runtime interprets them; nothing is code-generated.
2. **Real Postgres tables, not EAV.** Every user-built table is a real typed table. Analysts can query it with SQL and BI tools.
3. **Draft → publish for every change.** Schema and board edits are previewed, diffed and published, and can be rolled back. Nothing breaks mid-incident.
4. **Audit everything.** Every record change is append-only history: who, what, when, from which position. EOC logs end up as legal records.
5. **Real-time by default.** Every view updates live; presence shows who else is looking.
6. **Escape hatches, not walls.** No-code covers 90%; a plugin SDK covers the rest without forking.
7. **Calm under pressure.** Fast, dense, keyboard-friendly, readable on a video wall and a phone.

## 4. Architecture

A current 2026 stack, chosen to be the opposite of legacy EOC software: no server-rendered page reloads, no HTML/XSLT board code, no Windows-only hosting. TypeScript end to end, so one schema definition (Zod) is shared by the builder, the API, the validators and the mobile app.

**Stack rules**

- Only current major versions at project start, pinned in one `pnpm` catalog and kept up to date by Renovate.
- Rust-powered tooling wherever it exists (bundler, linter, formatter) for fast builds and CI.
- Everything cloud-native and containerised, but runs fully self-hosted and air-gapped.
- Standards over vendor lock-in: OIDC, OpenAPI, OpenTelemetry, CAP, S3, vector tiles.

| Layer            | Choice                                                                                    | Why it's modern                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Runtime          | Node.js 26 LTS                                                                            | Active LTS since 28 Oct 2026, supported to April 2029; Temporal date API on by default            |
| Language         | TypeScript 5.x, strict mode, ESM only                                                     | One language across web, API, workers, mobile                                                     |
| Monorepo         | pnpm workspaces + catalogs, Turborepo with remote cache                                   |                                                                                                   |
| Build            | Vite 8 (Rolldown + Oxc)                                                                   | Rust bundler, 10–30x faster builds than the old Rollup/esbuild pair                               |
| Lint / format    | Biome (or Oxlint + Prettier)                                                              | Rust-based, one tool, seconds not minutes                                                         |
| Tests            | Vitest, Playwright (E2E + visual regression), Testcontainers for Postgres                 |                                                                                                   |
| Web app          | React 19 + React Compiler, TanStack Router + Query                                        | SPA; no SEO needed on an ops floor; automatic memoisation                                         |
| Local-first sync | Zero (Rocicorp) or ElectricSQL over Postgres                                              | Instant UI, offline tolerance, live queries without hand-written sockets                          |
| UI kit           | Radix primitives + Tailwind CSS v4 + own design tokens, Motion for animation              | Owned component library (`@argus/ui`)                                                             |
| Data grid        | Glide Data Grid                                                                           | Canvas-rendered, handles 100k+ rows                                                               |
| Builder canvas   | dnd-kit + own grid layout engine; Yjs for co-editing                                      | See section 6                                                                                     |
| Workflow editor  | React Flow (xyflow)                                                                       | Node-based automation editor                                                                      |
| API              | Hono or Fastify; tRPC for the app; generated REST + OpenAPI 3.1 for third parties         | Typed client end to end                                                                           |
| Database         | PostgreSQL 18 + PostGIS + pg\_trgm                                                        | Async I/O, native uuidv7(), virtual generated columns, OLD/NEW in RETURNING, temporal constraints |
| ORM / DDL        | Drizzle for system tables; own DDL engine for user tables                                 |                                                                                                   |
| Realtime         | Sync engine above, plus a WebSocket gateway for presence and alerts                       |                                                                                                   |
| Jobs             | Graphile Worker (Postgres-backed)                                                         | Durable jobs with no Redis to run                                                                 |
| Files            | S3-compatible (MinIO or Garage self-hosted)                                               |                                                                                                   |
| Maps             | MapLibre GL JS + Martin vector tiles + PostGIS                                            | No Mapbox lock-in                                                                                 |
| Auth             | Better Auth (or Keycloak for large agencies): OIDC, SAML, passkeys, MFA                   |                                                                                                   |
| Observability    | OpenTelemetry → Grafana stack (Loki, Tempo, Prometheus)                                   | Traces from click to SQL                                                                          |
| Mobile           | Expo (latest SDK, New Architecture) + Expo Router                                         | Shares packages with web                                                                          |
| AI (later)       | Provider-agnostic layer (Vercel AI SDK), with local model support for air-gapped sites    | Board generation, SitRep summaries                                                                |
| Deploy           | Docker Compose for small sites; Helm chart + OCI images for Kubernetes; GitHub Actions CI |                                                                                                   |

Why these Postgres 18 features matter here: `uuidv7()` gives time-ordered record ids without a library, virtual generated columns are a natural fit for formula fields, `OLD`/`NEW` in `RETURNING` makes field-level audit diffs cheap, and temporal constraints (`WITHOUT OVERLAPS`) stop double-booking resources and rosters at the database level.

A backend in Go is a fair alternative, but the shared Zod schemas between builder, server and mobile are worth more here than raw throughput.

## 4A. Real-time data (core requirement)

In an EOC a stale screen is a safety problem. Real time is part of the foundation, not a feature added later: every table, board, map, dashboard and alert is live from the first release.

### Targets

| Measure                                     | Target                                           |
| ------------------------------------------- | ------------------------------------------------ |
| Commit → visible on every subscribed screen | p95 < 250 ms, p99 < 1 s                          |
| Alert raised → delivered in-app and push    | < 2 s                                            |
| Reconnect after network drop                | Full catch-up with no missed changes, < 3 s      |
| Concurrent live users per instance          | 2,000, scaling out to 10,000+ with more gateways |
| Live map features updating                  | 5,000 moving points at 1 Hz without frame drops  |

### Two pipelines

**1. Data sync (tables, boards, dashboards).** Postgres is the source of truth. A sync engine (Zero or ElectricSQL) reads the Postgres write-ahead log through logical replication and keeps each client's live queries up to date. Clients query a local cache, so screens render instantly and keep working through short outages.

**2. Event bus (alerts, workflows, feeds, presence).** NATS JetStream carries events that are not row changes, or that need fan-out to services: alert triggers, workflow steps, integration webhooks, external feeds, presence and typing. JetStream is durable and replayable, so a restarted worker picks up where it stopped.

A small **change service** also reads the WAL and publishes row-change events onto NATS, so workflows and integrations react to the same changes the UI sees, in the same order.

### Permissions in the stream

Live data obeys the same rules as the API: the sync engine applies position, incident and field-level permissions to every subscription, and the event bus uses per-tenant, per-incident subjects with scoped credentials. A user never receives a change they could not read in a normal query.

### Consistency and conflicts

- Every record carries a `version`; writes are optimistic and the UI updates before the server confirms.
- Conflicts merge **per field**: two people editing different fields both win; the same field on the same record shows a clear conflict banner with both values instead of silently overwriting.
- Soft presence locks: "Sam (Logistics) is editing this record" appears live, without blocking anyone.
- Ordering is by WAL position, so every client sees changes in commit order.
- Offline writes queue on the device and replay on reconnect, flagged if they conflict.

### Live UX rules

- A **connection indicator** is always visible (live / reconnecting / offline, with time since last update). Nobody should wonder whether a screen is current.
- New rows arrive as a "5 new events" pill at the top instead of shifting the list under the user's cursor; changed cells flash briefly.
- Presence avatars on boards and records; live cursors in the builders.
- Dashboards and KPI tiles update from incrementally maintained counts, not by re-running heavy queries.
- Video-wall mode keeps its subscriptions open indefinitely and recovers by itself after network drops.
- If live sync fails, the app falls back to polling every 5 seconds and shows a banner, rather than going quiet.

### Live external feeds

An **ingest service** takes streaming sources and turns them into records or map layers:

- MQTT for IoT sensors, duress and alarm devices
- Vehicle and responder GPS (AVL), CAD incident feeds, CAP alert feeds
- Weather, hazard and air-quality feeds; GTFS-RT; inbound webhooks

Each feed has a mapping (fields → table), deduplication, rate limiting and a health status. High-frequency data (GPS pings, sensor readings) goes into partitioned time-series tables (optional TimescaleDB extension) with only the latest position pushed live, so the map stays smooth.

### Proving it works

- End-to-end latency is measured in production: each change carries its commit time, the client reports when it rendered it, and OpenTelemetry tracks the gap.
- k6 WebSocket load tests in CI for the 2,000-user target; chaos tests that kill gateways, the sync engine and NATS nodes mid-test and confirm nothing is lost.
- An exercise mode replays a recorded incident at speed to soak-test a deployment before go-live.

## 5. Data layer: easy-to-manage tables

This is the core of the product. The aim is Airtable-level ease on top of real Postgres.

### 5.1 Two schemas

- `meta` — the catalog: `tables`, `fields`, `relations`, `boards`, `views`, `workflows`, `positions`, `themes`, plus a `definition_versions` table holding every published version.
- `data` (one schema per tenant when multi-tenant) — the physical user tables, named `t_<short_id>` with a friendly name kept in `meta.tables`, so renames never touch DDL.

### 5.2 System columns on every user table

`id` (UUIDv7, native in Postgres 18), `incident_id`, `created_at`, `created_by`, `created_position`, `updated_at`, `updated_by`, `version` (optimistic locking), `deleted_at` (soft delete), `search` (tsvector, generated).

### 5.3 Field types

Text, long text (rich), number, currency, percent, date, date-time, duration, boolean, single select, multi select, user, position, link to record (relation), attachment, location (PostGIS point/line/polygon), phone, email, URL, status (with colours and order), formula, rollup, lookup, auto-number (e.g. `SE-0042` per incident), signature, JSON.

Each field type is a plugin in `packages/field-types` with: Postgres column type, Zod validator, grid cell renderer, form input, filter operators, import parser and export formatter. Adding a field type means writing one module.

### 5.4 Schema changes without fear

1. An admin edits a table in the Table Designer (drafts live in `meta`).
2. The **DDL engine** diffs draft against live and produces a migration plan: add column, convert type (with a preview of rows that fail conversion), add index, add FK.
3. The plan is shown in plain words ("Adds field Priority; 3 rows will be set to Medium"), then run in one transaction.
4. Destructive changes (delete field/table) are soft: the column is hidden and renamed `_deleted_<field>` for a retention period, so undo is instant.
5. Every publish is a version you can roll back to.

### 5.5 Relations, formulas and rollups

- One-to-many: FK column. Many-to-many: generated junction table, managed by the engine.
- Formulas: one expression language (section 6.4) compiled to SQL where possible (generated columns or view columns), evaluated in the app otherwise.
- Rollups and lookups: served through a per-table SQL view (`v_<table>`) that the API reads from.

### 5.6 Managing data

- Spreadsheet-style grid: inline edit, bulk edit, fill-down, paste from Excel, undo.
- CSV/XLSX import with column mapping, type detection and a dry run.
- Saved views per table: filters, sorts, grouping, hidden fields, colour rules.
- Incident scoping: tables are **incident-scoped** (logs, requests) or **global** (contacts, facilities, assets). Incidents can be archived, cloned for exercises, or exported as a package.
- Read-only SQL access: a `reporting` role with views per table for Power BI, Metabase or Grafana.

### 5.7 Audit and history

A trigger on every user table writes to `audit.record_changes` (append-only, partitioned by month): table, record, field-level diff, user, position, incident, timestamp, request id. Each record shows a timeline; an incident log can be exported as a signed PDF.

## 6. No-code board builder

### 6.1 What a board is

A board is a versioned JSON document:

- **Data sources:** one or more tables, with filters (e.g. `incident = current AND status != Closed`).
- **Views:** each board has several, switched by tabs or by role: List/Grid, Detail, Input form, Kanban, Timeline, Calendar, Map, Chart, Gallery, Printable report.
- **Layout:** a 12-column responsive grid of blocks, with breakpoints for desktop, tablet, phone and video wall.
- **Permissions:** per position, per view and per field (hidden, read-only, editable).

### 6.2 Block library

Field input, field display, record list, related records, stat/KPI tile, chart, map, timeline, rich text, image, button (runs an action), tabs, section/accordion, divider, embed (iframe/URL), comments/chat thread, checklist, attachment gallery, countdown/clock, weather widget.

### 6.3 Builder UX

- Three panes: block palette, live canvas with real data, properties inspector.
- "Preview as position" switcher to see the board exactly as Logistics or Duty Officer sees it.
- Start from a template or **generate a board from a table** in one click (form + list + detail made from its fields).
- Undo/redo, multi-select, copy blocks between boards, keyboard shortcuts.
- Draft → publish with a visual diff; version history with restore.
- Two admins can edit at once (Yjs-based co-editing of the definition).

### 6.4 Logic without code

One expression language everywhere (visibility, validation, defaults, formulas, workflow conditions): **CEL (Common Expression Language)**. It is sandboxed, has no loops, is typed and is easy to compile to SQL for simple cases. The builder offers a point-and-click condition editor that writes CEL, with a raw editor for power users.

Examples: `record.priority == 'Critical'` to show a block; `record.eta > now()` to validate; `user.position.name` as a default.

### 6.5 Board packs

A pack bundles tables + boards + workflows + menus into one importable file (`.argus.json`), with versioning and dependency checks. Ship a starter library:

- Significant Events Log
- Resource Requests (with approval chain)
- Task Tracker
- Situation Report (auto-assembled from other boards)
- Shelter / Evacuation Centre Status
- Contacts and Call Lists
- Damage Assessment (mobile-first, with photos and location)
- Position Log / Shift Handover
- Asset and Vehicle Tracking

A community pack registry later lets agencies share boards, like WebEOC's premium and industry boards.

### 6.6 Escape hatch: plugin SDK

- Custom blocks and field types as React components, loaded in a sandboxed iframe with a typed message API (`getRecord`, `updateRecord`, `subscribe`).
- Server plugins for integrations (inbound feeds, outbound actions), running in a worker with scoped API tokens.
- `npx create-argus-plugin` scaffold, with a local dev server.

## 7. Workflows and automation

- **Triggers:** record created/updated/field changed, schedule (cron), incident activated or escalated, inbound webhook, form submitted, button clicked.
- **Steps:** condition, create/update record, assign to position, send alert, call webhook, wait/delay, approval (pause for a human), escalate if not done by a deadline, run plugin action.
- **Editor:** React Flow canvas, test-run against a sample record, step-by-step run log.
- **Engine:** definitions compiled to Graphile Worker jobs; each run is durable, retryable and recorded in `workflow_runs`.

## 8. Customization

- **Theming:** design tokens (colour, radius, density, font) per tenant, with a live theme editor; light, dark and high-contrast modes; logo and terminology.
- **Terminology:** rename core concepts (Incident → Event/Operation, Position → Role/Desk) per tenant.
- **Homepages per position:** a drag-and-drop layout of boards, KPIs, map, quick actions and links.
- **Menus:** the side menu is a definition too, ordered and filtered per position.
- **Localisation:** i18n from day one (ICU messages); right-to-left support.
- **Display mode:** video-wall layouts that rotate boards, maps and dashboards, with no chrome.

## 9. UI and UX

The interface is the differentiator. Targets:

- **Command palette** (⌘K): jump to any board, record, position, incident or action.
- **Live everything:** rows flash on change, presence avatars, "3 new events" toasts instead of a page reload.
- **Density control:** comfortable for occasional users, compact for the duty officer with 20 panels open.
- **Split panes and pop-out windows** for multi-monitor EOC desks.
- **Status at a glance:** a top bar that always shows the active incident, its level, operational period and your position.
- **Motion that informs, not decorates:** only for change and attention.
- **Accessibility:** WCAG 2.2 AA, full keyboard use, screen-reader labels from field definitions.
- **Performance budgets:** first load < 2 s on a 4G tablet, interaction < 100 ms, a 50k-row grid scrolls at 60 fps.
- **Offline tolerance:** writes queue locally and sync when the connection returns, with clear conflict handling.

Build the design system first (`packages/ui` with Storybook) so every board block inherits it.

## 10. Maps, alerts, mobile and integrations

**Maps:** PostGIS stores every location field; Martin serves board data as vector tiles; layers from WMS/WFS, GeoJSON, ArcGIS REST, KML and live feeds (GTFS-RT, AVL, ADS-B, CAP). Drawing, measuring, annotations saved as records, print to PDF.

**Alerts:** one `alerts` service with channel adapters: email (SMTP/SES), SMS and voice (Twilio, Vonage, local carriers), push (FCM/APNs via Expo), in-app inbox, Teams, Slack, generic webhook. Contact groups, acknowledgement tracking, escalation if no one acknowledges, and CAP 1.2 output.

**Mobile:** an Expo responder app that renders the same board definitions with mobile layouts: check-in, tasks, forms with photo and GPS, alerts with acknowledge, offline drafts.

**Integrations:** auto-generated REST API per table (OpenAPI docs, scoped API keys), outbound webhooks, EDXL and CAP import/export, weather and hazard feeds, and a plugin slot for VMS/CCTV, CAD and radio systems.

**Public forms:** publish any input view as a public or link-only form (captcha, rate limits, file upload), landing in a review queue before it enters the live incident.

## 11. Security and compliance

- **Access model:** RBAC by position + ABAC rules (incident, jurisdiction, field sensitivity) written in CEL.
- **Enforcement in the database:** Postgres row-level security on every user table, set from the session's user, position and incident, so a bug in the API cannot leak rows.
- **Field-level security** for sensitive fields (personal details, intelligence).
- **SSO**, MFA, passkeys, session limits, IP allowlists.
- **Encryption** in transit and at rest; optional per-field encryption.
- **Immutable audit log** with export; time sync and signed incident logs.
- **Australian alignment:** design for ISM and Essential Eight controls and data sovereignty (self-host or AU region).
- **Multi-tenancy:** schema-per-tenant for agencies sharing one install; cross-agency sharing of chosen boards (a JX Collaborate equivalent) later.

## 12. Repo layout

```
argus/
  apps/
    web/            React app (ops UI + builders)
    api/            Fastify + tRPC + REST
    realtime/       WebSocket gateway
    worker/         Graphile Worker: workflows, alerts, imports
    mobile/         Expo responder app
    docs/           Docs site
  packages/
    schema/         Zod schemas for every definition (tables, boards, workflows)
    ddl-engine/     Diff + migration planner for user tables
    field-types/    One module per field type
    blocks/         Board block library
    expr/           CEL parser, evaluator, SQL compiler
    ui/             Design system + Storybook
    sdk/            Plugin SDK (client + server)
    alerts/         Channel adapters
    maps/           MapLibre wrappers, layer types
  packs/            Starter board packs
  deploy/           Docker Compose, Helm chart
```

## 13. Roadmap

| Phase                    | Weeks | Deliverables                                                                                                                                    |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Foundations           | 1–4   | Monorepo, CI, auth (OIDC + local), tenants, users, positions, incidents, design system v0                                                       |
| 1. Tables                | 5–10  | Sync engine + live queries, NATS event bus, meta catalog, DDL engine, 12 core field types, grid with inline edit, import/export, audit log, RLS |
| 2. Board builder         | 11–18 | Board schema, layout engine, 15 blocks, list/detail/form/kanban views, CEL logic, draft/publish, preview-as-position                            |
| 3. Real-time + homepages | 19–22 | Presence, live cursors, connection indicator, position homepages, menus, command palette                                                        |
| 4. Workflows + alerts    | 23–28 | Workflow editor and engine, email/SMS/push/Teams/Slack/webhook, acknowledgements                                                                |
| 5. Maps                  | 29–33 | PostGIS fields, map view and block, external layers, drawing                                                                                    |
| 6. Packs + v1.0          | 34–38 | 9 starter packs, pack import/export, docs, Helm chart, security review                                                                          |
| 7. After v1              | —     | Mobile app, public forms, plugin SDK, pack registry, cross-agency sharing, AI assistant for building boards and summarising SitReps             |

Ship something usable at the end of phase 2: tables + boards alone already replace a lot of what agencies use WebEOC for.

## 14. Risks and open questions

- **DDL on live data:** type changes on large tables can lock them. Mitigation: online migrations (add new column → backfill in batches → swap), and blocking heavy changes during an active incident.
- **Builder scope creep:** the builder can grow into a full app platform. Hold the line on block count and lean on the plugin SDK.
- **Licence:** AGPL-3.0 protects against cloud resellers; Apache-2.0 gets more agencies through procurement. Decide before the first public commit.
- **Trust and procurement:** government buyers want support, certifications and an established vendor. A commercial hosted and support offering alongside the open-source core is likely needed.
- **Real-time scale:** logical replication fan-out to thousands of clients needs load testing early (target: 2,000 concurrent users per instance).
- **Naming:** check trademarks and domains for the shortlist before branding work starts.
