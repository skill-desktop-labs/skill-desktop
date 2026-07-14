import { create } from "zustand";
import type { Skill } from "./types";

interface SkillDetailState {
  skill: Skill | null;
  actions: {
    open: (skill: Skill) => void;
    close: () => void;
  };
}

// The raw store is not exported — only the custom hooks below are.
const useSkillDetailStore = create<SkillDetailState>((set) => ({
  skill: null,
  actions: {
    open: (skill) => set({ skill }),
    close: () => set({ skill: null }),
  },
}));

export const useSkillDetailSkill = () => useSkillDetailStore((s) => s.skill);
export const useSkillDetailActions = () => useSkillDetailStore((s) => s.actions);
