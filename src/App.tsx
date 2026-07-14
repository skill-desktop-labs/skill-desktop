import { Sidebar } from "./components/sidebar/sidebar";
import { MainPane } from "./components/main-pane/main-pane";
import { SkillDetailDrawer } from "./components/skill-detail/skill-detail-drawer";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <MainPane />
      <SkillDetailDrawer />
      <Toaster />
    </div>
  );
}

export default App;
