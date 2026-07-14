import { useMemo } from "react";
import { useProjects } from "./use-projects";
import { withGlobal } from "../lib/projects";

/** Scope list including the global scope. Wraps useProjects + withGlobal. */
export function useScopes() {
  const { data: projects, isPending: scopesLoading } = useProjects();
  const scopes = useMemo(() => withGlobal(projects ?? []), [projects]);
  return { scopes, scopesLoading };
}
