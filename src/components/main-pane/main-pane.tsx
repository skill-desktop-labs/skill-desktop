import { useState } from "react";
import { MainHeader } from "./main-header";
import { SkillList } from "./skill-list";
import { InstallDialog } from "../install-dialog";
import { useScopes } from "../../hooks/use-scopes";
import { useActiveScopeId } from "../../lib/scope-store";

export function MainPane() {
  const { scopes } = useScopes();
  const activeScopeId = useActiveScopeId();

  const [installOpen, setInstallOpen] = useState(false);
  const openInstall = () => setInstallOpen(true);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <MainHeader onInstall={openInstall} />
      <SkillList onInstall={openInstall} />

      <InstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        scopes={scopes}
        defaultScopeId={activeScopeId}
      />
    </main>
  );
}
