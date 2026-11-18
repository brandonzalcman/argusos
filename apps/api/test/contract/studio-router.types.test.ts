import type { StudioApi } from "@argus/schema";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { describe, expectTypeOf, it } from "vitest";
import type { createStudioRouter } from "../../src/studio/router.js";

type StudioRouter = ReturnType<typeof createStudioRouter>;
type Inputs = inferRouterInputs<StudioRouter>;
type Outputs = inferRouterOutputs<StudioRouter>;

/**
 * Compile-time contract: the `studio` router's procedure names, inputs and outputs must equal
 * `StudioApi` from @argus/schema. Drift fails `pnpm --filter @argus/api typecheck` (this file is in
 * the tsconfig include); the runtime body only keeps vitest from reporting an empty suite.
 */
type ContractCheck = {
  [K in keyof StudioApi]: {
    input: Inputs[K] extends Parameters<StudioApi[K]>[0]
      ? Parameters<StudioApi[K]>[0] extends Inputs[K]
        ? true
        : false
      : false;
    output: Outputs[K] extends Awaited<ReturnType<StudioApi[K]>>
      ? Awaited<ReturnType<StudioApi[K]>> extends Outputs[K]
        ? true
        : false
      : false;
  };
};

describe("studio router type contract", () => {
  it("has exactly the StudioApi procedure names", () => {
    expectTypeOf<keyof Inputs>().toEqualTypeOf<keyof StudioApi>();
    expectTypeOf<keyof Outputs>().toEqualTypeOf<keyof StudioApi>();
  });

  it("list", () => {
    expectTypeOf<Inputs["list"]>().toEqualTypeOf<Parameters<StudioApi["list"]>[0]>();
    expectTypeOf<Outputs["list"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["list"]>>>();
  });

  it("get", () => {
    expectTypeOf<Inputs["get"]>().toEqualTypeOf<Parameters<StudioApi["get"]>[0]>();
    expectTypeOf<Outputs["get"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["get"]>>>();
  });

  it("getPageBySlug", () => {
    expectTypeOf<Inputs["getPageBySlug"]>().toEqualTypeOf<
      Parameters<StudioApi["getPageBySlug"]>[0]
    >();
    expectTypeOf<Outputs["getPageBySlug"]>().toEqualTypeOf<
      Awaited<ReturnType<StudioApi["getPageBySlug"]>>
    >();
  });

  it("listVersions", () => {
    expectTypeOf<Inputs["listVersions"]>().toEqualTypeOf<
      Parameters<StudioApi["listVersions"]>[0]
    >();
    expectTypeOf<Outputs["listVersions"]>().toEqualTypeOf<
      Awaited<ReturnType<StudioApi["listVersions"]>>
    >();
  });

  it("create, saveDraft, publish, rollback, archive", () => {
    expectTypeOf<Inputs["create"]>().toEqualTypeOf<Parameters<StudioApi["create"]>[0]>();
    expectTypeOf<Outputs["create"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["create"]>>>();
    expectTypeOf<Inputs["saveDraft"]>().toEqualTypeOf<Parameters<StudioApi["saveDraft"]>[0]>();
    expectTypeOf<Outputs["saveDraft"]>().toEqualTypeOf<
      Awaited<ReturnType<StudioApi["saveDraft"]>>
    >();
    expectTypeOf<Inputs["publish"]>().toEqualTypeOf<Parameters<StudioApi["publish"]>[0]>();
    expectTypeOf<Outputs["publish"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["publish"]>>>();
    expectTypeOf<Inputs["rollback"]>().toEqualTypeOf<Parameters<StudioApi["rollback"]>[0]>();
    expectTypeOf<Outputs["rollback"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["rollback"]>>>();
    expectTypeOf<Inputs["archive"]>().toEqualTypeOf<Parameters<StudioApi["archive"]>[0]>();
    expectTypeOf<Outputs["archive"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["archive"]>>>();
  });

  it("validate", () => {
    expectTypeOf<Inputs["validate"]>().toEqualTypeOf<Parameters<StudioApi["validate"]>[0]>();
    expectTypeOf<Outputs["validate"]>().toEqualTypeOf<Awaited<ReturnType<StudioApi["validate"]>>>();
  });

  it("mutual assignability holds for every procedure", () => {
    expectTypeOf<ContractCheck[keyof StudioApi]["input"]>().toEqualTypeOf<true>();
    expectTypeOf<ContractCheck[keyof StudioApi]["output"]>().toEqualTypeOf<true>();
  });
});
