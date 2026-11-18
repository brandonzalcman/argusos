import type { ReactNode } from "react";
import type { BoardRendererPort, BoardRendererProps } from "./types.js";

/**
 * TODO(implementation): interpret a published board through registry, layout, data, and CEL ports.
 * Input: a schema-validated definition, responsive layout, registry, scope, and authorized data.
 * Output: never returns in the scaffold; the future renderer returns accessible React content.
 * Errors: always throws TODO(implementation); future versions surface scoped data/config errors.
 * Depends on: @argus/schema, @argus/expr, @argus/ui, layout validation, RBAC/ABAC, and audit APIs.
 * Tenant, incident, field, view, and action policies must be enforced before every block render.
 */
export function renderBoard<TBoardDefinition>(
  _props: BoardRendererProps<TBoardDefinition>,
): ReactNode {
  throw new Error("TODO(implementation): renderBoard");
}

/**
 * TODO(implementation): expose the board interpreter behind an injectable renderer port.
 * Input: none; consumers supply renderer arguments to the returned port.
 * Output: a port delegating to the throwing renderer stub.
 * Errors: render throws TODO(implementation) and never produces placeholder operational data.
 * Depends on: renderBoard and the same security/versioning contracts.
 */
export function createBoardRendererStub(): BoardRendererPort {
  return { render: renderBoard };
}
