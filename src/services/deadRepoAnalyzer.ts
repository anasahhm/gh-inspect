import type {
  GitHubCommit, GitHubIssue, RepoMetadata,
  DeadRepoAnalysis, DeadRepoSignal, DeadVerdict,
} from "../types/index.js";

// Signal thresholds 

const THRESHOLDS = {
  commitDeadDays:     730,  // 2 years no commit = dead
  commitStaleDays:    365,  // 1 year no commit = stale
  commitSlowingDays:  180,  // 6 months = slowing
  issueDeadDays:      365,  // 1 year no issue activity
  issueStaleDays:     180,
  openIssuePileup:    100,  // 100+ open issues with no movement = bad
  prIgnoreRatio:      0.8,  // 80%+ of open "issues" are PRs = PRs being ignored
} as const;

// Main 

export function analyzeDeadRepo(
  commits: GitHubCommit[],
  issues: GitHubIssue[],
  metadata: RepoMetadata
): DeadRepoAnalysis {
  const now = Date.now();

  // Days since last commit 

  const sortedCommits = commits
    .filter(c => c.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastCommitDate = sortedCommits[0]?.date ?? metadata.pushedAt;
  const daysSinceLastCommit = Math.floor(
    (now - new Date(lastCommitDate).getTime()) / 86_400_000
  );

  // Days since last issue activity 

  const allIssueActivity = issues.map(i =>
    Math.max(
      new Date(i.updatedAt).getTime(),
      i.closedAt ? new Date(i.closedAt).getTime() : 0
    )
  );
  const lastIssueActivity = allIssueActivity.length > 0
    ? Math.max(...allIssueActivity)
    : new Date(metadata.updatedAt).getTime();
  const daysSinceLastIssueActivity = Math.floor(
    (now - lastIssueActivity) / 86_400_000
  );

  // Open PR count (issues with PR = true that are open) 
  const openPrs    = issues.filter(i => i.isPullRequest && i.state === "open");
  const openIssues = issues.filter(i => !i.isPullRequest && i.state === "open");
  const openPrCount = openPrs.length;

  // Evaluate each signal 

  const signals: DeadRepoSignal[] = [
    {
      name: "no commits in 2+ years",
      triggered: daysSinceLastCommit >= THRESHOLDS.commitDeadDays,
      detail: `last commit ${daysSinceLastCommit}d ago`,
    },
    {
      name: "no commits in 1 year",
      triggered: daysSinceLastCommit >= THRESHOLDS.commitStaleDays &&
                 daysSinceLastCommit < THRESHOLDS.commitDeadDays,
      detail: `last commit ${daysSinceLastCommit}d ago`,
    },
    {
      name: "no commits in 6 months",
      triggered: daysSinceLastCommit >= THRESHOLDS.commitSlowingDays &&
                 daysSinceLastCommit < THRESHOLDS.commitStaleDays,
      detail: `last commit ${daysSinceLastCommit}d ago`,
    },
    {
      name: "no issue activity in 1 year",
      triggered: daysSinceLastIssueActivity >= THRESHOLDS.issueDeadDays,
      detail: `last issue activity ${daysSinceLastIssueActivity}d ago`,
    },
    {
      name: "stale issue activity (6+ months)",
      triggered: daysSinceLastIssueActivity >= THRESHOLDS.issueStaleDays &&
                 daysSinceLastIssueActivity < THRESHOLDS.issueDeadDays,
      detail: `last issue activity ${daysSinceLastIssueActivity}d ago`,
    },
    {
      name: "open issue pileup",
      triggered: openIssues.length >= THRESHOLDS.openIssuePileup,
      detail: `${openIssues.length} open issues with no sign of triage`,
    },
    {
      name: "unmerged PRs piling up",
      triggered: openPrCount >= 10,
      detail: `${openPrCount} open pull requests being ignored`,
    },
    {
      name: "no license",
      triggered: !metadata.license,
      detail: "no license = no legal clarity for contributors",
    },
  ];

  // Verdict

  const verdict = computeVerdict(daysSinceLastCommit, daysSinceLastIssueActivity, openPrCount);
  const score   = computeDeadScore(daysSinceLastCommit, daysSinceLastIssueActivity, openPrCount, openIssues.length);
  const summary = buildSummary(verdict, daysSinceLastCommit, metadata.fullName);

  return {
    verdict,
    score,
    signals,
    daysSinceLastCommit,
    daysSinceLastIssueActivity,
    openPrCount,
    summary,
  };
}

// Helpers 

function computeVerdict(
  commitDays: number,
  issueDays: number,
  openPrs: number
): DeadVerdict {
  if (commitDays >= THRESHOLDS.commitDeadDays && issueDays >= THRESHOLDS.issueDeadDays)
    return "dead";
  if (commitDays >= THRESHOLDS.commitStaleDays || (issueDays >= THRESHOLDS.issueDeadDays && openPrs > 5))
    return "abandoned";
  if (commitDays >= THRESHOLDS.commitSlowingDays || issueDays >= THRESHOLDS.issueStaleDays)
    return "stale";
  if (commitDays >= 90 || issueDays >= 90)
    return "slowing";
  return "active";
}

function computeDeadScore(
  commitDays: number,
  issueDays: number,
  openPrs: number,
  openIssues: number
): number {
  let score = 10;

  // Commit recency (heaviest signal)
  if (commitDays >= THRESHOLDS.commitDeadDays)      score -= 5;
  else if (commitDays >= THRESHOLDS.commitStaleDays) score -= 3.5;
  else if (commitDays >= THRESHOLDS.commitSlowingDays) score -= 1.5;
  else if (commitDays >= 90)                         score -= 0.5;

  // Issue activity
  if (issueDays >= THRESHOLDS.issueDeadDays)        score -= 2;
  else if (issueDays >= THRESHOLDS.issueStaleDays)   score -= 1;

  // PR pileup
  if (openPrs >= 20)      score -= 2;
  else if (openPrs >= 10) score -= 1;

  // Issue pileup
  if (openIssues >= THRESHOLDS.openIssuePileup) score -= 1;

  return Math.max(0, Math.round(score * 10) / 10);
}

function buildSummary(verdict: DeadVerdict, days: number, name: string): string {
  switch (verdict) {
    case "dead":
      return `${name} shows no signs of life — last activity ${Math.floor(days / 365)}y ago.`;
    case "abandoned":
      return `likely abandoned — last commit ${days}d ago, open PRs piling up.`;
    case "stale":
      return `going stale — ${days}d since last commit. may need a new maintainer.`;
    case "slowing":
      return `activity is slowing — worth watching before depending on this.`;
    case "active":
      return `actively maintained.`;
  }
}
