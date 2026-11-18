import { describe, it } from "vitest";

describe.todo("Expo responder shell", () => {
  it.todo("registers typed routes for every responder workflow without sample operational data");
  it.todo("requires authenticated tenant, position and incident scope before loading a route");
  it.todo("keeps live incidents and exercises isolated in navigation and persisted state");
  it.todo("renders shared BoardDefinition views with mobile field-level permissions");
  it.todo("labels route parameters as untrusted until server authorization completes");
});

describe.todo("Native and offline capability boundaries", () => {
  it.todo("requests camera and foreground location consent only on explicit capture actions");
  it.todo("keeps local media URIs and provider tokens out of logs and analytics");
  it.todo("partitions encrypted drafts by tenant, user and incident");
  it.todo("replays drafts idempotently with optimistic record versions");
  it.todo("presents same-field conflicts without silently overwriting either value");
  it.todo("records accepted check-ins and alert acknowledgements in server audit history");
});
