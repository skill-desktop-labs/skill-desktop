import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Scope } from "../lib/types";
import { addProject, loadProjects, removeProject } from "../api/projects";

export const PROJECTS_QUERY_KEY = ["projects"] as const;

/**
 * Locally stored project scopes (excluding the global scope). Read as a Promise,
 * so callers show a skeleton during isPending — same convention as
 * installed-agents.
 */
export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: loadProjects,
    retry: false, // local IPC — retry is pointless (e.g. browser dev without Tauri)
  });
}

/** Adds a project and invalidates the projects query to refetch. */
export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scope: Scope) => addProject(scope),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
  });
}

/** Removes a project by id and invalidates the projects query to refetch. */
export function useRemoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
  });
}
