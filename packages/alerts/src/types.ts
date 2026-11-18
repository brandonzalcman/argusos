export type AlertChannel =
  | "email"
  | "sms"
  | "voice"
  | "expo-push"
  | "in-app"
  | "teams"
  | "slack"
  | "webhook"
  | "cap-1.2";

export interface SecretReference {
  readonly provider: "environment" | "file" | "vault";
  readonly reference: string;
}

export interface DeliveryScope {
  readonly tenantId: string;
  readonly incidentId: string | null;
  readonly alertId: string;
  readonly deliveryId: string;
  readonly idempotencyKey: string;
  readonly requestedByUserId: string | null;
  readonly requestedByPositionId: string | null;
  readonly correlationId: string;
  readonly requestedAt: Date;
}

export interface AlertRecipient {
  readonly recipientId: string;
  readonly displayName: string;
  readonly destination: string;
  readonly locale: string | null;
  readonly timeZone: string | null;
}

export interface AlertContent {
  readonly subject: string;
  readonly plainText: string;
  readonly html: string | null;
  readonly actionUrl: string | null;
  readonly priority: "low" | "normal" | "high" | "critical";
}

export interface DeliveryRequest {
  readonly channel: AlertChannel;
  readonly scope: DeliveryScope;
  readonly recipient: AlertRecipient;
  readonly content: AlertContent;
  readonly expiresAt: Date | null;
}

export type DeliveryOutcome =
  | {
      readonly status: "accepted";
      readonly providerMessageId: string | null;
      readonly attemptedAt: Date;
    }
  | {
      readonly status: "retryable-failure" | "permanent-failure" | "suppressed";
      readonly errorCode: string;
      readonly safeMessage: string;
      readonly attemptedAt: Date;
      readonly retryAfter: Date | null;
    };

export interface AdapterHealth {
  readonly status: "ok" | "degraded" | "unavailable";
  readonly checkedAt: Date;
  readonly safeMessage: string | null;
}
