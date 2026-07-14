import { useQuery } from "@tanstack/react-query";
import { fetchInstalledSkillReadme } from "../api/skill-readme";

/** The body fetch target. The same name may be installed separately in the
 *  global and a project scope with different content, so scopeId is part of
 *  the query key. */
export interface SkillReadmeTarget {
  scopeId: string;
  /** Scope root; undefined for the global scope. */
  scopePath: string | undefined;
  name: string;
}

/** Fetches the skill body (SKILL.md). `enabled` limits the fetch to when the drawer is open. */
export function useSkillReadme(target: SkillReadmeTarget, enabled: boolean) {
  return useQuery({
    queryKey: ["skill-readme", target.scopeId, target.name],
    queryFn: () => fetchInstalledSkillReadme(target.scopePath, target.name),
    enabled,
    retry: false, // local IPC — retry is pointless
    staleTime: Infinity, // body rarely changes — avoid refetch on focus
  });
}
