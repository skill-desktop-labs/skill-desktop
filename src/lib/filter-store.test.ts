import { describe, expect, it } from "vitest";
import type { AgentId } from "./types";
import { toggleAgentInSet } from "./filter-store";

describe("toggleAgentInSet", () => {
  it("adds an agent that is not present", () => {
    expect(toggleAgentInSet(new Set<AgentId>(), "claude").has("claude")).toBe(true);
  });

  it("removes an agent that is already present", () => {
    expect(toggleAgentInSet(new Set<AgentId>(["claude"]), "claude").has("claude")).toBe(false);
  });

  it("returns a new reference without mutating the original", () => {
    const original = new Set<AgentId>(["codex"]);
    const result = toggleAgentInSet(original, "claude");
    expect(result).not.toBe(original);
    expect(original.has("claude")).toBe(false);
    expect(result.has("codex")).toBe(true);
    expect(result.has("claude")).toBe(true);
  });
});
