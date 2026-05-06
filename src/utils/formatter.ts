import chalk from "chalk";
import type { InspectResult, RepoScore } from "../types/index.js";

// Primitives 

function bar(score: number, width = 16): string {
  const filled = Math.round((score / 10) * width);
  return chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(width - filled));
}

function scoreColor(score: number): string {
  const s = score.toFixed(1);
  if (score >= 7.5) return chalk.greenBright(s);
  if (score >= 5)   return chalk.yellowBright(s);
  return chalk.redBright(s);
}

function dim(s: string)   { return chalk.dim(s); }
function label(s: string) { return chalk.white(s.padEnd(22)); }

// Section heading 

function heading(title: string) {
  console.log();
  console.log(chalk.bold.white(title));
  console.log(chalk.dim("─".repeat(48)));
}

// Main 

export function formatResult(result: InspectResult, url: string): void {
  const { repoScore, problems, suggestions, readmeAnalysis, issueInsights, aiSuggestions, metadata } = result;

  // Header

  console.log();
  console.log(chalk.bold.white("gh-inspect") + dim("  " + url));
  console.log(dim("─".repeat(48)));

  // Repo snapshot 

  const lang    = metadata.language  ?? "unknown";
  const license = metadata.license   ?? "none";
  const desc    = metadata.description ? chalk.dim(`"${metadata.description}"`) : dim("no description");

  console.log(desc);
  console.log();
  console.log(
    chalk.yellow(`★ ${fmt(metadata.stars)}`).padEnd(18) +
    chalk.cyan(`⑂ ${fmt(metadata.forks)}`).padEnd(18) +
    chalk.magenta(lang).padEnd(18) +
    chalk.dim(license)
  );
  console.log(
    dim(`open issues: ${metadata.openIssuesCount}`) + "  " +
    dim(`pushed: ${daysAgoStr(metadata.pushedAt)}`) + "  " +
    dim(`topics: ${metadata.topics.length > 0 ? metadata.topics.slice(0, 3).join(", ") : "none"}`)
  );

  // Overall score

  heading("score");
  console.log(
    `  ${bar(repoScore.total)}  ` +
    chalk.bold(scoreColor(repoScore.total)) +
    chalk.dim(" / 10")
  );
  console.log();
  printBreakdown(repoScore);

  // Problems

  if (problems.length > 0) {
    heading("problems");
    problems.forEach(p => console.log(chalk.red("  ×") + "  " + chalk.white(p)));
  }

  // Suggestions

  if (suggestions.length > 0) {
    heading("suggestions");
    suggestions.forEach(s => console.log(chalk.cyan("  →") + "  " + chalk.white(s)));
  }

  // README

  heading("readme");
  console.log(
    `  ${bar(readmeAnalysis.score)}  ` +
    chalk.bold(scoreColor(readmeAnalysis.score)) +
    chalk.dim(" / 10") +
    dim(`  ${readmeAnalysis.length} words`)
  );
  console.log();

  readmeAnalysis.sections.forEach(sec => {
    const tick = sec.present
      ? chalk.green("  ✓")
      : sec.required
        ? chalk.red("  ✗")
        : chalk.gray("  ○");
    const name = sec.present
      ? chalk.dim(sec.name)
      : sec.required
        ? chalk.red(sec.name)
        : chalk.gray(sec.name);
    console.log(`${tick}  ${name}`);
  });

  console.log();
  const flags = [
    ["code examples", readmeAnalysis.hasCodeExamples],
    ["badges",        readmeAnalysis.hasBadges],
    ["images",        readmeAnalysis.hasImages],
  ] as [string, boolean][];
  flags.forEach(([name, val]) => {
    console.log((val ? chalk.green("  ✓") : chalk.gray("  ○")) + "  " + chalk.dim(name));
  });

  if (readmeAnalysis.improvements.length > 0) {
    console.log();
    readmeAnalysis.improvements.forEach(i => console.log(chalk.yellow("  ⚑") + "  " + chalk.white(i)));
  }

  // Issues

  heading("issues");
  const rows: [string, string][] = [
    ["activity",      activityStr(issueInsights.activityLevel)],
    ["open",          String(issueInsights.totalOpen)],
    ["closed",        String(issueInsights.totalClosed)],
    ["open ratio",    (issueInsights.openRatio * 100).toFixed(0) + "%"],
    ["avg response",  issueInsights.averageResponseTimeHours !== null
                        ? hoursStr(issueInsights.averageResponseTimeHours)
                        : "n/a"],
    ["good first issue", issueInsights.hasGoodFirstIssue ? chalk.green("yes") : chalk.gray("no")],
    ["help wanted",      issueInsights.hasHelpWanted       ? chalk.green("yes") : chalk.gray("no")],
  ];
  rows.forEach(([k, v]) => console.log("  " + label(k) + v));

  // AI suggestions

  if (aiSuggestions.length > 0) {
    heading("ai suggestions");
    aiSuggestions.forEach((s, i) => {
      console.log(chalk.magenta(`  ${i + 1}.`) + "  " + chalk.white(s));
    });
  }

  // Footer

  console.log();
  console.log(dim("─".repeat(48)));
  console.log(dim(`done  ·  ${new Date().toLocaleTimeString()}`));
  console.log();
}

// Helpers 

function printBreakdown(score: RepoScore) {
  const rows: [string, number][] = [
    ["readme",    score.breakdown.readme],
    ["issues",    score.breakdown.issueHealth],
    ["activity",  score.breakdown.recentActivity],
    ["community", score.breakdown.community],
    ["docs",      score.breakdown.documentation],
  ];
  rows.forEach(([name, val]) => {
    console.log(
      "  " + chalk.dim(name.padEnd(12)) +
      bar(val, 12) + "  " +
      scoreColor(val)
    );
  });
}

function activityStr(level: string): string {
  switch (level) {
    case "high":     return chalk.greenBright("high");
    case "moderate": return chalk.yellowBright("moderate");
    case "low":      return chalk.red("low");
    default:         return chalk.gray("inactive");
  }
}

function hoursStr(h: number): string {
  if (h < 1)   return `${Math.round(h * 60)}m`;
  if (h < 24)  return `${h.toFixed(1)}h`;
  if (h < 168) return `${(h / 24).toFixed(1)}d`;
  return `${(h / 168).toFixed(1)}w`;
}

function daysAgoStr(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0)  return "today";
  if (days === 1)  return "yesterday";
  if (days < 30)   return `${days}d ago`;
  if (days < 365)  return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}