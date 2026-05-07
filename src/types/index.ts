// GitHub raw data 

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

export interface GitHubCommit {
  sha: string;
  author: string | null;
  date: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface RepoData {
  metadata: RepoMetadata;
  readme: string | null;
  issues: GitHubIssue[];
  contributorsCount: number;
  owner: string;
  repo: string;
  commits: GitHubCommit[];
  packageJson: PackageJson | null;
}

// Analysis results 

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

// Dependency rot 

export type DepStatus = "current" | "outdated" | "majorBehind" | "unknown";

export interface DepResult {
  name: string;
  declared: string;
  latest: string | null;
  current: string | null;
  status: DepStatus;
  majorsBehind: number;
}

export interface DependencyRotAnalysis {
  score: number;
  totalChecked: number;
  current: number;
  outdated: number;
  majorBehind: number;
  unknown: number;
  rotPercent: number;
  deps: DepResult[];
  verdict: string;
  hasPackageJson: boolean;
}

// Contributor burnout 

export interface ContributorStat {
  login: string;
  commits: number;
  sharePercent: number;
  lastCommitDate: string;
  daysSinceLastCommit: number;
  isAbsent: boolean;
}

export interface BurnoutAnalysis {
  score: number;
  totalCommitsAnalyzed: number;
  topContributors: ContributorStat[];
  busFactorRisk: boolean;
  topOwnershipPercent: number;
  maintainerAbsent: boolean;
  abandonRisk: boolean;
  verdict: string;
}

// Dead repo detector 

export type DeadVerdict = "active" | "slowing" | "stale" | "abandoned" | "dead";

export interface DeadRepoSignal {
  name: string;
  triggered: boolean;
  detail: string;
}

export interface DeadRepoAnalysis {
  verdict: DeadVerdict;
  score: number;
  signals: DeadRepoSignal[];
  daysSinceLastCommit: number;
  daysSinceLastIssueActivity: number;
  openPrCount: number;
  summary: string;
}

// Scoring 

export interface ScoreBreakdown {
  readme: number;
  issueHealth: number;
  recentActivity: number;
  community: number;
  documentation: number;
  dependencyRot: number;
  burnout: number;
}

export interface RepoScore {
  total: number;
  breakdown: ScoreBreakdown;
}

// Final result 

export interface InspectResult {
  repoScore: RepoScore;
  problems: string[];
  suggestions: string[];
  readmeAnalysis: ReadmeAnalysis;
  issueInsights: IssueInsights;
  dependencyRot: DependencyRotAnalysis;
  burnout: BurnoutAnalysis;
  deadRepo: DeadRepoAnalysis;
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
