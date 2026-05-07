import type {
  RepoData, ReadmeAnalysis, IssueInsights,
  DependencyRotAnalysis, BurnoutAnalysis, DeadRepoAnalysis,
  RepoScore, ScoreBreakdown, InspectResult,
} from "../types/index.js";

// Final score 

export function computeScore(
  repo: RepoData,
  readme: ReadmeAnalysis,
  issues: IssueInsights,
  depRot: DependencyRotAnalysis,
  burnout: BurnoutAnalysis,
): RepoScore {
  const breakdown: ScoreBreakdown = {
    readme:        readme.score,
    issueHealth:   issueHealthScore(issues),
    recentActivity: activityScore(repo),
    community:     communityScore(repo, issues),
    documentation: Math.min(10, readme.score * 0.7 + (repo.metadata.hasWiki ? 1 : 0)),
    dependencyRot: depRot.hasPackageJson ? depRot.score : 5, // neutral if no pkg.json
    burnout:       burnout.score,
  };

  // Weights — new features carry real weight
  const total =
    breakdown.readme        * 0.22 +
    breakdown.issueHealth   * 0.18 +
    breakdown.recentActivity * 0.15 +
    breakdown.community     * 0.12 +
    breakdown.documentation * 0.08 +
    breakdown.dependencyRot * 0.13 +
    breakdown.burnout       * 0.12;

  return { total: Math.min(10, Math.round(total * 10) / 10), breakdown };
}

// Problems

export function generateProblems(
  repo: RepoData,
  readme: ReadmeAnalysis,
  issues: IssueInsights,
  depRot: DependencyRotAnalysis,
  burnout: BurnoutAnalysis,
  dead: DeadRepoAnalysis,
): string[] {
  const p: string[] = [];

  // README
  if (readme.score === 0)      p.push("No README found.");
  else if (readme.score < 4)   p.push("README is too thin — barely documents the project.");
  readme.missingSections.forEach(s => p.push(`README missing: ${s}.`));

  // Issues
  if (issues.openRatio > 0.7 && issues.totalOpen > 5)
    p.push(`${(issues.openRatio * 100).toFixed(0)}% of issues are open — not being worked on.`);
  if (issues.averageResponseTimeHours !== null && issues.averageResponseTimeHours > 336)
    p.push(`Average issue response time is ${(issues.averageResponseTimeHours / 168).toFixed(1)} weeks.`);
  if (!issues.hasGoodFirstIssue && issues.totalOpen > 0)
    p.push('No "good first issue" labels — new contributors have no entry point.');

  // Dependency rot
  if (depRot.hasPackageJson) {
    if (depRot.majorBehind >= 5)   p.push(`${depRot.majorBehind} deps are multiple major versions behind.`);
    else if (depRot.rotPercent > 50) p.push(`${depRot.rotPercent}% of dependencies are outdated.`);
  }

  // Burnout
  if (burnout.abandonRisk)
    p.push(`Abandon risk: sole maintainer (${burnout.topOwnershipPercent}% of commits) has gone quiet.`);
  else if (burnout.busFactorRisk)
    p.push(`Bus factor risk: one person owns ${burnout.topOwnershipPercent}% of all commits.`);

  // Dead repo
  if (dead.verdict === "dead" || dead.verdict === "abandoned")
    p.push(`Repo appears ${dead.verdict}: ${dead.summary}`);
  else if (dead.verdict === "stale")
    p.push(`Repo is going stale — ${dead.daysSinceLastCommit} days since last commit.`);

  // General
  if (!repo.metadata.license) p.push("No license — legally risky to use in production.");

  return p;
}

// Suggestions 

export function generateSuggestions(
  repo: RepoData,
  readme: ReadmeAnalysis,
  issues: IssueInsights,
  depRot: DependencyRotAnalysis,
  burnout: BurnoutAnalysis,
): string[] {
  const s: string[] = [];

  readme.improvements.forEach(i => s.push(i));

  if (!issues.hasGoodFirstIssue)
    s.push('Tag some approachable issues as "good first issue".');
  if (!issues.hasHelpWanted)
    s.push('Add "help wanted" labels to issues needing community help.');
  if (!repo.metadata.license)
    s.push("Pick an open-source license (MIT is the easiest starting point).");
  if (repo.metadata.topics.length === 0)
    s.push("Add GitHub topics to improve discoverability.");

  if (depRot.hasPackageJson && depRot.majorBehind > 0)
    s.push(`Run \`npm outdated\` and update the ${depRot.majorBehind} major-version gaps.`);
  if (depRot.hasPackageJson && depRot.rotPercent > 30)
    s.push("Consider using Renovate or Dependabot to automate dependency updates.");

  if (burnout.busFactorRisk)
    s.push("Document architecture and onboard a second maintainer to reduce bus factor.");
  if (burnout.maintainerAbsent)
    s.push("Main contributor is absent — consider posting a call for co-maintainers.");

  return [...new Set(s)].slice(0, 10);
}

// Assembler 

export function assembleResult(
  repo: RepoData,
  readme: ReadmeAnalysis,
  issues: IssueInsights,
  depRot: DependencyRotAnalysis,
  burnout: BurnoutAnalysis,
  dead: DeadRepoAnalysis,
  aiSuggestions: string[],
): InspectResult {
  const repoScore  = computeScore(repo, readme, issues, depRot, burnout);
  const problems   = generateProblems(repo, readme, issues, depRot, burnout, dead);
  const suggestions = generateSuggestions(repo, readme, issues, depRot, burnout);

  return {
    repoScore, problems, suggestions,
    readmeAnalysis: readme,
    issueInsights: issues,
    dependencyRot: depRot,
    burnout,
    deadRepo: dead,
    aiSuggestions,
    metadata: repo.metadata,
  };
}

// Sub-scores 

function issueHealthScore(i: IssueInsights): number {
  let s = 10;
  if (i.openRatio > 0.8)      s -= 4;
  else if (i.openRatio > 0.6) s -= 2;
  else if (i.openRatio > 0.4) s -= 1;
  if (i.averageResponseTimeHours !== null) {
    if (i.averageResponseTimeHours > 720)      s -= 3;
    else if (i.averageResponseTimeHours > 168) s -= 1.5;
    else if (i.averageResponseTimeHours > 72)  s -= 0.5;
  }
  if (i.hasGoodFirstIssue) s = Math.min(10, s + 0.5);
  if (i.hasHelpWanted)     s = Math.min(10, s + 0.5);
  return Math.max(0, Math.round(s * 10) / 10);
}

function activityScore(r: RepoData): number {
  const days = (Date.now() - new Date(r.metadata.pushedAt).getTime()) / 86_400_000;
  let s = 10;
  if (days > 365)      s -= 5;
  else if (days > 180) s -= 3;
  else if (days > 90)  s -= 1.5;
  else if (days > 30)  s -= 0.5;
  if (r.metadata.stars > 100) s = Math.min(10, s + 0.5);
  if (r.metadata.forks > 20)  s = Math.min(10, s + 0.5);
  return Math.max(0, Math.round(s * 10) / 10);
}

function communityScore(r: RepoData, i: IssueInsights): number {
  let s = 0;
  if (r.metadata.license)         s += 2;
  if (r.contributorsCount > 1)    s += 2;
  if (r.contributorsCount > 5)    s += 1;
  if (i.hasGoodFirstIssue)        s += 1;
  if (i.hasHelpWanted)            s += 1;
  if (r.metadata.topics.length)   s += 1;
  if (r.metadata.hasWiki)         s += 0.5;
  if (r.metadata.hasDiscussions)  s += 0.5;
  if (r.metadata.description)     s += 1;
  return Math.min(10, Math.round(s * 10) / 10);
}
