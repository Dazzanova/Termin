import db from "../db/database";
import type { ContestPlatform } from "../contests/types";
import {
  DEFAULT_PREFERENCES,
  SUPPORTED_PLATFORMS,
  type UserPreferences,
} from "./types";

type PreferencesRow = {
  id: number;
  enabled_platforms: string;
};

const getPreferencesStatement = db.prepare(`
  SELECT
    id,
    enabled_platforms
  FROM preferences
  WHERE id = 1
`);

const savePreferencesStatement = db.prepare(`
  INSERT INTO preferences (id, enabled_platforms)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET
    enabled_platforms = excluded.enabled_platforms
`);

const supportedPlatformsSet = new Set<string>(SUPPORTED_PLATFORMS);

export function sanitizePlatforms(platforms: unknown): ContestPlatform[] | null {
  if (!Array.isArray(platforms)) {
    return null;
  }

  const seen = new Set<ContestPlatform>();
  const sanitized: ContestPlatform[] = [];

  for (const item of platforms) {
    if (typeof item === "string" && supportedPlatformsSet.has(item)) {
      const platform = item as ContestPlatform;
      if (!seen.has(platform)) {
        seen.add(platform);
        sanitized.push(platform);
      }
    }
  }

  return sanitized;
}

export function getPreferences(): UserPreferences {
  const row = getPreferencesStatement.get() as PreferencesRow | undefined;

  if (!row) {
    savePreferences(DEFAULT_PREFERENCES);
    return {
      enabledPlatforms: [...DEFAULT_PREFERENCES.enabledPlatforms],
    };
  }

  try {
    const parsed = JSON.parse(row.enabled_platforms);
    const sanitized = sanitizePlatforms(parsed);

    if (sanitized === null) {
      return {
        enabledPlatforms: [...DEFAULT_PREFERENCES.enabledPlatforms],
      };
    }

    return {
      enabledPlatforms: sanitized,
    };
  } catch {
    return {
      enabledPlatforms: [...DEFAULT_PREFERENCES.enabledPlatforms],
    };
  }
}

export function savePreferences(preferences: UserPreferences): void {
  const sanitized = sanitizePlatforms(preferences?.enabledPlatforms) ?? [
    ...DEFAULT_PREFERENCES.enabledPlatforms,
  ];

  savePreferencesStatement.run(JSON.stringify(sanitized));
}

export function saveSubmittedPlatforms(rawPlatforms: unknown): UserPreferences {
  const list = Array.isArray(rawPlatforms)
    ? rawPlatforms
    : typeof rawPlatforms === "string"
      ? [rawPlatforms]
      : [];

  const sanitized = sanitizePlatforms(list) ?? [];
  const preferences: UserPreferences = { enabledPlatforms: sanitized };
  savePreferences(preferences);
  return preferences;
}
