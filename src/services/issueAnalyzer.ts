import type { GitHubIssue, IssueInsights } from "../types/index.js";

export function analyzeIssues(issues: GitHubIssue[]): IssueInsights {
  const real    = issues.filter(i => !i.isPullRequest);
  const open    = real.filter(i => i.state === "open");
  const closed  = real.filter(i => i.state === "closed");
  const total   = open.length + closed.length;
  const openRatio = total > 0 ? open.length / total : 0;

  const allLabels = real.flatMap(i => i.labels.map(l => l.toLowerCase()));
  const hasGoodFirstIssue = allLabels.some(l => l.includes("good first issue") || l.includes("beginner"));
  const hasHelpWanted     = allLabels.some(l => l.includes("help wanted"));
  const labelDiversity    = new Set(allLabels).size;

  const avgResponse = avgResponseTime(closed);

  const thirtyDaysAgo  = Date.now() - 30 * 86_400_000;
  const recentActivity = real.some(i => new Date(i.updatedAt).getTime() > thirtyDaysAgo);

  return {
    totalOpen: open.length,
    totalClosed: closed.length,
    openRatio,
    averageResponseTimeHours: avgResponse,
    hasGoodFirstIssue,
    hasHelpWanted,
    labelDiversity,
    recentActivity,
    activityLevel: activityLevel(real.filter(i => new Date(i.updatedAt).getTime() > thirtyDaysAgo).length, total, openRatio, avgResponse),
  };
}

function avgResponseTime(closed: GitHubIssue[]): number | null {
  const with_ = closed.filter(i => i.closedAt);
  if (!with_.length) return null;
  const totalH = with_.reduce((acc, i) => {
    return acc + (new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000;
  }, 0);
  return Math.round((totalH / with_.length) * 10) / 10;
}

function activityLevel(
  recent: number, total: number,
  openRatio: number, avgH: number | null
): IssueInsights["activityLevel"] {
  if (total === 0) return "inactive";
  let s = 0;
  if (recent >= 5) s += 3; else if (recent >= 2) s += 2; else if (recent >= 1) s += 1;
  if (openRatio < 0.3) s += 2; else if (openRatio < 0.5) s += 1;
  if (avgH !== null) {
    if (avgH < 24) s += 2; else if (avgH < 168) s += 1;
  }
  if (s >= 6) return "high";
  if (s >= 3) return "moderate";
  if (s >= 1) return "low";
  return "inactive";
}
