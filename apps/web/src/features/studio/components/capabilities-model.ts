import { idSchema, type PluginCapability } from "@argus/schema";

export type CapabilityType = PluginCapability["type"];

export interface CapabilityInfo {
  readonly type: CapabilityType;
  readonly label: string;
  readonly description: string;
  /** Needs an administrator's approval before it can be granted at runtime. */
  readonly requiresAdminApproval: boolean;
  /** The sandbox bridge enforces it today (see @argus/sdk README: the other two are ignored). */
  readonly enforcedBySandbox: boolean;
}

export const capabilityInfo: Readonly<Record<CapabilityType, CapabilityInfo>> = {
  "read-records": {
    type: "read-records",
    label: "Read records",
    description: "Read the listed fields of records in the listed tables.",
    requiresAdminApproval: false,
    enforcedBySandbox: true,
  },
  "subscribe-records": {
    type: "subscribe-records",
    label: "Subscribe to record changes",
    description: "Receive live updates for the listed fields. Also needs Read records.",
    requiresAdminApproval: false,
    enforcedBySandbox: true,
  },
  "update-records": {
    type: "update-records",
    label: "Update records",
    description: "Change the listed fields of records in the listed tables.",
    requiresAdminApproval: false,
    enforcedBySandbox: true,
  },
  "outbound-http": {
    type: "outbound-http",
    label: "Outbound HTTP",
    description: "Call the listed hosts from the server. The sandbox itself has no network.",
    requiresAdminApproval: true,
    enforcedBySandbox: false,
  },
  "workflow-action": {
    type: "workflow-action",
    label: "Workflow actions",
    description: "Start the listed workflow actions.",
    requiresAdminApproval: true,
    enforcedBySandbox: false,
  },
};

export const capabilityTypes: readonly CapabilityType[] = [
  "read-records",
  "subscribe-records",
  "update-records",
  "outbound-http",
  "workflow-action",
];

export type CapabilityListKey = "tableIds" | "fieldIds" | "allowedHosts" | "actionKeys";

/** Which list fields each capability type has, in display order. */
export function listKeysFor(type: CapabilityType): readonly CapabilityListKey[] {
  switch (type) {
    case "read-records":
    case "subscribe-records":
    case "update-records":
      return ["tableIds", "fieldIds"];
    case "outbound-http":
      return ["allowedHosts"];
    case "workflow-action":
      return ["actionKeys"];
  }
}

export function requiresAdminApproval(capability: PluginCapability): boolean {
  return capabilityInfo[capability.type].requiresAdminApproval;
}

export function emptyCapability(type: CapabilityType): PluginCapability {
  switch (type) {
    case "read-records":
    case "subscribe-records":
    case "update-records":
      return { type, tableIds: [], fieldIds: [] };
    case "outbound-http":
      return { type, allowedHosts: [] };
    case "workflow-action":
      return { type, actionKeys: [] };
  }
}

/** Types that are not yet declared (one entry per type keeps review simple). */
export function availableCapabilityTypes(
  capabilities: readonly PluginCapability[],
): CapabilityType[] {
  const used = new Set(capabilities.map((c) => c.type));
  return capabilityTypes.filter((type) => !used.has(type));
}

export function addCapability(
  capabilities: readonly PluginCapability[],
  type: CapabilityType,
): PluginCapability[] {
  if (capabilities.some((c) => c.type === type)) return [...capabilities];
  return [...capabilities, emptyCapability(type)];
}

export function removeCapability(
  capabilities: readonly PluginCapability[],
  index: number,
): PluginCapability[] {
  return capabilities.filter((_, i) => i !== index);
}

/** Splits free text on commas, semicolons and whitespace; trims, drops empties and duplicates. */
export function parseList(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).filter((item) => item.length > 0))];
}

export function formatList(items: readonly string[]): string {
  return items.join("\n");
}

/** Replaces one list of one capability. Keys that don't belong to the capability are ignored. */
export function setCapabilityList(
  capabilities: readonly PluginCapability[],
  index: number,
  key: CapabilityListKey,
  items: readonly string[],
): PluginCapability[] {
  return capabilities.map((capability, i) => {
    if (i !== index || !listKeysFor(capability.type).includes(key)) return capability;
    return { ...capability, [key]: [...items] } as PluginCapability;
  });
}

export function getCapabilityList(
  capability: PluginCapability,
  key: CapabilityListKey,
): readonly string[] {
  const value = (capability as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export interface CapabilityIssue {
  readonly index: number;
  readonly severity: "error" | "warning";
  readonly message: string;
}

const listNouns: Readonly<Record<CapabilityListKey, string>> = {
  tableIds: "table",
  fieldIds: "field",
  allowedHosts: "host",
  actionKeys: "action",
};

/** Local validation for the editor; the server re-validates on save and publish. */
export function validateCapabilities(capabilities: readonly PluginCapability[]): CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  capabilities.forEach((capability, index) => {
    const label = capabilityInfo[capability.type].label;
    const keys = listKeysFor(capability.type);
    for (const key of keys) {
      const items = getCapabilityList(capability, key);
      if (key === "tableIds" || key === "fieldIds") {
        const bad = items.find((item) => !idSchema.safeParse(item).success);
        if (bad !== undefined) {
          issues.push({
            index,
            severity: "error",
            message: `${label}: "${bad}" is not a valid ${listNouns[key]} id.`,
          });
        }
      }
      if (key === "allowedHosts") {
        const bad = items.find((host) => /[/\s:@]/.test(host));
        if (bad !== undefined) {
          issues.push({
            index,
            severity: "error",
            message: `${label}: "${bad}" must be a bare host name such as api.example.org.`,
          });
        }
      }
      if (items.length === 0) {
        issues.push({
          index,
          severity: "warning",
          message: `${label}: no ${listNouns[key]}s listed, so nothing is granted.`,
        });
      }
    }
  });
  return issues;
}

/** One line per capability for the publish confirmation. */
export function summarizeCapability(capability: PluginCapability): string {
  const label = capabilityInfo[capability.type].label;
  const parts = listKeysFor(capability.type).map((key) => {
    const count = getCapabilityList(capability, key).length;
    return `${count} ${listNouns[key]}${count === 1 ? "" : "s"}`;
  });
  return `${label}: ${parts.join(", ")}`;
}
