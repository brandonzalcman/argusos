import { type AlertChannel, type AlertRecipient, alertChannelSchema } from "@argus/schema";
import type { RecipientOption } from "./alerts-source.js";

export const alertChannels: readonly AlertChannel[] = alertChannelSchema.options;

export const channelLabels: Record<AlertChannel, string> = {
  email: "Email",
  sms: "SMS",
  voice: "Voice call",
  push: "Push notification",
  "in-app": "In-app inbox",
  teams: "Microsoft Teams",
  slack: "Slack",
  webhook: "Webhook",
};

export const severities = ["info", "minor", "major", "critical"] as const;
export type Severity = (typeof severities)[number];

/** Recipient selection key, `${kind}:${id}`, so positions and groups cannot collide. */
export type RecipientKey = string;

export const recipientKey = (option: Pick<RecipientOption, "kind" | "id">): RecipientKey =>
  `${option.kind}:${option.id}`;

export interface ComposeDraft {
  readonly title: string;
  readonly message: string;
  readonly severity: Severity;
  readonly channels: readonly AlertChannel[];
  readonly recipients: readonly RecipientKey[];
  readonly acknowledgementRequired: boolean;
}

export interface ComposeErrors {
  readonly title?: string;
  readonly message?: string;
  readonly channels?: string;
  readonly recipients?: string;
}

export const emptyDraft: ComposeDraft = {
  title: "",
  message: "",
  severity: "info",
  channels: [],
  recipients: [],
  acknowledgementRequired: false,
};

/**
 * Inline validation mirroring alertDefinitionSchema limits (title 1-500, message 1-10000,
 * 1+ channel, 1+ recipient).
 * Input: the current draft. Output: field errors; an empty object means it may be submitted.
 * Errors: none. The server re-validates and re-authorizes everything.
 * Depends on: packages/schema alert limits.
 */
export function validateDraft(draft: ComposeDraft): ComposeErrors {
  const errors: { title?: string; message?: string; channels?: string; recipients?: string } = {};
  const title = draft.title.trim();
  if (title.length === 0) errors.title = "Enter a title.";
  else if (title.length > 500) errors.title = "Title must be 500 characters or fewer.";
  const message = draft.message.trim();
  if (message.length === 0) errors.message = "Enter a message.";
  else if (message.length > 10_000) errors.message = "Message must be 10,000 characters or fewer.";
  if (draft.channels.length === 0) errors.channels = "Select at least one channel.";
  if (draft.recipients.length === 0) errors.recipients = "Select at least one recipient group.";
  return errors;
}

export function toggleItem<T>(items: readonly T[], item: T): readonly T[] {
  return items.includes(item) ? items.filter((existing) => existing !== item) : [...items, item];
}

/** Converts selected keys to schema recipients, dropping keys not present in the directory. */
export function toRecipients(
  keys: readonly RecipientKey[],
  options: readonly RecipientOption[],
): readonly AlertRecipient[] {
  const recipients: AlertRecipient[] = [];
  for (const option of options) {
    if (!keys.includes(recipientKey(option))) continue;
    recipients.push(
      option.kind === "position"
        ? { type: "position", positionId: option.id }
        : { type: "contact-group", groupId: option.id },
    );
  }
  return recipients;
}

/** Case-insensitive name filter for the picker. */
export function filterRecipients(
  options: readonly RecipientOption[],
  query: string,
): readonly RecipientOption[] {
  const needle = query.trim().toLowerCase();
  return needle === ""
    ? options
    : options.filter((option) => option.name.toLowerCase().includes(needle));
}
