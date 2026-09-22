import type { Contest } from "./types";
import { getAtCoderContests } from "./providers/atcoder";
import { getCodeforcesContests } from "./providers/codeforces";
import { getCodeChefContests } from "./providers/codechef";

type ContestProvider = {
  name: string;
  getContests: () => Promise<Contest[]>;
};

const providers: ContestProvider[] = [
  {
    name: "codeforces",
    getContests: getCodeforcesContests,
  },
  {
    name: "atcoder",
    getContests: getAtCoderContests,
  },
  {
    name: "codechef",
    getContests: getCodeChefContests,
  },
];

export async function getUpcomingContests(): Promise<Contest[]> {
  const results = await Promise.allSettled(
    providers.map((provider) => provider.getContests())
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to fetch ${providers[index].name} contests:`,
        result.reason
      );
    }
  });

  return results
    .flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
