import { componentPropSchema } from "@argus/schema";
import { describe, expect, it } from "vitest";
import { BLOCK_TEMPLATE_TYPES, blankComponentTemplate, getBlockTemplate } from "./blocks.js";

describe("block templates satisfy the component prop contract", () => {
  it.each(BLOCK_TEMPLATE_TYPES)("%s template props parse with componentPropSchema", (type) => {
    for (const prop of getBlockTemplate(type).props) {
      expect(componentPropSchema.safeParse(prop).success, `${type}.${prop.key}`).toBe(true);
    }
  });

  it("blank template props parse", () => {
    for (const prop of blankComponentTemplate.props) {
      expect(componentPropSchema.safeParse(prop).success).toBe(true);
    }
  });
});
