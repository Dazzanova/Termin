import type { Contest } from "./types";

export type ContestChange =
  | {
      type: "added";
      current: Contest;
    }
  | {
      type: "updated";
      previous: Contest;
      current: Contest;
      changes: ContestFieldChange[];
    };

export type ContestFieldChange = {
  field: "name" | "startTime" | "durationSeconds" | "url";
  previous: string | number;
  current: string | number;
};

export function reconcileContests(
  previous: Contest[],
  current: Contest[]
): ContestChange[] {
  const previousById = new Map(
    previous.map((contest) => [contest.id, contest])
  );

  const changes: ContestChange[] = [];

  for (const contest of current) {
    const previousContest = previousById.get(contest.id);

    if (!previousContest) {
      changes.push({
        type: "added",
        current: contest,
      });

      continue;
    }

    const fieldChanges = getFieldChanges(previousContest, contest);

    if (fieldChanges.length > 0) {
      changes.push({
        type: "updated",
        previous: previousContest,
        current: contest,
        changes: fieldChanges,
      });
    }
  }

  return changes;
}

function getFieldChanges(
  previous: Contest,
  current: Contest
): ContestFieldChange[] {
  const changes: ContestFieldChange[] = [];

  if (previous.name !== current.name) {
    changes.push({
      field: "name",
      previous: previous.name,
      current: current.name,
    });
  }

  if (previous.startTime.getTime() !== current.startTime.getTime()) {
    changes.push({
      field: "startTime",
      previous: previous.startTime.toISOString(),
      current: current.startTime.toISOString(),
    });
  }

  if (previous.durationSeconds !== current.durationSeconds) {
    changes.push({
      field: "durationSeconds",
      previous: previous.durationSeconds,
      current: current.durationSeconds,
    });
  }

  if (previous.url !== current.url) {
    changes.push({
      field: "url",
      previous: previous.url,
      current: current.url,
    });
  }

  return changes;
}
