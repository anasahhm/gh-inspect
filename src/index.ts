import "dotenv/config";
import { GitHubService, parseGitHubUrl } from "./services/githubService.js";
import { analyzeReadme }                  from "./services/readmeAnalyzer.js";
import { analyzeIssues }                  from "./services/issueAnalyzer.js";
import { analyzeDependencyRot }           from "./services/dependencyRotAnalyzer.js";
import { analyzeBurnout }                 from "./services/burnoutAnalyzer.js";
import { analyzeDeadRepo }                from "./services/deadRepoAnalyzer.js";
import { assembleResult }                 from "./services/scoringService.js";
import { AiService }                      from "./services/aiService.js";
import { formatResult }                   from "./utils/formatter.js";
import { logger }                         from "./utils/logger.js";
import type { AppConfig, InspectResult }  from "./types/index.js";
import ora from "ora";

export async function inspectRepo(url: string, config: AppConfig): Promise<InspectResult> {
  const { owner, repo } = parseGitHubUrl(url);

  // Fetch all GitHub data 
  const spin1 = ora({ text: `fetching ${owner}/${repo}…`, color: "cyan" }).start();
  let repoData;
  try {
    repoData = await new GitHubService(config.githubToken).fetchRepoData(owner, repo);
    spin1.succeed(`fetched — ${repoData.issues.length} issues, ${repoData.commits.length} commits`);
  } catch (e) {
    spin1.fail("fetch failed");
    throw e;
  }

  // Run all analyzers in parallel 
  const spin2 = ora({ text: "analyzing…", color: "yellow" }).start();

  const [readmeAnalysis, issueInsights, dependencyRot, burnout] = await Promise.all([
    Promise.resolve(analyzeReadme(repoData.readme)),
    Promise.resolve(analyzeIssues(repoData.issues)),
    analyzeDependencyRot(repoData.packageJson),   // async — hits npm registry
    Promise.resolve(analyzeBurnout(repoData.commits)),
  ]);

  const deadRepo = analyzeDeadRepo(repoData.commits, repoData.issues, repoData.metadata);

  spin2.succeed(
    `analyzed — readme ${readmeAnalysis.score}/10  ·  ` +
    `deps ${dependencyRot.hasPackageJson ? dependencyRot.rotPercent + "% rot" : "no pkg.json"}  ·  ` +
    `vitality: ${deadRepo.verdict}`
  );

  // AI suggestions (optional)
  let aiSuggestions: string[] = [];

  if (config.useAi) {
    const spin3 = ora({ text: "asking AI…", color: "magenta" }).start();
    try {
      aiSuggestions = await new AiService(config.openaiApiKey).generateRepoSuggestions(
        repoData.metadata, readmeAnalysis, issueInsights, dependencyRot, burnout
      );
      spin3.succeed(`${aiSuggestions.length} AI suggestions`);
    } catch (e) {
      spin3.warn("AI unavailable — continuing without it");
      logger.debug(String(e));
    }
  }

  // Assemble + print 
  const result = assembleResult(
    repoData, readmeAnalysis, issueInsights,
    dependencyRot, burnout, deadRepo, aiSuggestions
  );

  formatResult(result, url);
  return result;
}

export function loadConfig(opts: { token?: string; openaiKey?: string; noAi?: boolean }): AppConfig {
  const githubToken  = opts.token     ?? process.env["GITHUB_TOKEN"]    ?? "";
  const openaiApiKey = opts.openaiKey ?? process.env["OPENAI_API_KEY"]  ?? "";

  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required.\nSet it in .env or pass --token <token>.");
  }

  return {
    githubToken,
    openaiApiKey,
    useAi: !opts.noAi && openaiApiKey.length > 0,
  };
}
