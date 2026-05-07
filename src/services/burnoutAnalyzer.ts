import type { GitHubCommit, BurnoutAnalysis, ContributorStat } from "../types/index.js";

const ABSENT_THRESHOLD_DAYS  = 60;   // gone for 2+ months = absent
const BUS_FACTOR_THRESHOLD   = 0.70; // 1 person owns 70%+ = bus factor risk

// Main 

export function analyzeBurnout(commits: GitHubCommit[]): BurnoutAnalysis {
  if (commits.length === 0) {
    return {
      score: 5,
      totalCommitsAnalyzed: 0,
      topContributors: [],
      busFactorRisk: false,
      topOwnershipPercent: 0,
      maintainerAbsent: false,
      abandonRisk: false,
      verdict: "no commit history available to analyze.",
    };
  }

  // Tally commits per author 

  const tally = new Map<string, { count: number; dates: string[] }>();

  for (const c of commits) {
    const author = c.author ?? "unknown";
    const existing = tally.get(author) ?? { count: 0, dates: [] };
    existing.count++;
    if (c.date) existing.dates.push(c.date);
    tally.set(author, existing);
  }

  const total = commits.length;
  const now   = Date.now();

  // Build contributor stats 

  const stats: ContributorStat[] = Array.from(tally.entries())
    .map(([login, { count, dates }]) => {
      const sorted = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastCommitDate      = sorted[0] ?? "";
      const daysSinceLastCommit = lastCommitDate
        ? Math.floor((now - new Date(lastCommitDate).getTime()) / 86_400_000)
        : 999;

      return {
        login,
        commits: count,
        sharePercent: Math.round((count / total) * 100),
        lastCommitDate,
        daysSinceLastCommit,
        isAbsent: daysSinceLastCommit > ABSENT_THRESHOLD_DAYS,
      };
    })
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5); // show top 5

  // Key signals 

  const top = stats[0];
  const topOwnershipPercent = top?.sharePercent ?? 0;
  const busFactorRisk       = topOwnershipPercent >= BUS_FACTOR_THRESHOLD * 100;
  const maintainerAbsent    = top?.isAbsent ?? false;
  const abandonRisk         = busFactorRisk && maintainerAbsent;

  // Score 
  // Start at 10, subtract for concentration and absence

  let score = 10;

  // Ownership concentration penalty
  if (topOwnershipPercent >= 90)      score -= 4;
  else if (topOwnershipPercent >= 70) score -= 2.5;
  else if (topOwnershipPercent >= 50) score -= 1;

  // Absence penalty
  if (maintainerAbsent) {
    const daysGone = top?.daysSinceLastCommit ?? 0;
    if (daysGone > 365)      score -= 4;
    else if (daysGone > 180) score -= 2.5;
    else if (daysGone > 90)  score -= 1.5;
    else                     score -= 0.5;
  }

  // Healthy spread bonus — if top contributor owns <40%, healthy community
  if (topOwnershipPercent < 40 && stats.length >= 3) score = Math.min(10, score + 1);

  score = Math.max(0, Math.round(score * 10) / 10);

  const verdict = buildVerdict(
    topOwnershipPercent, maintainerAbsent, abandonRisk,
    top?.daysSinceLastCommit ?? 0, stats.length
  );

  return {
    score,
    totalCommitsAnalyzed: total,
    topContributors: stats,
    busFactorRisk,
    topOwnershipPercent,
    maintainerAbsent,
    abandonRisk,
    verdict,
  };
}

// Helpers

function buildVerdict(
  topPercent: number,
  absent: boolean,
  abandonRisk: boolean,
  daysSince: number,
  contributorCount: number
): string {
  if (abandonRisk) {
    return `high abandon risk - sole maintainer (${topPercent}% of commits) has been gone ${daysSince}d.`;
  }
  if (absent && topPercent >= 50) {
    return `bus factor risk - dominant contributor absent for ${daysSince} days.`;
  }
  if (topPercent >= 70) {
    return `1 person drives ${topPercent}% of this repo - bus factor is real but maintainer is active.`;
  }
  if (contributorCount >= 5 && topPercent < 50) {
    return `healthy contributor spread across ${contributorCount}+ people.`;
  }
  return `moderate concentration - top contributor owns ${topPercent}% of commits.`;
}
