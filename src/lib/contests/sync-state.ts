import db from "../db/database";

db.exec(`
  CREATE TABLE IF NOT EXISTS app_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const upsert = db.prepare(`
  INSERT INTO app_metadata (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const get = db.prepare(`
  SELECT value FROM app_metadata WHERE key = ?
`);

export function markSyncStarted(): void {
  upsert.run("sync_started_at", new Date().toISOString());
  upsert.run("sync_status", "syncing");
}

export function markSyncCompleted(success: boolean = true): void {
  upsert.run("sync_completed_at", new Date().toISOString());
  upsert.run("sync_status", success ? "ok" : "error");
}

export function markProviderSuccess(platform: string): void {
  upsert.run(`provider_status_${platform}`, "ok");
  upsert.run(`provider_synced_at_${platform}`, new Date().toISOString());
}

export function markProviderFailure(platform: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  upsert.run(`provider_status_${platform}`, `error:${message}`);
}

export type SyncStatus = "ok" | "syncing" | "error" | "unknown";

export type SyncState = {
  status: SyncStatus;
  completedAt: Date | null;
  startedAt: Date | null;
};

export function getSyncState(): SyncState {
  const statusRow   = get.get("sync_status")       as { value: string } | undefined;
  const completedRow = get.get("sync_completed_at") as { value: string } | undefined;
  const startedRow   = get.get("sync_started_at")   as { value: string } | undefined;

  const raw = statusRow?.value ?? "unknown";
  const status: SyncStatus =
    raw === "ok" || raw === "syncing" || raw === "error" ? raw : "unknown";

  return {
    status,
    completedAt: completedRow?.value ? new Date(completedRow.value) : null,
    startedAt:   startedRow?.value   ? new Date(startedRow.value)   : null,
  };
}
