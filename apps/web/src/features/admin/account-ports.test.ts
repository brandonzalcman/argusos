import { describe, expect, it } from "vitest";
import {
  createLogoUploadStub,
  createSessionManagementStub,
  LOGO_MAX_BYTES,
  validateLogoFile,
} from "./account-ports.js";

describe("validateLogoFile", () => {
  it("accepts small PNG, JPEG and WebP images", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validateLogoFile({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejects SVG and other types, empty files and oversize files", () => {
    expect(validateLogoFile({ type: "image/svg+xml", size: 1024 })).toMatch(/SVG/);
    expect(validateLogoFile({ type: "application/pdf", size: 1024 })).not.toBeNull();
    expect(validateLogoFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validateLogoFile({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toMatch(/limit/);
  });
});

describe("stub ports", () => {
  it("reject with the documented TODO(implementation) error", async () => {
    const scope = { tenantId: "t", incidentId: null };
    const actor = { userId: "u", positionId: "p", sessionId: "s" };
    await expect(createSessionManagementStub().listSessions(scope, actor)).rejects.toThrow(
      /^TODO\(implementation\)/,
    );
    await expect(
      createLogoUploadStub().uploadLogo({ scope, actor, file: new File(["x"], "a.png") }),
    ).rejects.toThrow(/^TODO\(implementation\)/);
  });
});
