import { create } from "zustand";
import type { AgentId } from "./types";

interface FilterState {
  agentFilter: Set<AgentId>;
  query: string;
  actions: {
    toggleAgent: (id: AgentId) => void;
    clearAgents: () => void;
    setQuery: (q: string) => void;
    reset: () => void;
  };
}

/** Pure helper that toggles an agent in the agentFilter Set (test target). */
export function toggleAgentInSet(
  current: Set<AgentId>,
  id: AgentId,
): Set<AgentId> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next; // new Set → reference change → selector picks it up
}

// The raw store is not exported — only the custom hooks below are.
const useFilterStore = create<FilterState>((set) => ({
  agentFilter: new Set(),
  query: "",
  actions: {
    toggleAgent: (id) =>
      set((s) => ({ agentFilter: toggleAgentInSet(s.agentFilter, id) })),
    clearAgents: () => set({ agentFilter: new Set() }),
    setQuery: (q) => set({ query: q }),
    reset: () => set({ agentFilter: new Set(), query: "" }),
  },
}));

export const useAgentFilter = () => useFilterStore((s) => s.agentFilter);
export const useSearchQuery = () => useFilterStore((s) => s.query);
export const useFilterActions = () => useFilterStore((s) => s.actions);
