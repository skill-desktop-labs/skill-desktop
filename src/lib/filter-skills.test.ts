import { describe, expect, it } from "vitest";
import type { AgentId, Skill } from "./types";
import { filterSkills } from "./filter-skills";

function skill(p: Partial<Skill> & { name: string }): Skill {
  return {
    id: p.name,
    name: p.name,
    description: p.description ?? "",
    agents: p.agents ?? ["claude"],
    method: p.method ?? "symlink",
  };
}

const skills: Skill[] = [
  skill({ name: "pr-summary", description: "summary", agents: ["claude", "codex"] }),
  skill({ name: "commit-helper", description: "commit", agents: ["gemini"] }),
];

describe("filterSkills", () => {
  it("returns all skills for empty filter and empty query", () => {
    expect(filterSkills(skills, new Set<AgentId>(), "")).toHaveLength(2);
  });

  it("passes only skills that have an agent in agentFilter", () => {
    expect(
      filterSkills(skills, new Set<AgentId>(["gemini"]), "").map((s) => s.name),
    ).toEqual(["commit-helper"]);
  });

  it("matches the query against name/description case-insensitively", () => {
    expect(filterSkills(skills, new Set<AgentId>(), "PR").map((s) => s.name)).toEqual(["pr-summary"]);
    expect(filterSkills(skills, new Set<AgentId>(), "commit").map((s) => s.name)).toEqual(["commit-helper"]);
  });

  it("applies agentFilter and query with AND", () => {
    expect(filterSkills(skills, new Set<AgentId>(["claude"]), "commit")).toHaveLength(0);
    expect(
      filterSkills(skills, new Set<AgentId>(["claude"]), "pr").map((s) => s.name),
    ).toEqual(["pr-summary"]);
  });

  it("does not treat a whitespace-only query as a filter", () => {
    expect(filterSkills(skills, new Set<AgentId>(), "   ")).toHaveLength(2);
  });

  it("passes skills that have any of the agents when agentFilter has multiple", () => {
    expect(
      filterSkills(skills, new Set<AgentId>(["gemini", "codex"]), "").map((s) => s.name),
    ).toEqual(["pr-summary", "commit-helper"]);
  });
});
