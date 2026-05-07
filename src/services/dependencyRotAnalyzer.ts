import axios from "axios";
import type { PackageJson, DependencyRotAnalysis, DepResult, DepStatus } from "../types/index.js";

// npm registry response (only what we need)
interface NpmMeta { "dist-tags": { latest: string } }

// Main 

export async function analyzeDependencyRot(
  pkg: PackageJson | null
): Promise<DependencyRotAnalysis> {
  if (!pkg) {
    return {
      score: 5, totalChecked: 0, current: 0, outdated: 0,
      majorBehind: 0, unknown: 0, rotPercent: 0, deps: [],
      verdict: "no package.json found — not a Node.js project or file is missing.",
      hasPackageJson: false,
    };
  }

  // Merge prod + dev deps, skip peer (those are the consumer's problem)
  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const names = Object.keys(allDeps);

  if (names.length === 0) {
    return {
      score: 10, totalChecked: 0, current: 0, outdated: 0,
      majorBehind: 0, unknown: 0, rotPercent: 0, deps: [],
      verdict: "no dependencies declared.",
      hasPackageJson: true,
    };
  }

  // Check up to 40 deps — enough signal, avoids hammering npm registry
  const sample = names.slice(0, 40);
  const results = await Promise.all(sample.map(name => checkDep(name, allDeps[name])));

  const current    = results.filter(d => d.status === "current").length;
  const outdated   = results.filter(d => d.status === "outdated").length;
  const majorBehind = results.filter(d => d.status === "majorBehind").length;
  const unknown    = results.filter(d => d.status === "unknown").length;
  const totalChecked = results.length;

  const rotPercent = totalChecked > 0
    ? Math.round(((outdated + majorBehind) / totalChecked) * 100)
    : 0;

  const score = computeRotScore(rotPercent, majorBehind, totalChecked);

  const verdict = buildVerdict(rotPercent, majorBehind, outdated, totalChecked);

  // Sort: majorBehind first, then outdated, then current
  const sorted = results.sort((a, b) => {
    const rank = (s: DepStatus) =>
      s === "majorBehind" ? 0 : s === "outdated" ? 1 : s === "unknown" ? 2 : 3;
    return rank(a.status) - rank(b.status);
  });

  return {
    score, totalChecked, current, outdated, majorBehind,
    unknown, rotPercent, deps: sorted, verdict, hasPackageJson: true,
  };
}

// Per-package check 

async function checkDep(name: string, declared: string): Promise<DepResult> {
  const current = stripRange(declared);

  try {
    const { data } = await axios.get<NpmMeta>(
      `https://registry.npmjs.org/${name}`,
      {
        timeout: 8000,
        headers: { Accept: "application/vnd.npm.install-v1+json" },
      }
    );

    const latest = data["dist-tags"]?.latest ?? null;

    if (!latest || !current) {
      return { name, declared, latest, current, status: "unknown", majorsBehind: 0 };
    }

    const curMajor = major(current);
    const latMajor = major(latest);

    if (curMajor === null || latMajor === null) {
      return { name, declared, latest, current, status: "unknown", majorsBehind: 0 };
    }

    const majorsBehind = latMajor - curMajor;

    let status: DepStatus;
    if (majorsBehind > 0)      status = "majorBehind";
    else if (current !== latest) status = "outdated";
    else                        status = "current";

    return { name, declared, latest, current, status, majorsBehind };
  } catch {
    return { name, declared, latest: null, current, status: "unknown", majorsBehind: 0 };
  }
}

// Helpers 

function stripRange(v: string): string | null {
  if (!v) return null;
  const cleaned = v.replace(/^[\^~>=<*]+/, "").trim();
  return cleaned || null;
}

function major(v: string): number | null {
  const m = v.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function computeRotScore(rotPercent: number, majorBehind: number, total: number): number {
  if (total === 0) return 10;
  let score = 10;
  score -= (rotPercent / 100) * 5;         // up to -5 for overall rot %
  score -= Math.min(3, majorBehind * 0.5); // up to -3 for major version gaps
  return Math.max(0, Math.round(score * 10) / 10);
}

function buildVerdict(rot: number, major: number, outdated: number, total: number): string {
  if (total === 0) return "no dependencies to check.";
  if (rot === 0)   return "all dependencies are up to date.";
  if (rot < 20)    return `mostly current — ${outdated + major} of ${total} deps need attention.`;
  if (rot < 50)    return `moderate rot — ${rot}% of deps are behind, including ${major} major version gap${major !== 1 ? "s" : ""}.`;
  return `heavy rot — ${rot}% of dependencies are outdated. ${major} are multiple major versions behind.`;
}
