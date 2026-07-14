import { describe, it, expect } from "vitest";
import { parseInstallSource } from "./install-dialog.parse";

describe("parseInstallSource", () => {
  it("accepts public github", () => {
    expect(parseInstallSource("https://github.com/foo/bar")).toEqual({
      host: "github.com",
      repoLabel: "foo/bar",
    });
  });

  it("accepts internal github enterprise", () => {
    expect(parseInstallSource("https://github.example.com/acme/internal-tool")).toEqual({
      host: "github.example.com",
      repoLabel: "acme/internal-tool",
    });
  });

  it("accepts internal gitea with .git", () => {
    expect(parseInstallSource("https://gitea.example.com/team/agent-skills.git")).toEqual({
      host: "gitea.example.com",
      repoLabel: "team/agent-skills",
    });
  });

  it("accepts gitlab, self-hosted, any host", () => {
    expect(parseInstallSource("https://gitlab.com/group/sub/repo")).toEqual({
      host: "gitlab.com",
      repoLabel: "group/sub",
    });
    expect(parseInstallSource("https://git.internal.dev/team/tool")).toEqual({
      host: "git.internal.dev",
      repoLabel: "team/tool",
    });
  });

  it("accepts ssh forms on any host", () => {
    expect(parseInstallSource("git@github.com:foo/bar.git")?.repoLabel).toBe("foo/bar");
    expect(parseInstallSource("git@gitlab.example.com:team/repo.git")).toEqual({
      host: "gitlab.example.com",
      repoLabel: "team/repo",
    });
  });

  it("accepts ssh:// and file:// URLs", () => {
    expect(parseInstallSource("ssh://git@gitea.dev:2222/team/repo.git")).toEqual({
      host: "gitea.dev:2222",
      repoLabel: "team/repo",
    });
    // file:// has no host; the first two path segments stand in for owner/repo.
    expect(parseInstallSource("file:///tmp/repo/team/tool")).toEqual({
      host: "",
      repoLabel: "tmp/repo",
    });
  });

  it("accepts owner/repo shorthand (defaults to github.com)", () => {
    expect(parseInstallSource("vercel-labs/agent-skills")).toEqual({
      host: "github.com",
      repoLabel: "vercel-labs/agent-skills",
    });
  });

  it("ignores #ref fragment for non-git URLs, accepts for git", () => {
    // fragment kept off repoLabel; still parses as github
    expect(parseInstallSource("https://github.com/o/r.git#feature/x")).toEqual({
      host: "github.com",
      repoLabel: "o/r",
    });
    expect(parseInstallSource("owner/repo#main")).toEqual({
      host: "github.com",
      repoLabel: "owner/repo",
    });
  });

  it("rejects malformed input", () => {
    expect(parseInstallSource("")).toBeNull();
    expect(parseInstallSource("nonsense")).toBeNull();
    expect(parseInstallSource("https://host/only-one-seg")).toBeNull();
    // Path traversal segments are rejected.
    expect(parseInstallSource("https://github.com/../etc")).toBeNull();
    expect(parseInstallSource("git@github.com:../x.git")).toBeNull();
  });
});
