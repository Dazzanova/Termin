import type { Contest, ContestPlatform } from "./types";
import type { UserPreferences } from "../preferences/types";
import { getParticipationStatus, getContestHistory } from "./repository";

export type RecommendationReason =
  | "Matches your preferred platform"
  | "Starts during one of your preferred time windows"
  | "Fits your remaining weekly capacity"
  | "Conflicts with another prioritized contest"
  | "High historical participation on this platform"
  | "Matches your preferred weekday";

export type Recommendation = {
  contest: Contest;
  score: number;
  reasons: RecommendationReason[];
  isConflict: boolean;
  priorityLabel: "High" | "Medium" | "Low" | "None";
};

export function calculateRecommendations(
  contests: Contest[],
  preferences: UserPreferences,
  prioritizedIds: Set<string> = new Set()
): Recommendation[] {
  const history = getContestHistory();
  const platformParticipationCounts: Record<string, number> = {};

  history.forEach(entry => {
    platformParticipationCounts[entry.platform] = (platformParticipationCounts[entry.platform] || 0) + 1;
  });

  const recommendations = contests.map(contest => {
    let score = 0;
    const reasons: RecommendationReason[] = [];
    let isConflict = false;

    // 1. Platform Weight
    const weight = preferences.platformWeights[contest.platform] || 0;
    if (weight > 0) {
      score += weight;
      reasons.push("Matches your preferred platform");
    }

    // 2. Preferred Day
    const day = contest.startTime.getDay();
    if (preferences.preferredDays.includes(day)) {
      score += 10;
      reasons.push("Matches your preferred weekday");
    }

    // 3. Preferred Time Window
    const hour = contest.startTime.getHours();
    const fitsWindow = preferences.preferredTimeWindows.some(
      window => hour >= window.start && hour < window.end
    );
    if (fitsWindow) {
      score += 15;
      reasons.push("Starts during one of your preferred time windows");
    }

    // 4. Historical Participation
    const platformCount = platformParticipationCounts[contest.platform] || 0;
    if (platformCount >= 3) {
      score += 5;
      reasons.push("High historical participation on this platform");
    }

    // 5. Conflict Detection
    const hasConflict = contests.some(other => {
      if (other.id === contest.id) return false;
      if (!prioritizedIds.has(other.id)) return false;

      const startA = contest.startTime.getTime();
      const endA = startA + contest.durationSeconds * 1000;
      const startB = other.startTime.getTime();
      const endB = startB + other.durationSeconds * 1000;

      return startA < endB && startB < endA;
    });

    if (hasConflict) {
      isConflict = true;
      score -= 50;
      reasons.push("Conflicts with another prioritized contest");
    }

    // 6. Participation Status
    const status = getParticipationStatus(contest.id);
    if (status === 'planned') {
      score += 20;
    }

    // Priority Label
    let priorityLabel: Recommendation["priorityLabel"] = "None";
    if (score >= 30) priorityLabel = "High";
    else if (score >= 15) priorityLabel = "Medium";
    else if (score >= 0) priorityLabel = "Low";

    return {
      contest,
      score,
      reasons,
      isConflict,
      priorityLabel
    };
  });

  // Stable tie-breaking: by score desc, then by startTime asc, then by id
  return recommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.contest.startTime.getTime() !== b.contest.startTime.getTime()) {
      return a.contest.startTime.getTime() - b.contest.startTime.getTime();
    }
    return a.contest.id.localeCompare(b.contest.id);
  });
}

export function getWeeklyCapacity(
  contests: Contest[],
  prioritizedIds: Set<string>,
  preferences: UserPreferences
): { remaining: number; total: number } {
  // Count prioritized contests for the current week
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const plannedThisWeek = contests.filter(c => {
    const time = c.startTime.getTime();
    return time >= startOfWeek.getTime() &&
           time < endOfWeek.getTime() &&
           prioritizedIds.has(c.id);
  }).length;

  return {
    remaining: Math.max(0, preferences.maxContestsPerWeek - plannedThisWeek),
    total: preferences.maxContestsPerWeek
  };
}
