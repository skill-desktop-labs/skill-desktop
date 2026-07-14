import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { deleteSkill, discoverSkills, getInstalledSkills, installSkills } from "../api/skills";
import type { DiscoverResult, InstallArgs, Scope, Skill } from "../lib/types";

export interface SkillsByScope {
  /** Installed skills per scope id (empty array while pending or on error). */
  byScope: Record<string, Skill[]>;
  /** Whether each scope's on-disk read is still in flight. */
  pending: Record<string, boolean>;
}

/**
 * Reads installed skills for every scope in one shot. One query per scope
 * (keyed by scope id) so the sidebar can show a per-scope count and switching
 * scopes is instant once loaded. `retry: false` because this is local IPC —
 * no point retrying (e.g. browser dev without a Tauri runtime).
 */
export function useSkills(scopes: Scope[]): SkillsByScope {
  return useQueries({
    queries: scopes.map((scope) => ({
      queryKey: ["skills", scope.id],
      queryFn: () => getInstalledSkills(scope.path),
      retry: false,
    })),
    combine: (results) => {
      const byScope: Record<string, Skill[]> = {};
      const pending: Record<string, boolean> = {};
      scopes.forEach((scope, i) => {
        byScope[scope.id] = results[i]?.data ?? [];
        pending[scope.id] = results[i]?.isPending ?? true;
      });
      return { byScope, pending };
    },
  });
}

export interface DeleteSkillVars {
  scopeId: string;
  /** Scope root; undefined for the global scope. */
  scopePath: string | undefined;
  skillName: string;
}

/** Deletes a skill and invalidates the skills query for its scope. */
export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: DeleteSkillVars) =>
      deleteSkill(vars.scopePath, vars.skillName),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["skills", vars.scopeId] });
      // The body cache uses staleTime Infinity — explicitly drop the deleted skill's entry.
      qc.removeQueries({
        queryKey: ["skill-readme", "installed", vars.scopeId, vars.skillName],
      });
    },
  });
}

export function useDiscoverSkills() {
  return useMutation<DiscoverResult, Error, string>({
    mutationFn: (sourceUrl) => discoverSkills(sourceUrl),
  });
}

export function useInstallSkills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: InstallArgs) => installSkills(args),
    onSuccess: (_data, args) => {
      const scopeId = args.scopePath ? `proj:${args.scopePath}` : "global";
      queryClient.invalidateQueries({ queryKey: ["skills", scopeId] });
      // A reinstall/update may have changed the body — invalidate by scope prefix.
      queryClient.invalidateQueries({
        queryKey: ["skill-readme", "installed", scopeId],
      });
    },
  });
}
