import type { ContestPlatform, HistoryEntry } from "./types";
import { getContestHistory } from "./repository";

export type BehavioralInsights = {
  platformDistribution: {
    platform: ContestPlatform;
    count: number;
    percentage: number;
  }[];
  participationRate: {
    totalPlanned: number;
    actualParticipated: number;
    rate: number;
  };
  peakDays: {
    day: number; // 0-6
    count: number;
  }[];
  peakHours: {
    hour: number; // 0-23
    count: number;
  }[];
  sampleSize: number;
};

export function calculateBehavioralInsights(): BehavioralInsights {
  const history = getContestHistory();
  const sampleSize = history.length;

  if (sampleSize === 0) {
    return {
      platformDistribution: [],
      participationRate: { totalPlanned: 0, actualParticipated: 0, rate: 0 },
      peakDays: [],
      peakHours: [],
      sampleSize: 0,
    };
  }

  // 1. Platform Distribution
  const platformCounts: Record<string, number> = {};
  history.forEach(entry => {
    platformCounts[entry.platform] = (platformCounts[entry.platform] || 0) + 1;
  });

  const platformDistribution = Object.entries(platformCounts).map(([platform, count]) => ({
    platform: platform as ContestPlatform,
    count,
    percentage: (count / sampleSize) * 100,
  })).sort((a, b) => b.count - a.count);

  // 2. Participation Rate
  // Note: history only contains records that have a status.
  // "planned" is counted as intended, "participated" as achieved.
  const totalPlanned = history.filter(e => e.status === "planned" || e.status === "participated").length;
  const actualParticipated = history.filter(e => e.status === "participated").length;
  const rate = totalPlanned > 0 ? (actualParticipated / totalPlanned) * 100 : 0;

  // 3. Peak Days
  const dayCounts: Record<number, number> = {};
  history.forEach(entry => {
    const day = entry.startTime.getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const peakDays = Object.entries(dayCounts).map(([day, count]) => ({
    day: parseInt(day),
    count,
  })).sort((a, b) => b.count - a.count);

  // 4. Peak Hours
  const hourCounts: Record<number, number> = {};
  history.forEach(entry => {
    const hour = entry.startTime.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    platformDistribution,
    participationRate: { totalPlanned, actualParticipated, rate },
    peakDays,
    peakHours,
    sampleSize,
  };
}
