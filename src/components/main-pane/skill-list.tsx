import { SkillRow } from "./skill-row";
import { EmptyScope, EmptyFilter } from "../empty-state";
import { useVisibleSkills } from "../../hooks/use-visible-skills";
import { useAgentFilter, useFilterActions } from "../../lib/filter-store";

function SkeletonRow() {
  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-40 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-64 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-48 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="flex gap-1">
        <div className="h-[22px] w-[22px] animate-pulse rounded-md bg-surface-2" />
        <div className="h-[22px] w-[22px] animate-pulse rounded-md bg-surface-2" />
      </div>
      <div className="h-3 w-14 animate-pulse rounded bg-surface-2" />
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="flex-1 divide-y divide-border overflow-y-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </ul>
  );
}

export function SkillList({ onInstall }: { onInstall: () => void }) {
  const { scope, filteredSkills, totalInScope, loading } = useVisibleSkills();
  const agentFilter = useAgentFilter();
  const { clearAgents } = useFilterActions();

  if (loading) return <SkeletonList />;
  if (totalInScope === 0) return <EmptyScope onInstall={onInstall} />;
  if (filteredSkills.length === 0)
    return <EmptyFilter onClear={clearAgents} showClear={agentFilter.size > 0} />;

  return (
    <div key={scope.id} className="flex-1 overflow-y-auto animate-content-in">
      <ul className="divide-y divide-border">
        {filteredSkills.map((s) => (
          <SkillRow key={s.id} skill={s} />
        ))}
      </ul>
    </div>
  );
}
