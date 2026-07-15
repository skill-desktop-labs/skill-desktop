import { AGENTS } from "../../lib/agents";
import { AgentBadge, CheckTick, cn } from "../ui/kit";
import { useAgentFilter, useFilterActions } from "../../lib/filter-store";
import { useSidebarCounts } from "../../hooks/use-sidebar-counts";
import { useInstalledAgents } from "../../hooks/use-installed-agents";
import { SectionLabel } from "./section-label";

function AgentSkeletonRow() {
  return (
    <li className="flex items-center gap-2.5 px-2 py-1.5">
      <div className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-[5px] bg-surface-2" />
      <div className="h-5 w-5 shrink-0 animate-pulse rounded-md bg-surface-2" />
      <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
      <div className="ml-auto h-3 w-4 animate-pulse rounded bg-surface-2" />
    </li>
  );
}

export function AgentFilterSection() {
  const { data: installedAgents, isPending: agentsLoading } =
    useInstalledAgents();
  const agentFilter = useAgentFilter();
  const { toggleAgent, clearAgents } = useFilterActions();
  const { agentCounts } = useSidebarCounts();

  const visibleAgents = installedAgents
    ? AGENTS.filter((a) => installedAgents[a.id] === true)
    : AGENTS;

  return (
    <section>
      <SectionLabel aside={agentFilter.size ? undefined : "filter"}>
        Agents
      </SectionLabel>
      <ul className="space-y-0.5">
        {agentsLoading || !installedAgents ? (
          AGENTS.map((agent) => <AgentSkeletonRow key={agent.id} />)
        ) : visibleAgents.length === 0 ? (
          <li className="px-2 py-1.5 text-[12px] leading-snug text-subtle">
            No agents detected on this machine.
          </li>
        ) : (
          visibleAgents.map((agent) => {
            const checked = agentFilter.has(agent.id);
            return (
              <li key={agent.id}>
                <button
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  aria-pressed={checked}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-100",
                    checked ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <CheckTick checked={checked} />
                  <AgentBadge id={agent.id} size={20} />
                  <span className="flex-1 text-left text-[13px] font-medium text-fg">
                    {agent.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-subtle">
                    {agentCounts[agent.id] ?? 0}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {agentFilter.size > 0 && (
        <button
          type="button"
          onClick={clearAgents}
          className="mt-1.5 px-2 text-[12px] font-medium text-accent-text hover:underline"
        >
          Clear filters
        </button>
      )}
    </section>
  );
}
