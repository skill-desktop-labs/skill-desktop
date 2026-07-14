import { useScopes } from "./use-scopes";
import { useActiveScopeId } from "../lib/scope-store";
import type { Scope } from "../lib/types";

/** The active scope's Scope object. Composed from useScopes + activeScopeId. */
export function useActiveScope(): Scope {
  const { scopes } = useScopes();
  const activeScopeId = useActiveScopeId();
  return scopes.find((s) => s.id === activeScopeId) ?? scopes[0];
}
