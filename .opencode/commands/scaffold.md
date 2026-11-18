---

description: Scaffold an area of ArgusOS from the plan using parallel cheap subagents (stubs + contracts only, no implementations)
agent: orchestrator
---

Scaffold: $ARGUMENTS

Use `docs/PRODUCT_PLAN.md` as the source of truth. Load the `parallel-task-split` skill.

1. Write the plan to `docs/plans/` with tasks, file ownership and waves.
2. Write the shared contracts in `packages/schema` yourself.
3. Dispatch `scaffolder` subagents in parallel waves. Stubs only, following the AGENTS.md stub convention (TODO(implementation) doc blocks, throwing bodies, `it.todo` tests). Configs in full.
4. After each wave run `pnpm install && pnpm typecheck` and send failures back.
5. Finish with a summary: packages created, typecheck result, gaps for me to decide.
