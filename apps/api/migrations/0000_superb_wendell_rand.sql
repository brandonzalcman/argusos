CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "meta";
--> statement-breakpoint
CREATE TABLE "meta"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."definition_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_kind" text NOT NULL,
	"definition_id" uuid NOT NULL,
	"previous_version" integer,
	"version" integer NOT NULL,
	"operation" text NOT NULL,
	"change_summary" text,
	"actor_user_id" uuid NOT NULL,
	"actor_position_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta"."idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_tenant_user_key_uq" UNIQUE("tenant_id","user_id","key")
);
--> statement-breakpoint
CREATE TABLE "meta"."incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"level" smallint,
	"operational_period" text,
	"activated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "incidents_tenant_key_uq" UNIQUE("tenant_id","key"),
	CONSTRAINT "incidents_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "meta"."positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"homepage_board_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"studio_view" boolean DEFAULT false NOT NULL,
	"studio_edit" boolean DEFAULT false NOT NULL,
	"studio_publish" boolean DEFAULT false NOT NULL,
	"studio_edit_code" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "positions_tenant_key_uq" UNIQUE("tenant_id","key"),
	CONSTRAINT "positions_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "audit"."record_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"incident_id" uuid,
	"table_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_position_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field_diff" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta"."session_contexts" (
	"auth_session_id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"incident_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"previous" jsonb,
	"next" jsonb,
	"request_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta"."studio_definition_versions" (
	"tenant_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"lifecycle" text NOT NULL,
	"document" jsonb NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_position_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	CONSTRAINT "studio_definition_versions_pk" PRIMARY KEY("definition_id","version")
);
--> statement-breakpoint
CREATE TABLE "meta"."studio_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text,
	"draft_version" integer,
	"published_version" integer,
	"latest_version" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "studio_definitions_tenant_kind_key_uq" UNIQUE("tenant_id","kind","key"),
	CONSTRAINT "studio_definitions_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "meta"."tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "meta"."user_positions" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "user_positions_pk" PRIMARY KEY("user_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "meta"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"auth_user_id" text,
	"display_name" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
ALTER TABLE "meta"."api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."definition_changes" ADD CONSTRAINT "definition_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_fk" FOREIGN KEY ("user_id","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."incidents" ADD CONSTRAINT "incidents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."record_changes" ADD CONSTRAINT "record_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."session_contexts" ADD CONSTRAINT "session_contexts_auth_session_id_session_id_fk" FOREIGN KEY ("auth_session_id") REFERENCES "auth"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."session_contexts" ADD CONSTRAINT "session_contexts_user_fk" FOREIGN KEY ("user_id","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."session_contexts" ADD CONSTRAINT "session_contexts_position_fk" FOREIGN KEY ("position_id","tenant_id") REFERENCES "meta"."positions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."session_contexts" ADD CONSTRAINT "session_contexts_incident_fk" FOREIGN KEY ("incident_id","tenant_id") REFERENCES "meta"."incidents"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."session_events" ADD CONSTRAINT "session_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definition_versions" ADD CONSTRAINT "studio_definition_versions_definition_fk" FOREIGN KEY ("definition_id","tenant_id") REFERENCES "meta"."studio_definitions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definition_versions" ADD CONSTRAINT "studio_definition_versions_created_by_fk" FOREIGN KEY ("created_by","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definition_versions" ADD CONSTRAINT "studio_definition_versions_position_fk" FOREIGN KEY ("created_position_id","tenant_id") REFERENCES "meta"."positions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definitions" ADD CONSTRAINT "studio_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definitions" ADD CONSTRAINT "studio_definitions_created_by_fk" FOREIGN KEY ("created_by","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."studio_definitions" ADD CONSTRAINT "studio_definitions_updated_by_fk" FOREIGN KEY ("updated_by","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."user_positions" ADD CONSTRAINT "user_positions_user_fk" FOREIGN KEY ("user_id","tenant_id") REFERENCES "meta"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."user_positions" ADD CONSTRAINT "user_positions_position_fk" FOREIGN KEY ("position_id","tenant_id") REFERENCES "meta"."positions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "meta"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."users" ADD CONSTRAINT "users_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth"."account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth"."session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "definition_changes_definition_idx" ON "audit"."definition_changes" USING btree ("tenant_id","definition_id","occurred_at");--> statement-breakpoint
CREATE INDEX "session_events_user_idx" ON "audit"."session_events" USING btree ("tenant_id","user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "studio_definitions_page_slug_uq" ON "meta"."studio_definitions" USING btree ("tenant_id","slug") WHERE "meta"."studio_definitions"."kind" = 'page' and "meta"."studio_definitions"."slug" is not null;--> statement-breakpoint
CREATE INDEX "studio_definitions_tenant_kind_idx" ON "meta"."studio_definitions" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "meta"."users" USING btree ("tenant_id");