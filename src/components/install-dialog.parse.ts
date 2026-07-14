export interface ParsedInstallSource {
  /** Display label, e.g. "owner/repo". Always the first two path segments. */
  repoLabel: string;
  /** Hostname (with optional port) shown alongside the repo label. */
  host: string;
}

/**
 * Parse a skill source. Mirrors the Vercel `skills` CLI `parseSource`: any git
 * host is accepted (github.com, internal GHES, Gitea, GitLab, self-hosted, …).
 *
 * Supported forms:
 *   - `https?://host/owner/repo[.git][/tree/<ref>[/<subpath...>]]`
 *   - `git@host:owner/repo[.git]`
 *   - `ssh://[git@]host[:port]/owner/repo[.git]`
 *   - `file:///abs/path`
 *   - `owner/repo` shorthand (defaults to github.com)
 *
 * Trailing `#ref` selects a branch/tag/commit (git-like sources only).
 */
export function parseInstallSource(raw: string): ParsedInstallSource | null {
  const input = raw.trim();
  if (!input) return null;

  // Strip a `#ref` fragment only when the body looks git-ish.
  const hashIdx = input.lastIndexOf("#");
  let main = input;
  if (hashIdx >= 0 && looksLikeGitSource(input.slice(0, hashIdx))) {
    main = input.slice(0, hashIdx);
  }

  // owner/repo[/sub/path] shorthand — defaults to github.com (skills CLI).
  if (
    !main.includes("://") &&
    !main.startsWith("git@") &&
    !main.startsWith("ssh://") &&
    !main.startsWith("file://") &&
    !main.startsWith("/") &&
    !main.startsWith(".") &&
    !main.includes("\\") &&
    !main.includes(":")
  ) {
    const segs = main.split("/").filter(Boolean);
    if (segs.length >= 2 && segs.every(isSafeSegment)) {
      const owner = segs[0]!;
      const repo = segs[1]!.replace(/\.git$/, "");
      return { host: "github.com", repoLabel: `${owner}/${repo}` };
    }
    return null;
  }

  // git@host:owner/repo(.git)
  const scp = main.match(/^git@([^:]+):(.+)$/);
  if (scp) {
    const host = scp[1]!;
    const path = scp[2]!.replace(/\.git$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length < 2 || !parts.every(isSafeSegment)) return null;
    return { host, repoLabel: `${parts[0]}/${parts[1]}` };
  }

  // ssh://[git@]host[:port]/owner/repo(.git) and file:///abs/path — host:port
  // or `file` host forms; bail to URL parsing for consistent behaviour.
  if (main.startsWith("ssh://") || main.startsWith("file://")) {
    try {
      const u = new URL(main);
      const parts = u.pathname
        .replace(/^\/+/, "")
        .replace(/\.git$/, "")
        .split("/")
        .filter(Boolean);
      if (parts.length < 2 || !parts.every(isSafeSegment)) return null;
      return { host: u.host || u.hostname, repoLabel: `${parts[0]}/${parts[1]}` };
    } catch {
      return null;
    }
  }

  // http(s)://host/owner/repo(.git)[/tree/<ref>[/<subpath...>]]
  const m = main.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const host = m[1]!;
  const parts = m[2]!.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2 || !parts.every(isSafeSegment)) return null;
  return { host, repoLabel: `${parts[0]}/${parts[1]}` };
}

function isSafeSegment(s: string): boolean {
  return s.length > 0 && s !== ".." && s !== "." && !s.includes("\\");
}

function looksLikeGitSource(s: string): boolean {
  if (!s) return false;
  if (
    s.startsWith("git@") ||
    s.startsWith("ssh://") ||
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("file://")
  ) {
    return true;
  }
  if (s.includes(":") || s.startsWith(".") || s.startsWith("/")) return false;
  const segs = s.split("/").filter(Boolean);
  return segs.length >= 2 && segs.every(isSafeSegment);
}
