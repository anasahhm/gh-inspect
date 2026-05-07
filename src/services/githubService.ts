import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  RepoData, RepoMetadata, GitHubIssue,
  GitHubCommit, PackageJson, ParsedGitHubUrl,
} from "../types/index.js";

// Raw GitHub shapes 

interface GHRepo {
  full_name: string; description: string | null; stargazers_count: number;
  forks_count: number; open_issues_count: number; default_branch: string;
  language: string | null; has_wiki: boolean; has_discussions: boolean;
  license: { spdx_id: string } | null; created_at: string; updated_at: string;
  pushed_at: string; topics: string[]; subscribers_count: number;
}

interface GHIssue {
  id: number; number: number; title: string; state: string;
  created_at: string; updated_at: string; closed_at: string | null;
  labels: { name: string }[]; comments: number; pull_request?: object;
}

interface GHCommit {
  sha: string;
  commit: { author: { name: string; date: string } | null };
  author: { login: string } | null;
}

interface GHContent {
  content: string;
  encoding: string;
}

// URL parser 

export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const s = url.trim().replace(/\/$/, "");
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^([^/]+)\/([^/]+)$/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m?.[1] && m?.[2]) return { owner: m[1], repo: m[2] };
  }
  throw new Error(`not a valid GitHub URL: "${url}"`);
}

// Service 

export class GitHubService {
  private http: AxiosInstance;

  constructor(token: string) {
    this.http = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gh-inspect/1.0.0",
      },
      timeout: 15000,
    });
  }

  async fetchRepoData(owner: string, repo: string): Promise<RepoData> {
    const [metadata, readme, issues, contributorsCount, commits, packageJson] =
      await Promise.all([
        this.metadata(owner, repo),
        this.readme(owner, repo),
        this.issues(owner, repo),
        this.contributors(owner, repo),
        this.commits(owner, repo),
        this.packageJson(owner, repo),
      ]);
    return { metadata, readme, issues, contributorsCount, owner, repo, commits, packageJson };
  }

  // individual fetchers 

  private async metadata(owner: string, repo: string): Promise<RepoMetadata> {
    try {
      const { data: d } = await this.http.get<GHRepo>(`/repos/${owner}/${repo}`);
      return {
        fullName: d.full_name, description: d.description,
        stars: d.stargazers_count, forks: d.forks_count,
        openIssuesCount: d.open_issues_count, defaultBranch: d.default_branch,
        language: d.language, hasWiki: d.has_wiki, hasDiscussions: d.has_discussions,
        license: d.license?.spdx_id ?? null, createdAt: d.created_at,
        updatedAt: d.updated_at, pushedAt: d.pushed_at,
        topics: d.topics ?? [], subscribersCount: d.subscribers_count,
      };
    } catch (e) { this.bail(e, `${owner}/${repo}`); }
  }

  private async readme(owner: string, repo: string): Promise<string | null> {
    try {
      const { data } = await this.http.get<GHContent>(`/repos/${owner}/${repo}/readme`);
      return data.encoding === "base64"
        ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
        : data.content;
    } catch (e) {
      if (this.is404(e)) return null;
      this.bail(e, "readme");
    }
  }

  private async issues(owner: string, repo: string): Promise<GitHubIssue[]> {
    try {
      const base = `/repos/${owner}/${repo}/issues`;
      const [open, closed] = await Promise.all([
        this.http.get<GHIssue[]>(`${base}?state=open&per_page=20&sort=created&direction=desc`),
        this.http.get<GHIssue[]>(`${base}?state=closed&per_page=20&sort=created&direction=desc`),
      ]);
      const map = (i: GHIssue): GitHubIssue => ({
        id: i.id, number: i.number, title: i.title,
        state: i.state === "open" ? "open" : "closed",
        createdAt: i.created_at, updatedAt: i.updated_at, closedAt: i.closed_at,
        labels: i.labels.map(l => l.name), comments: i.comments,
        isPullRequest: !!i.pull_request,
      });
      return [...open.data.map(map), ...closed.data.map(map)].filter(i => !i.isPullRequest);
    } catch (e) {
      if (this.is404(e)) return [];
      this.bail(e, "issues");
    }
  }

  private async contributors(owner: string, repo: string): Promise<number> {
    try {
      const { data } = await this.http.get(`/repos/${owner}/${repo}/contributors?per_page=1`);
      return Array.isArray(data) ? data.length : 0;
    } catch { return 0; }
  }

  // Fetch last 100 commits - enough for ownership/burnout stats
  async commits(owner: string, repo: string): Promise<GitHubCommit[]> {
    try {
      const { data } = await this.http.get<GHCommit[]>(
        `/repos/${owner}/${repo}/commits?per_page=100`
      );
      return data.map(c => ({
        sha: c.sha,
        author: c.author?.login ?? c.commit.author?.name ?? null,
        date: c.commit.author?.date ?? "",
      }));
    } catch (e) {
      if (this.is404(e)) return [];
      return [];
    }
  }

  // Fetch package.json if it exists (Node/JS repos)
  async packageJson(owner: string, repo: string): Promise<PackageJson | null> {
    try {
      const { data } = await this.http.get<GHContent>(
        `/repos/${owner}/${repo}/contents/package.json`
      );
      const raw = data.encoding === "base64"
        ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
        : data.content;
      return JSON.parse(raw) as PackageJson;
    } catch { return null; }
  }

  // error handling 
  private is404(e: unknown) {
    return e instanceof AxiosError && e.response?.status === 404;
  }

  private bail(e: unknown, ctx: string): never {
    if (e instanceof AxiosError) {
      const s = e.response?.status;
      if (s === 401) throw new Error("GitHub token invalid or missing.");
      if (s === 403) {
        if (e.response?.headers["x-ratelimit-remaining"] === "0")
          throw new Error("GitHub rate limit hit - try again later.");
        throw new Error(`Access forbidden (${ctx}).`);
      }
      if (s === 404) throw new Error("Repo not found - check the URL.");
      throw new Error(`GitHub API ${s ?? "?"} on ${ctx}: ${e.message}`);
    }
    throw new Error(`Unexpected error (${ctx}): ${String(e)}`);
  }
}
