import { useState } from "react";
import { DotsThree, Trash } from "@phosphor-icons/react";
import type { Skill } from "../../lib/types";
import { AgentBadge, IconButton, MethodBadge } from "../ui/kit";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "../ui/menu";
import { ConfirmDialog } from "../ui/dialog";
import { useActiveScope } from "../../hooks/use-active-scope";
import { useDeleteSkill } from "../../hooks/use-skills";
import { useToastActions } from "../../lib/toast-store";
import { useSkillDetailActions } from "../../lib/skill-detail-store";

export function SkillRow({ skill }: { skill: Skill }) {
  const scope = useActiveScope();
  const deleteSkillMutation = useDeleteSkill();
  const { show } = useToastActions();
  const { open } = useSkillDetailActions();
  const [confirming, setConfirming] = useState(false);

  function confirmDelete() {
    setConfirming(false); // close the dialog immediately; on success, invalidation refreshes the list
    // Toast is gated on the actual deletion result — on failure the row correctly stays.
    deleteSkillMutation.mutate(
      { scopeId: scope.id, scopePath: scope.path, skillName: skill.name },
      {
        onSuccess: () => show(`Deleted ${skill.name}`),
        onError: () => show(`Failed to delete ${skill.name}`),
      },
    );
  }

  return (
    <li className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-100 hover:bg-surface-2">
      <div
        className="group/card min-w-0 flex-1 cursor-pointer rounded-md"
        role="button"
        tabIndex={0}
        onClick={() => open(skill)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open(skill);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold text-fg group-hover/card:text-accent-text">
            {skill.name}
          </h3>
          <MethodBadge method={skill.method} />
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {skill.description}
        </p>
      </div>

      {/* Agents this skill is installed for */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {skill.agents.map((a) => (
          <AgentBadge key={a} id={a} size={22} />
        ))}
      </div>

      <Menu
        trigger={
          <IconButton aria-label={`${skill.name} actions`} className="shrink-0">
            <DotsThree size={20} weight="bold" />
          </IconButton>
        }
      >
        <MenuLabel>{skill.name}</MenuLabel>
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash size={16} />}
          onSelect={() => setConfirming(true)}
        >
          Delete
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(v) => !v && setConfirming(false)}
        title="Delete this skill?"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      >
        <div className="flex flex-col gap-3">
          <p>
            Remove{" "}
            <span className="font-semibold text-fg">{skill.name}</span>{" "}
            from the{" "}
            <span className="font-semibold text-fg">{scope.name}</span>{" "}
            scope? It will no longer be available in the agents below.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {skill.agents.map((a) => (
              <AgentBadge key={a} id={a} size={20} showLabel />
            ))}
          </div>
        </div>
      </ConfirmDialog>
    </li>
  );
}
