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
  max_contests_per_week: number;
  preferred_days: string;
  preferred_time_windows: string;
  platform_weights: string;
};

const getPreferencesStatement = db.prepare(`
  SELECT
    id,
    enabled_platforms,
    max_contests_per_week,
    preferred_days,
    preferred_time_windows,
    platform_weights
  FROM preferences
  WHERE id = 1
`);

const savePreferencesStatement = db.prepare(`
  INSERT INTO preferences (id, enabled_platforms, max_contests_per_week, preferred_days, preferred_time_windows, platform_weights)
  VALUES (1, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    enabled_platforms = excluded.enabled_platforms,
    max_contests_per_week = excluded.max_contests_per_week,
    preferred_days = excluded.preferred_days,
    preferred_time_windows = excluded.preferred_time_windows,
    platform_weights = excluded.platform_weights
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
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    return {
      enabledPlatforms: sanitizePlatforms(JSON.parse(row.enabled_platforms)) ?? DEFAULT_PREFERENCES.enabledPlatforms,
      maxContestsPerWeek: row.max_contests_per_week ?? DEFAULT_PREFERENCES.maxContestsPerWeek,
      preferredDays: JSON.parse(row.preferred_days) ?? DEFAULT_PREFERENCES.preferredDays,
      preferredTimeWindows: JSON.parse(row.preferred_time_windows) ?? DEFAULT_PREFERENCES.preferredTimeWindows,
      platformWeights: JSON.parse(row.platform_weights) ?? DEFAULT_PREFERENCES.platformWeights,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(
  preferences: Partial<UserPreferences>
): void {
  const sanitized = sanitizePlatforms(preferences?.enabledPlatforms) ?? [
    ...DEFAULT_PREFERENCES.enabledPlatforms,
  ];

  const maxContestsPerWeek =
    typeof preferences?.maxContestsPerWeek === "number" &&
    Number.isFinite(preferences.maxContestsPerWeek) &&
    preferences.maxContestsPerWeek >= 0
      ? Math.floor(preferences.maxContestsPerWeek)
      : DEFAULT_PREFERENCES.maxContestsPerWeek;

  const preferredDays = Array.isArray(preferences?.preferredDays)
    ? preferences.preferredDays.filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6
      )
    : DEFAULT_PREFERENCES.preferredDays;

  const preferredTimeWindows = Array.isArray(
    preferences?.preferredTimeWindows
  )
    ? preferences.preferredTimeWindows.filter(
        (window) =>
          Number.isInteger(window?.start) &&
          Number.isInteger(window?.end) &&
          window.start >= 0 &&
          window.end <= 24
      )
    : DEFAULT_PREFERENCES.preferredTimeWindows;

  const platformWeights =
    preferences?.platformWeights &&
    typeof preferences.platformWeights === "object"
      ? preferences.platformWeights
      : DEFAULT_PREFERENCES.platformWeights;

  savePreferencesStatement.run(
    JSON.stringify(sanitized),
    maxContestsPerWeek,
    JSON.stringify(preferredDays),
    JSON.stringify(preferredTimeWindows),
    JSON.stringify(platformWeights)
  );
}

export function saveSubmittedPlatforms(rawPlatforms: unknown): UserPreferences {
  const list = Array.isArray(rawPlatforms)
    ? rawPlatforms
    : typeof rawPlatforms === "string"
      ? [rawPlatforms]
      : [];

  const sanitized = sanitizePlatforms(list) ?? [];
  const preferences: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    enabledPlatforms: sanitized,
  };
  savePreferences(preferences);
  return preferences;
}
