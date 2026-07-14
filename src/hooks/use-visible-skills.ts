import { useMemo } from "react";
import { useScopes } from "./use-scopes";
import { useSkills } from "./use-skills";
import { useActiveScopeId } from "../lib/scope-store";
import { useAgentFilter, useSearchQuery } from "../lib/filter-store";
import { filterSkills } from "../lib/filter-skills";

/** Skills for the active scope with filters applied. Composition hook for MainPane. */
export function useVisibleSkills() {
  const { scopes, scopesLoading } = useScopes();
  const { byScope, pending } = useSkills(scopes);
  const activeScopeId = useActiveScopeId();
  const agentFilter = useAgentFilter();
  const query = useSearchQuery();

  const scope = scopes.find((s) => s.id === activeScopeId) ?? scopes[0];
  const scopeSkills = byScope[activeScopeId] ?? [];
  const loading = scopesLoading || (pending[activeScopeId] ?? true);

  const filteredSkills = useMemo(
    () => filterSkills(scopeSkills, agentFilter, query),
    [scopeSkills, agentFilter, query],
  );

  return { scope, filteredSkills, totalInScope: scopeSkills.length, loading };
}
