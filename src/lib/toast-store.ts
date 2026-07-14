import { create } from "zustand";

interface ToastState {
  message: string | null;
  actions: {
    show: (message: string) => void;
    dismiss: () => void;
  };
}

// The raw store is not exported — only the custom hooks below are.
const useToastStore = create<ToastState>((set) => ({
  message: null,
  actions: {
    show: (message) => set({ message }),
    dismiss: () => set({ message: null }),
  },
}));

export const useToastMessage = () => useToastStore((s) => s.message);
export const useToastActions = () => useToastStore((s) => s.actions);
