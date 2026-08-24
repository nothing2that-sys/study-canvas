import { execFileSync } from "node:child_process";

export function generateBuildId({ now = new Date(), gitSha = "local000" } = {}) {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(".", "");
  const shortSha = String(gitSha || "local000").replace(/[^a-zA-Z0-9]/g, "").slice(0, 7) || "local00";
  return `${timestamp}-${shortSha}`;
}

export function resolveGitSha(env = process.env) {
  const environmentSha = env.GITHUB_SHA || env.VERCEL_GIT_COMMIT_SHA || env.COMMIT_SHA;
  if (environmentSha) return environmentSha;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "local000";
  }
}

export function resolveBuildId(env = process.env, now = new Date()) {
  if (env.BUILD_ID) {
    const explicit = String(env.BUILD_ID).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!explicit) throw new Error("BUILD_ID override가 유효하지 않습니다.");
    return explicit;
  }
  return generateBuildId({ now, gitSha: resolveGitSha(env) });
}
