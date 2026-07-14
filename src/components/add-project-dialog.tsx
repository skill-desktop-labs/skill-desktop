import { useState } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Scope } from "../lib/types";
import { makeProjectScope } from "../lib/projects";
import { Modal } from "./ui/dialog";
import { Button, Field, TextInput } from "./ui/kit";

export function AddProjectDialog({
  open: isOpen,
  onOpenChange,
  existingPaths,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingPaths: string[];
  onAdd: (scope: Scope) => void;
}) {
  const [path, setPath] = useState("");

  const trimmed = path.trim();
  const duplicate = trimmed.length > 0 && existingPaths.includes(trimmed);
  const canSubmit = trimmed.length > 0 && !duplicate;

  async function pickFolder() {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Select project folder",
    });
    if (typeof dir === "string") setPath(dir);
  }

  function close(v: boolean) {
    if (!v) setPath("");
    onOpenChange(v);
  }

  function submit() {
    if (!canSubmit) return;
    onAdd(makeProjectScope(trimmed));
    close(false);
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={close}
      title="Add project"
      description="Pick a folder to manage skills installed for that project."
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            Add
          </Button>
        </>
      }
    >
      <div className="py-2">
        <Field
          label="Project folder"
          htmlFor="project-path"
          error={duplicate ? "This project has already been added." : undefined}
          hint={!duplicate ? "Path to the project root folder" : undefined}
        >
          <div className="flex gap-2">
            <TextInput
              id="project-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              invalid={duplicate}
              placeholder="/Users/me/dev/my-project"
              spellCheck={false}
            />
            <Button variant="secondary" onClick={pickFolder} className="shrink-0">
              <FolderOpen size={16} />
              Choose folder
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
