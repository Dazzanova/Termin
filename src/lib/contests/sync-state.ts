import { client, ready } from "../db/database";

const UPSERT = `
  INSERT INTO app_metadata (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`;

async function setValue(key: string, value: string): Promise<void> {
  await client.execute({ sql: UPSERT, args: [key, value] });
}

async function getValue(key: string): Promise<string | undefined> {
  const result = await client.execute({
    sql: "SELECT value FROM app_metadata WHERE key = ?",
    args: [key],
  });

  return result.rows[0]?.value as string | undefined;
}

export async function markSyncStarted(): Promise<void> {
  await ready();

  await setValue("sync_started_at", new Date().toISOString());
  await setValue("sync_status", "syncing");
}

export async function markSyncCompleted(
  success: boolean = true
): Promise<void> {
  await ready();

  await setValue("sync_completed_at", new Date().toISOString());
  await setValue("sync_status", success ? "ok" : "error");
}

export async function markProviderSuccess(platform: string): Promise<void> {
  await ready();

  await setValue(`provider_status_${platform}`, "ok");
  await setValue(`provider_synced_at_${platform}`, new Date().toISOString());
}

export async function markProviderFailure(
  platform: string,
  error: unknown
): Promise<void> {
  await ready();

  const message = error instanceof Error ? error.message : String(error);
  await setValue(`provider_status_${platform}`, `error:${message}`);
}

export type SyncStatus = "ok" | "syncing" | "error" | "unknown";

export type SyncState = {
  status: SyncStatus;
  completedAt: Date | null;
  startedAt: Date | null;
};

export async function getSyncState(): Promise<SyncState> {
  await ready();

  const [statusValue, completedValue, startedValue] = await Promise.all([
    getValue("sync_status"),
    getValue("sync_completed_at"),
    getValue("sync_started_at"),
  ]);

  const raw = statusValue ?? "unknown";
  const status: SyncStatus =
    raw === "ok" || raw === "syncing" || raw === "error" ? raw : "unknown";

  return {
    status,
    completedAt: completedValue ? new Date(completedValue) : null,
    startedAt: startedValue ? new Date(startedValue) : null,
  };
}
