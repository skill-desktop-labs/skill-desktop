import { create } from "zustand";

interface ScopeState {
  activeScopeId: string;
  actions: {
    selectScope: (id: string) => void;
  };
}

// The raw store is not exported — only the custom hooks below are.
const useScopeStore = create<ScopeState>((set) => ({
  activeScopeId: "global",
  actions: {
    selectScope: (id) => set({ activeScopeId: id }),
  },
}));

export const useActiveScopeId = () => useScopeStore((s) => s.activeScopeId);
export const useScopeActions = () => useScopeStore((s) => s.actions);
