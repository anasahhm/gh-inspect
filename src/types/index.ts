export interface RepoMetadata {
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssuesCount: number;
  defaultBranch: string;
  language: string | null;
  hasWiki: boolean;
  hasDiscussions: boolean;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  topics: string[];
  subscribersCount: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  labels: string[];
  comments: number;
  isPullRequest: boolean;
}

export interface RepoData {
  metadata: RepoMetadata;
  readme: string | null;
  issues: GitHubIssue[];
  contributorsCount: number;
  owner: string;
  repo: string;
}

export interface ReadmeSection {
  name: string;
  present: boolean;
  required: boolean;
}

export interface ReadmeAnalysis {
  score: number;
  length: number;
  sections: ReadmeSection[];
  missingSections: string[];
  improvements: string[];
  hasCodeExamples: boolean;
  hasBadges: boolean;
  hasImages: boolean;
}

export interface IssueInsights {
  totalOpen: number;
  totalClosed: number;
  openRatio: number;
  averageResponseTimeHours: number | null;
  hasGoodFirstIssue: boolean;
  hasHelpWanted: boolean;
  labelDiversity: number;
  recentActivity: boolean;
  activityLevel: "high" | "moderate" | "low" | "inactive";
}

export interface ScoreBreakdown {
  readme: number;
  issueHealth: number;
  recentActivity: number;
  community: number;
  documentation: number;
}

export interface RepoScore {
  total: number;
  readmeScore: number;
  issueHealthScore: number;
  activityScore: number;
  communityScore: number;
  breakdown: ScoreBreakdown;
}

export interface InspectResult {
  repoScore: RepoScore;
  problems: string[];
  suggestions: string[];
  readmeAnalysis: ReadmeAnalysis;
  issueInsights: IssueInsights;
  aiSuggestions: string[];
  metadata: RepoMetadata;
}

export interface AppConfig {
  githubToken: string;
  openaiApiKey: string;
  useAi: boolean;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}