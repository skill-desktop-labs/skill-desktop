import { Globe, FolderSimple, Plus } from "@phosphor-icons/react";
import { Button } from "../ui/kit";
import { SearchBox } from "./search-box";
import { useVisibleSkills } from "../../hooks/use-visible-skills";
import {
  useSearchQuery,
  useAgentFilter,
  useFilterActions,
} from "../../lib/filter-store";

export function MainHeader({ onInstall }: { onInstall: () => void }) {
  const { scope, filteredSkills, totalInScope } = useVisibleSkills();
  const query = useSearchQuery();
  const agentFilter = useAgentFilter();
  const { setQuery } = useFilterActions();

  const isGlobal = scope.kind === "global";
  const filtering = query.trim().length > 0 || agentFilter.size > 0;
  const shown = filteredSkills.length;

  const countLabel =
    filtering && shown !== totalInScope
      ? `${shown} of ${totalInScope}`
      : `${totalInScope}`;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-accent-text">
            {isGlobal ? (
              <Globe size={18} weight="fill" />
            ) : (
              <FolderSimple size={18} weight="fill" />
            )}
          </span>
          <h1 className="truncate text-[16px] font-semibold text-fg">
            {scope.name}
          </h1>
          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium tabular-nums text-muted">
            {countLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {isGlobal ? "Global scope — shared across all projects." : scope.path}
        </p>
      </div>

      <SearchBox value={query} onChange={setQuery} />
      <Button variant="primary" onClick={onInstall}>
        <Plus size={16} weight="bold" />
        Install skill
      </Button>
    </header>
  );
}
