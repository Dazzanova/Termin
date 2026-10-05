import { getUpcomingStoredContests } from "./repository";
import { getPreferences } from "../preferences/repository";
import type { Contest, ContestPlatform } from "./types";

export function getUpcomingContests(
  platforms?: ContestPlatform[]
): Contest[] {
  const enabledPlatforms =
    platforms ?? getPreferences().enabledPlatforms;
  return getUpcomingStoredContests(enabledPlatforms);
}
