---

description: Fill in stubbed ArgusOS code with parallel implementer subagents, then test and review
agent: orchestrator
---

Implement: $ARGUMENTS

1. Use the `explorer` subagent to list every `TODO(implementation)` in scope (and any `TODO(decision)` that blocks it — ask me about those).
2. Load `parallel-task-split` and group them into tasks by file ownership. Write the plan to `docs/plans/`.
3. Dispatch `implementer` subagents in parallel waves (3–6 per wave), each brief naming the skills to load.
4. After each wave: `pnpm typecheck`; send failures back to the owning task.
5. Run `tester` on the changed packages, then `reviewer` on anything touching permissions, audit, DDL or real time.
6. Summarise: implemented, failing, review findings, next step.
