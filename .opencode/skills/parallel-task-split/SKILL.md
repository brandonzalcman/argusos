---

name: parallel-task-split
description: How to break ArgusOS work into non-overlapping tasks for parallel subagents, order them in waves, and write self-contained task briefs. Load when planning or dispatching any multi-file work.
---

# Splitting work for parallel subagents

## 1. Split by file ownership, not by feature step

Each task owns a set of files. No two tasks in the same wave may own the same file. Good splits:

- one package per task (`packages/field-types`, `packages/expr`, ...)
- inside a big package, one folder per task (`field-types/src/text/`, `field-types/src/number/`)
- one app route or screen per task

Bad split: "task A writes the function, task B writes its tests in the same file".

## 2. Contracts before fan-out (wave 0, done by the orchestrator)

Write these yourself before dispatching:

- Zod schemas and inferred types in `packages/schema`
- exported signatures in each package's `src/index.ts`
- tRPC router input/output types
  Parallel tasks import these and must not change them.

## 3. Waves

- Wave 0: contracts (orchestrator)
- Wave 1: leaf packages with no internal deps (schema-dependent only)
- Wave 2: packages that depend on wave 1
- Wave 2b (UI): ui-designer builds tokens + core components + app shell, then ui-builder fans out
- Wave 3: apps wiring packages together
- Final: tester + reviewer

3–6 tasks per wave. Send all of a wave's task calls in **one message** so they run in parallel.

## 4. Pick the cheapest agent that fits

| Work                                                     | Agent                                          |
| -------------------------------------------------------- | ---------------------------------------------- |
| Folder/file structure, stubs, configs                    | scaffolder                                     |
| Filling in functions, focused features (non-UI)          | implementer                                    |
| Design system, app shell, key screens (sets patterns)    | ui-designer — one at a time, before UI fan-out |
| Components, blocks, secondary screens following patterns | ui-builder — parallel                          |
| Docker, Compose, Helm, CI, env config                    | devops                                         |
| READMEs, docs site, ADRs, contributor guides             | docs-writer                                    |
| Tests                                                    | tester                                         |
| Review of risky areas                                    | reviewer                                       |
| "Where is X?"                                            | explorer                                       |

Spread a wave across agent types when possible: each agent runs on a different model with its own usage limit.

## 5. Task brief template

```
GOAL: <one sentence>
OWNS: <exact file/folder paths — only these may be edited>
IMPORTS: <contracts to use, e.g. FieldTypeDefinition from @argus/schema>
SKILLS: <skill names to load>
SPEC: <bullets: behaviour, edge cases, permissions, real-time, audit>
DONE WHEN: <e.g. `pnpm --filter @argus/field-types typecheck` passes and N tests pass>
REPORT: use the report format in your agent instructions
```
The subagent cannot see the conversation. Put everything it needs in the brief.

## 6. Plan file

`docs/plans/<yyyy-mm-dd>-<slug>.md`:

```
| id | agent | owns | depends on | skills | status |
|----|-------|------|-----------|--------|--------|
```
Update `status` after each wave: todo → running → done / failed (reason).
