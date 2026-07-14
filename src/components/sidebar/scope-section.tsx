import { useState } from "react";
import { Globe, FolderSimple, Plus, X } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Scope } from "../../lib/types";
import { cn } from "../ui/kit";
import { useScopes } from "../../hooks/use-scopes";
import { useActiveScopeId, useScopeActions } from "../../lib/scope-store";
import { useSidebarCounts } from "../../hooks/use-sidebar-counts";
import { useAddProject, useRemoveProject } from "../../hooks/use-projects";
import { useToastActions } from "../../lib/toast-store";
import { AddProjectDialog } from "../add-project-dialog";
import { SectionLabel } from "./section-label";

function ScopeSkeletonRow() {
  return (
    <li className="flex items-center gap-2.5 px-2 py-1.5">
      <div className="h-[17px] w-[17px] shrink-0 animate-pulse rounded-md bg-surface-2" />
      <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
      <div className="ml-auto h-3 w-4 animate-pulse rounded bg-surface-2" />
    </li>
  );
}

export function ScopeSection() {
  const { scopes, scopesLoading } = useScopes();
  const activeScopeId = useActiveScopeId();
  const { selectScope } = useScopeActions();
  const { scopeCounts } = useSidebarCounts();
  const addProjectMutation = useAddProject();
  const removeProjectMutation = useRemoveProject();
  const { show } = useToastActions();
  // The skills query cache (["skills", id]) is the source of truth; removing a
  // project drops its cached skills here.
  const queryClient = useQueryClient();

  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const existingPaths = scopes
    .map((s) => s.path)
    .filter((p): p is string => !!p);

  function removeScope(id: string) {
    queryClient.removeQueries({ queryKey: ["skills", id] });
    if (activeScopeId === id) selectScope("global");
    // Toast reflects the actual persistence outcome, not just the optimistic
    // local update — a success toast on a failed write would be a lie.
    removeProjectMutation.mutate(id, {
      onSuccess: () => show("Removed project from the list"),
      onError: () => show("Failed to remove project"),
    });
  }

  function addProject(scope: Scope) {
    // The skills query for the new scope fires automatically once `scopes`
    // includes it, so there's no local state to seed.
    selectScope(scope.id);
    addProjectMutation.mutate(scope, {
      onSuccess: () => show(`Added ${scope.name} project`),
      onError: () => show(`Failed to add ${scope.name} project`),
    });
  }

  return (
    <section>
      <SectionLabel>Scopes</SectionLabel>
      <ul className="space-y-0.5">
        {scopes.map((scope) => {
          const active = scope.id === activeScopeId;
          const isGlobal = scope.kind === "global";
          return (
            <li key={scope.id}>
              <button
                type="button"
                onClick={() => selectScope(scope.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-100",
                  active
                    ? "bg-surface text-fg elevated"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "shrink-0",
                    active ? "text-accent-text" : "text-subtle",
                  )}
                >
                  {isGlobal ? (
                    <Globe size={17} weight={active ? "fill" : "regular"} />
                  ) : (
                    <FolderSimple size={17} weight={active ? "fill" : "regular"} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {scope.name}
                  </span>
                  {scope.path && (
                    <span className="block truncate text-[11px] text-subtle">
                      {scope.path}
                    </span>
                  )}
                </span>
                {!isGlobal && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${scope.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScope(scope.id);
                    }}
                    className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-danger-soft hover:text-danger group-hover:flex"
                  >
                    <X size={13} weight="bold" />
                  </span>
                )}
                <span
                  className={cn(
                    "shrink-0 text-[12px] tabular-nums text-subtle",
                    !isGlobal && "group-hover:hidden",
                  )}
                >
                  {scopeCounts[scope.id] ?? 0}
                </span>
              </button>
            </li>
          );
        })}
        {scopesLoading && (
          <>
            <ScopeSkeletonRow />
            <ScopeSkeletonRow />
          </>
        )}
      </ul>
      <button
        type="button"
        onClick={() => setAddProjectOpen(true)}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
      >
        <Plus size={17} className="text-subtle" />
        Add project
      </button>

      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        existingPaths={existingPaths}
        onAdd={addProject}
      />
    </section>
  );
}
