import chalk from "chalk";
import type {
  InspectResult, RepoScore, DepStatus,
} from "../types/index.js";

// Primitives

function bar(score: number, width = 14): string {
  const filled = Math.round((score / 10) * width);
  return chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(width - filled));
}

function scoreColor(n: number): string {
  const s = n.toFixed(1);
  if (n >= 7.5) return chalk.greenBright(s);
  if (n >= 5)   return chalk.yellowBright(s);
  return chalk.redBright(s);
}

function heading(title: string) {
  console.log();
  console.log(chalk.bold.white(title));
  console.log(chalk.dim("─".repeat(50)));
}

function kv(key: string, val: string) {
  console.log("  " + chalk.dim(key.padEnd(24)) + val);
}

// Main

export function formatResult(result: InspectResult, url: string): void {
  const { repoScore, problems, suggestions, readmeAnalysis, issueInsights,
          dependencyRot, burnout, deadRepo, aiSuggestions, metadata } = result;

  // Header 
  console.log();
  console.log(chalk.bold.white("gh-inspect") + chalk.dim("  " + url));
  console.log(chalk.dim("─".repeat(50)));
  console.log(metadata.description ? chalk.dim(`"${metadata.description}"`) : chalk.dim("no description"));
  console.log();
  console.log(
    chalk.yellow(`★ ${fmt(metadata.stars)}`).padEnd(18) +
    chalk.cyan(`⑂ ${fmt(metadata.forks)}`).padEnd(18) +
    chalk.magenta(metadata.language ?? "unknown").padEnd(16) +
    chalk.dim(metadata.license ?? "no license")
  );
  console.log(
    chalk.dim(`issues: ${metadata.openIssuesCount}`) + "  " +
    chalk.dim(`pushed: ${daysAgo(metadata.pushedAt)}`) + "  " +
    chalk.dim(`topics: ${metadata.topics.slice(0, 3).join(", ") || "none"}`)
  );

  // Dead repo verdict - show prominently if concerning 
  if (deadRepo.verdict !== "active") {
    console.log();
    const vc = deadVerdictColor(deadRepo.verdict);
    console.log(vc(`  ⚠  ${deadRepo.verdict.toUpperCase()}  `) + chalk.dim(`  ${deadRepo.summary}`));
  }

  // Overall score
  heading("score");
  console.log(`  ${bar(repoScore.total, 18)}  ${chalk.bold(scoreColor(repoScore.total))}${chalk.dim("/10")}`);
  console.log();
  printBreakdown(repoScore);

  // Problems
  if (problems.length > 0) {
    heading("problems");
    problems.forEach(p => console.log(chalk.red("  ×  ") + chalk.white(p)));
  }

  // Suggestions 
  if (suggestions.length > 0) {
    heading("suggestions");
    suggestions.forEach(s => console.log(chalk.cyan("  →  ") + chalk.white(s)));
  }

  // README
  heading("readme");
  console.log(`  ${bar(readmeAnalysis.score)}  ${scoreColor(readmeAnalysis.score)}${chalk.dim("/10")}  ${chalk.dim(readmeAnalysis.length + " words")}`);
  console.log();
  readmeAnalysis.sections.forEach(s => {
    const icon = s.present ? chalk.green("✓") : s.required ? chalk.red("✗") : chalk.gray("○");
    const name = s.present ? chalk.dim(s.name) : s.required ? chalk.red(s.name) : chalk.gray(s.name);
    console.log(`  ${icon}  ${name}`);
  });
  if (readmeAnalysis.improvements.length) {
    console.log();
    readmeAnalysis.improvements.forEach(i => console.log(chalk.yellow("  ⚑  ") + chalk.white(i)));
  }

  // Issues
  heading("issues");
  kv("activity",         activityStr(issueInsights.activityLevel));
  kv("open / closed",    `${issueInsights.totalOpen} / ${issueInsights.totalClosed}`);
  kv("open ratio",       ratioStr(issueInsights.openRatio));
  kv("avg response",     issueInsights.averageResponseTimeHours !== null ? hoursStr(issueInsights.averageResponseTimeHours) : chalk.gray("n/a"));
  kv("good first issue", issueInsights.hasGoodFirstIssue ? chalk.green("yes") : chalk.gray("no"));
  kv("help wanted",      issueInsights.hasHelpWanted      ? chalk.green("yes") : chalk.gray("no"));

  // Dependency rot
  heading("dependency rot");
  if (!dependencyRot.hasPackageJson) {
    console.log(chalk.dim("  no package.json — skipped"));
  } else {
    console.log(`  ${bar(dependencyRot.score)}  ${scoreColor(dependencyRot.score)}${chalk.dim("/10")}`);
    console.log();
    kv("checked",      String(dependencyRot.totalChecked));
    kv("current",      chalk.green(String(dependencyRot.current)));
    kv("outdated",     dependencyRot.outdated     > 0 ? chalk.yellow(String(dependencyRot.outdated))     : chalk.dim("0"));
    kv("major behind", dependencyRot.majorBehind  > 0 ? chalk.red(String(dependencyRot.majorBehind))    : chalk.dim("0"));
    kv("rot %",        rotPercentStr(dependencyRot.rotPercent));
    console.log();
    console.log(chalk.dim("  " + dependencyRot.verdict));

    // Show the worst offenders (major behind first, then outdated)
    const worst = dependencyRot.deps.filter(d => d.status !== "current" && d.status !== "unknown").slice(0, 8);
    if (worst.length > 0) {
      console.log();
      console.log(chalk.dim("  worst offenders:"));
      worst.forEach(d => {
        const badge = depStatusBadge(d.status);
        const behind = d.majorsBehind > 0 ? chalk.dim(` (${d.majorsBehind} major${d.majorsBehind > 1 ? "s" : ""} behind)`) : "";
        console.log(`    ${badge}  ${chalk.white(d.name)}  ${chalk.dim(d.current ?? "?")} → ${chalk.cyan(d.latest ?? "?")}${behind}`);
      });
    }
  }

  // Contributor burnout
  heading("contributor burnout");
  console.log(`  ${bar(burnout.score)}  ${scoreColor(burnout.score)}${chalk.dim("/10")}`);
  console.log();
  kv("commits analyzed",  String(burnout.totalCommitsAnalyzed));
  kv("top ownership",     ownershipStr(burnout.topOwnershipPercent));
  kv("bus factor risk",   burnout.busFactorRisk     ? chalk.red("yes")   : chalk.green("no"));
  kv("maintainer absent", burnout.maintainerAbsent  ? chalk.red("yes")   : chalk.green("no"));
  kv("abandon risk",      burnout.abandonRisk        ? chalk.red("YES ⚠") : chalk.green("no"));
  console.log();
  console.log(chalk.dim("  " + burnout.verdict));

  if (burnout.topContributors.length > 0) {
    console.log();
    console.log(chalk.dim("  top contributors:"));
    burnout.topContributors.forEach(c => {
      const absent = c.isAbsent ? chalk.red(" (absent)") : "";
      const bar2   = miniBar(c.sharePercent);
      console.log(`    ${bar2}  ${chalk.white(c.login)}  ${chalk.dim(c.sharePercent + "%")}  ${chalk.dim(c.daysSinceLastCommit + "d ago")}${absent}`);
    });
  }

  // Dead repo signals 
  heading("repo vitality");
  console.log(`  ${bar(deadRepo.score)}  ${scoreColor(deadRepo.score)}${chalk.dim("/10")}  ${deadVerdictColor(deadRepo.verdict)(deadRepo.verdict)}`);
  console.log();
  kv("last commit",        daysAgo(new Date(Date.now() - deadRepo.daysSinceLastCommit * 86_400_000).toISOString()));
  kv("last issue activity", `${deadRepo.daysSinceLastIssueActivity}d ago`);
  kv("open PRs",           deadRepo.openPrCount > 10 ? chalk.red(String(deadRepo.openPrCount)) : String(deadRepo.openPrCount));
  console.log();
  const triggered = deadRepo.signals.filter(s => s.triggered);
  if (triggered.length === 0) {
    console.log(chalk.green("  ✓  no warning signals"));
  } else {
    triggered.forEach(s => console.log(chalk.red("  ⚑  ") + chalk.white(s.name) + chalk.dim("  " + s.detail)));
  }

  // AI suggestions
  if (aiSuggestions.length > 0) {
    heading("ai suggestions");
    aiSuggestions.forEach((s, i) => console.log(chalk.magenta(`  ${i + 1}.  `) + chalk.white(s)));
  }

  // Footer 
  console.log();
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.dim(`done  ·  ${new Date().toLocaleTimeString()}`));
  console.log();
}

// Helpers 

function printBreakdown(score: RepoScore) {
  const rows: [string, number][] = [
    ["readme",          score.breakdown.readme],
    ["issues",          score.breakdown.issueHealth],
    ["activity",        score.breakdown.recentActivity],
    ["community",       score.breakdown.community],
    ["dependency rot",  score.breakdown.dependencyRot],
    ["burnout",         score.breakdown.burnout],
    ["docs",            score.breakdown.documentation],
  ];
  rows.forEach(([name, val]) => {
    console.log("  " + chalk.dim(name.padEnd(16)) + bar(val, 12) + "  " + scoreColor(val));
  });
}

function activityStr(l: string): string {
  if (l === "high")     return chalk.greenBright("high");
  if (l === "moderate") return chalk.yellowBright("moderate");
  if (l === "low")      return chalk.red("low");
  return chalk.gray("inactive");
}

function deadVerdictColor(v: string) {
  if (v === "active")   return chalk.greenBright;
  if (v === "slowing")  return chalk.yellow;
  if (v === "stale")    return chalk.yellowBright;
  if (v === "abandoned") return chalk.red;
  return chalk.redBright; // dead
}

function depStatusBadge(s: DepStatus): string {
  if (s === "majorBehind") return chalk.red("✗");
  if (s === "outdated")    return chalk.yellow("↓");
  return chalk.gray("?");
}

function ownershipStr(pct: number): string {
  if (pct >= 70) return chalk.red(`${pct}%`);
  if (pct >= 50) return chalk.yellow(`${pct}%`);
  return chalk.green(`${pct}%`);
}

function ratioStr(r: number): string {
  const pct = (r * 100).toFixed(0) + "%";
  if (r < 0.3) return chalk.green(pct);
  if (r < 0.6) return chalk.yellow(pct);
  return chalk.red(pct);
}

function rotPercentStr(pct: number): string {
  if (pct === 0)  return chalk.green("0%");
  if (pct < 20)   return chalk.yellow(`${pct}%`);
  return chalk.red(`${pct}%`);
}

function hoursStr(h: number): string {
  if (h < 1)   return `${Math.round(h * 60)}m`;
  if (h < 24)  return `${h.toFixed(1)}h`;
  if (h < 168) return `${(h / 24).toFixed(1)}d`;
  return `${(h / 168).toFixed(1)}w`;
}

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0)  return "today";
  if (d === 1)  return "yesterday";
  if (d < 30)   return `${d}d ago`;
  if (d < 365)  return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function miniBar(pct: number): string {
  const filled = Math.round((pct / 100) * 10);
  return chalk.cyan("▪".repeat(filled)) + chalk.gray("▫".repeat(10 - filled));
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
