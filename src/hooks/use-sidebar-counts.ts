import { useMemo } from "react";
import type { AgentId } from "../lib/types";
import { useScopes } from "./use-scopes";
import { useSkills } from "./use-skills";
import { useActiveScopeId } from "../lib/scope-store";

const EMPTY_AGENT_COUNTS: Record<AgentId, number> = {
  claude: 0,
  codex: 0,
  gemini: 0,
  cursor: 0,
};

/** Counts for the sidebar: skills per scope + per-agent counts in the active scope. Does not depend on query/agentFilter. */
export function useSidebarCounts() {
  const { scopes } = useScopes();
  const { byScope } = useSkills(scopes);
  const activeScopeId = useActiveScopeId();

  const scopeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scopes) counts[s.id] = (byScope[s.id] ?? []).length;
    return counts;
  }, [scopes, byScope]);

  const agentCounts = useMemo(() => {
    const counts = { ...EMPTY_AGENT_COUNTS };
    for (const skill of byScope[activeScopeId] ?? [])
      for (const a of skill.agents) counts[a] += 1;
    return counts;
  }, [byScope, activeScopeId]);

  return { scopeCounts, agentCounts };
}
