import type {
  RepoData,
  ReadmeAnalysis,
  IssueInsights,
  RepoScore,
  ScoreBreakdown,
  InspectResult,
} from "../types/index.js";


// Scoring Service

export function computeScore(
  repoData: RepoData,
  readmeAnalysis: ReadmeAnalysis,
  issueInsights: IssueInsights
): RepoScore {
  const readmeScore = computeReadmeScore(readmeAnalysis);
  const issueHealthScore = computeIssueHealthScore(issueInsights);
  const activityScore = computeActivityScore(repoData);
  const communityScore = computeCommunityScore(repoData, issueInsights);
  const documentationScore = computeDocumentationScore(repoData, readmeAnalysis);

  const breakdown: ScoreBreakdown = {
    readme: readmeScore,
    issueHealth: issueHealthScore,
    recentActivity: activityScore,
    community: communityScore,
    documentation: documentationScore,
  };

  // Weighted average
  const total =
    readmeScore * 0.3 +
    issueHealthScore * 0.25 +
    activityScore * 0.2 +
    communityScore * 0.15 +
    documentationScore * 0.1;

  return {
    total: Math.min(10, Math.round(total * 10) / 10),
    readmeScore,
    issueHealthScore,
    activityScore,
    communityScore,
    breakdown,
  };
}


// Problems & Suggestions Generators


export function generateProblems(
  repoData: RepoData,
  readmeAnalysis: ReadmeAnalysis,
  issueInsights: IssueInsights
): string[] {
  const problems: string[] = [];

  // README problems

  if (readmeAnalysis.score === 0) {
    problems.push("No README file found — repository is essentially undocumented.");
  } else if (readmeAnalysis.score < 4) {
    problems.push("README is minimal and lacks critical sections.");
  }

  readmeAnalysis.missingSections.forEach((section) => {
    problems.push(`README is missing a "${section}" section.`);
  });

  if (!readmeAnalysis.hasCodeExamples && readmeAnalysis.score > 0) {
    problems.push("README contains no code examples or usage snippets.");
  }

  // Issue problems

  if (issueInsights.openRatio > 0.7 && issueInsights.totalOpen > 5) {
    problems.push(
      `High open issue ratio (${(issueInsights.openRatio * 100).toFixed(0)}%) — issues are not being resolved.`
    );
  }

  if (
    issueInsights.averageResponseTimeHours !== null &&
    issueInsights.averageResponseTimeHours > 336 // 2 weeks
  ) {
    const weeks = (issueInsights.averageResponseTimeHours / 168).toFixed(1);
    problems.push(`Slow average issue response time: ~${weeks} weeks.`);
  }

  if (!issueInsights.hasGoodFirstIssue && issueInsights.totalOpen > 0) {
    problems.push('No "good first issue" labels — hard for new contributors to get started.');
  }

  // Activity problems

  const daysSinceActivity = daysSince(repoData.metadata.pushedAt);
  if (daysSinceActivity > 365) {
    problems.push(`Repository has not been updated in ${Math.floor(daysSinceActivity / 30)} months — may be abandoned.`);
  } else if (daysSinceActivity > 180) {
    problems.push(`Repository has low activity — last push was ${Math.floor(daysSinceActivity / 30)} months ago.`);
  }

  // Community problems

  if (!repoData.metadata.license) {
    problems.push("No open-source license specified — restricts adoption and contribution.");
  }

  if (issueInsights.activityLevel === "inactive") {
    problems.push("Issue tracker shows no recent activity.");
  }

  return problems;
}

export function generateSuggestions(
  repoData: RepoData,
  readmeAnalysis: ReadmeAnalysis,
  issueInsights: IssueInsights
): string[] {
  const suggestions: string[] = [];

  // README suggestions

  readmeAnalysis.improvements.forEach((imp) => suggestions.push(imp));

  // Issue suggestions

  if (!issueInsights.hasGoodFirstIssue) {
    suggestions.push('Label beginner-friendly issues with "good first issue" to attract new contributors.');
  }

  if (!issueInsights.hasHelpWanted) {
    suggestions.push('Use "help wanted" labels to signal which issues need community assistance.');
  }

  if (issueInsights.labelDiversity < 3) {
    suggestions.push("Add diverse issue labels (bug, enhancement, documentation) to improve triage.");
  }

  // Community suggestions

  if (!repoData.metadata.license) {
    suggestions.push("Add an open-source license (e.g., MIT, Apache 2.0) to clarify usage rights.");
  }

  if (repoData.contributorsCount <= 1) {
    suggestions.push("Add a CONTRIBUTING.md with clear guidelines to encourage community contributions.");
  }

  if (repoData.metadata.topics.length === 0) {
    suggestions.push("Add GitHub topics to improve discoverability of the repository.");
  }

  if (!repoData.metadata.description) {
    suggestions.push("Add a repository description on GitHub for immediate clarity.");
  }

  // Remove suggestions already covered in problems to avoid duplication

  return [...new Set(suggestions)].slice(0, 8);
}


// Score Components


function computeReadmeScore(readme: ReadmeAnalysis): number {
  return readme.score;
}

function computeIssueHealthScore(insights: IssueInsights): number {
  let score = 10;

  // High open ratio

  if (insights.openRatio > 0.8) score -= 4;
  else if (insights.openRatio > 0.6) score -= 2;
  else if (insights.openRatio > 0.4) score -= 1;

  // Penalize slow response
  if (insights.averageResponseTimeHours !== null) {
    if (insights.averageResponseTimeHours > 720) score -= 3; // 30 days
    else if (insights.averageResponseTimeHours > 168) score -= 1.5; // 1 week
    else if (insights.averageResponseTimeHours > 72) score -= 0.5; // 3 days
  }

  // Bonus for contributor-friendly labels

  if (insights.hasGoodFirstIssue) score = Math.min(10, score + 0.5);
  if (insights.hasHelpWanted) score = Math.min(10, score + 0.5);

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function computeActivityScore(repoData: RepoData): number {
  const daysSincePush = daysSince(repoData.metadata.pushedAt);
  const daysSinceUpdate = daysSince(repoData.metadata.updatedAt);

  let score = 10;

  if (daysSincePush > 365) score -= 5;
  else if (daysSincePush > 180) score -= 3;
  else if (daysSincePush > 90) score -= 1.5;
  else if (daysSincePush > 30) score -= 0.5;

  if (daysSinceUpdate > 60) score -= 1;


  // Stars/forks as signal of active interest

  if (repoData.metadata.stars > 100) score = Math.min(10, score + 0.5);
  if (repoData.metadata.forks > 20) score = Math.min(10, score + 0.5);

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function computeCommunityScore(
  repoData: RepoData,
  insights: IssueInsights
): number {
  let score = 0;

  if (repoData.metadata.license) score += 2;
  if (repoData.contributorsCount > 1) score += 2;
  if (repoData.contributorsCount > 5) score += 1;
  if (insights.hasGoodFirstIssue) score += 1;
  if (insights.hasHelpWanted) score += 1;
  if (repoData.metadata.topics.length > 0) score += 1;
  if (repoData.metadata.hasWiki) score += 0.5;
  if (repoData.metadata.hasDiscussions) score += 0.5;
  if (repoData.metadata.description) score += 1;

  return Math.min(10, Math.round(score * 10) / 10);
}

function computeDocumentationScore(
  repoData: RepoData,
  readme: ReadmeAnalysis
): number {
  let score = readme.score * 0.7;

  if (repoData.metadata.hasWiki) score += 1;
  if (repoData.metadata.topics.length >= 3) score += 0.5;

  return Math.min(10, Math.round(score * 10) / 10);
}


// Result Assembler


export function assembleResult(
  repoData: RepoData,
  readmeAnalysis: ReadmeAnalysis,
  issueInsights: IssueInsights,
  aiSuggestions: string[]
): InspectResult {
  const repoScore = computeScore(repoData, readmeAnalysis, issueInsights);
  const problems = generateProblems(repoData, readmeAnalysis, issueInsights);
  const suggestions = generateSuggestions(repoData, readmeAnalysis, issueInsights);

  return {
    repoScore,
    problems,
    suggestions,
    readmeAnalysis,
    issueInsights,
    aiSuggestions,
    metadata: repoData.metadata,
  };
}


// Utility


function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms / (1000 * 60 * 60 * 24);
}
