import { getUpcomingStoredContests } from "./repository";
import { getPreferences } from "../preferences/repository";
import type { Contest, ContestPlatform } from "./types";

export async function getUpcomingContests(
  platforms?: ContestPlatform[]
): Promise<Contest[]> {
  const enabledPlatforms = platforms ?? (await getPreferences()).enabledPlatforms;
  return getUpcomingStoredContests(enabledPlatforms);
}
