import type { AgentId, Skill } from "./types";

/** Applies the agent filter AND the search query to the active scope's skills. */
export function filterSkills(
  skills: Skill[],
  agentFilter: Set<AgentId>,
  query: string,
): Skill[] {
  const q = query.trim().toLowerCase();
  return skills.filter((s) => {
    if (agentFilter.size && !s.agents.some((a) => agentFilter.has(a)))
      return false;
    if (
      q &&
      !s.name.toLowerCase().includes(q) &&
      !s.description.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}
