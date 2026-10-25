export type TrainingPlatform = "codeforces";

export type Problem = {
  id: string;
  platform: TrainingPlatform;
  contestId: string;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  url: string;
};

export type Submission = {
  id: string;
  platform: TrainingPlatform;
  problemId: string;
  verdict: string;
  submittedAt: Date;
};

export type ReviewStatus = "due" | "scheduled" | "done" | "dropped";

export type ReviewAction = "solved" | "again" | "drop";

export type ProblemReview = {
  problemId: string;
  status: ReviewStatus;
  dueAt: Date;
  intervalDays: number;
  attempts: number;
  updatedAt: Date;
};

export type ReviewEntry = {
  review: ProblemReview;
  problem: Problem;
};

export type TrainingAccount = {
  platform: TrainingPlatform;
  handle: string;
  linkedAt: Date;
};

export type ImportSummary = {
  problems: number;
  submissions: number;
  solved: number;
  closedReviews: number;
  queuedReviews: number;
  importedAt: Date;
};
