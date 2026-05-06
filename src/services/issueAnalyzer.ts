import type { GitHubIssue, IssueInsights } from "../types/index.js";


// Issue Analyzer


export function analyzeIssues(issues: GitHubIssue[]): IssueInsights {
  const realIssues = issues.filter((i) => !i.isPullRequest);

  const openIssues = realIssues.filter((i) => i.state === "open");
  const closedIssues = realIssues.filter((i) => i.state === "closed");

  const totalOpen = openIssues.length;
  const totalClosed = closedIssues.length;
  const totalAll = totalOpen + totalClosed;

  const openRatio = totalAll > 0 ? totalOpen / totalAll : 0;

  // Average response time 

  const averageResponseTimeHours = computeAverageResponseTime(closedIssues);

  // Label analysis 

  const allLabels = realIssues.flatMap((i) => i.labels.map((l) => l.toLowerCase()));

  const hasGoodFirstIssue = allLabels.some(
    (l) =>
      l.includes("good first issue") ||
      l.includes("good-first-issue") ||
      l.includes("beginner") ||
      l.includes("starter")
  );

  const hasHelpWanted = allLabels.some(
    (l) => l.includes("help wanted") || l.includes("help-wanted")
  );

  const uniqueLabels = new Set(allLabels);
  const labelDiversity = uniqueLabels.size;

  // Recent activity 

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentIssues = realIssues.filter(
    (i) => new Date(i.updatedAt).getTime() > thirtyDaysAgo
  );
  const recentActivity = recentIssues.length > 0;

  // Activity level 

  const activityLevel = computeActivityLevel(
    recentIssues.length,
    totalAll,
    openRatio,
    averageResponseTimeHours
  );

  return {
    totalOpen,
    totalClosed,
    openRatio,
    averageResponseTimeHours,
    hasGoodFirstIssue,
    hasHelpWanted,
    labelDiversity,
    recentActivity,
    activityLevel,
  };
}

// Helpers

function computeAverageResponseTime(
  closedIssues: GitHubIssue[]
): number | null {
  const withResponse = closedIssues.filter((i) => i.closedAt !== null);

  if (withResponse.length === 0) return null;

  const totalHours = withResponse.reduce((acc, issue) => {
    const created = new Date(issue.createdAt).getTime();
    const closed = new Date(issue.closedAt!).getTime();
    const diffHours = (closed - created) / (1000 * 60 * 60);
    return acc + diffHours;
  }, 0);

  return Math.round((totalHours / withResponse.length) * 10) / 10;
}

function computeActivityLevel(
  recentCount: number,
  totalCount: number,
  openRatio: number,
  avgResponseHours: number | null
): IssueInsights["activityLevel"] {
  if (totalCount === 0) return "inactive";

  let score = 0;

  // Recent activity

  if (recentCount >= 5) score += 3;
  else if (recentCount >= 2) score += 2;
  else if (recentCount >= 1) score += 1;

  // Open ratio (lower is better — issues are being resolved)

  if (openRatio < 0.3) score += 2;
  else if (openRatio < 0.5) score += 1;

  // Response time

  if (avgResponseHours !== null) {
    if (avgResponseHours < 24) score += 2;
    else if (avgResponseHours < 168) score += 1;
  }

  if (score >= 6) return "high";
  if (score >= 3) return "moderate";
  if (score >= 1) return "low";
  return "inactive";
}
