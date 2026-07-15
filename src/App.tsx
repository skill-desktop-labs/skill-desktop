import { Sidebar } from "./components/sidebar/sidebar";
import { MainPane } from "./components/main-pane/main-pane";
import { SkillDetailDrawer } from "./components/skill-detail/skill-detail-drawer";
import { Toaster } from "./components/ui/toaster";
import { UpdateDialog } from "./components/update-dialog";
import { useUpdater } from "./hooks/use-updater";

function App() {
  const update = useUpdater();
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <MainPane />
      <SkillDetailDrawer />
      <Toaster />
      <UpdateDialog
        status={update.status}
        onApply={update.apply}
        onDismiss={update.dismiss}
      />
    </div>
  );
}

export default App;
