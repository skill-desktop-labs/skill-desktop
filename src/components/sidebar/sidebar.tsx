import { ScopeSection } from "./scope-section";
import { AgentFilterSection } from "./agent-filter-section";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-sidebar">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <ScopeSection />
        <AgentFilterSection />
      </nav>

      <ThemeToggle />
    </aside>
  );
}
