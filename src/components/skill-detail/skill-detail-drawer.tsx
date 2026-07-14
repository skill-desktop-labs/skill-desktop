import { useState } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { X, Trash, FileText } from "@phosphor-icons/react";
import { useSkillDetailActions, useSkillDetailSkill } from "../../lib/skill-detail-store";
import { useSkillReadme } from "../../hooks/use-skill-readme";
import { useDeleteSkill } from "../../hooks/use-skills";
import { useActiveScope } from "../../hooks/use-active-scope";
import { useToastActions } from "../../lib/toast-store";
import { AgentBadge, Button, IconButton, MethodBadge } from "../ui/kit";
import { ConfirmDialog } from "../ui/dialog";
import { Markdown } from "../ui/markdown";
import { stripFrontmatter } from "../../lib/skill-md";

const OVERLAY = "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-overlay-in";
const CONTENT =
  "fixed inset-y-0 right-0 z-50 flex w-[min(560px,92vw)] flex-col " +
  "border-l border-border bg-surface elevated animate-drawer-in focus:outline-none";

function ReadmeSkeleton() {
  const widths = ["70%", "100%", "92%", "48%"];
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-hidden>
      <div className="h-3.5 w-24 rounded bg-surface-2" />
      {widths.map((w, i) => (
        <div key={i} className="h-3 rounded bg-surface-2" style={{ width: w }} />
      ))}
      <div className="mt-2 h-20 rounded-lg bg-surface-2" />
    </div>
  );
}

/** Body (SKILL.md) section — its own component so the readme query only runs
 *  while the drawer is mounted for a skill. */
function ReadmeSection({
  scopeId,
  scopePath,
  name,
}: {
  scopeId: string;
  scopePath: string | undefined;
  name: string;
}) {
  const { data, isPending, isError } = useSkillReadme(
    { scopeId, scopePath, name },
    true,
  );
  // frontmatter name/description is already shown in the header, so strip it from the body.
  const body = data ? stripFrontmatter(data).trim() : "";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle">
        <FileText size={13} />
        <span className="font-mono">SKILL.md</span>
      </div>
      {isPending ? (
        <ReadmeSkeleton />
      ) : isError ? (
        <p className="text-[13px] text-subtle">Failed to load body.</p>
      ) : body ? (
        <Markdown source={body} />
      ) : (
        <p className="text-[13px] text-subtle">No body yet.</p>
      )}
    </section>
  );
}

export function SkillDetailDrawer() {
  const skill = useSkillDetailSkill();
  const { close } = useSkillDetailActions();

  const scope = useActiveScope();
  const deleteSkillMutation = useDeleteSkill();
  const { show } = useToastActions();

  const [confirming, setConfirming] = useState(false);

  const open = skill != null;
  const name = skill?.name ?? "";
  const description = skill?.description ?? "";

  function confirmDelete() {
    if (!skill) return;
    const s = skill;
    setConfirming(false);
    close(); // close the drawer; on success invalidation refreshes the list
    deleteSkillMutation.mutate(
      { scopeId: scope.id, scopePath: scope.path, skillName: s.name },
      {
        onSuccess: () => show(`Deleted ${s.name}`),
        onError: () => show(`Failed to delete ${s.name}`),
      },
    );
  }

  return (
    <>
      <RDialog.Root open={open} onOpenChange={(v) => !v && close()}>
        <RDialog.Portal>
          <RDialog.Overlay className={OVERLAY} />
          <RDialog.Content
            className={CONTENT}
            aria-describedby={undefined}
            onInteractOutside={(e) => confirming && e.preventDefault()}
            onEscapeKeyDown={(e) => confirming && e.preventDefault()}
          >
            {/* Header — compact title bar, stays fixed while the body scrolls.
                The description lives in the scroll area below: it can be long
                and would otherwise crowd out the body. */}
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <RDialog.Title className="text-[18px] font-semibold leading-tight text-fg">
                  {name}
                </RDialog.Title>
                {skill && <MethodBadge method={skill.method} />}
              </div>
              <RDialog.Close asChild>
                <IconButton aria-label="Close" className="-mr-1.5 -mt-1 shrink-0">
                  <X size={17} />
                </IconButton>
              </RDialog.Close>
            </header>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              {description && (
                // Description is authored markdown (bold/code/lists), so render
                // it rather than showing raw ** and ` characters.
                <Markdown source={description} />
              )}

              {skill && skill.agents.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-medium text-subtle">
                    Installed agents
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {skill.agents.map((a) => (
                      <AgentBadge key={a} id={a} size={20} showLabel />
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-t border-border" />

              {skill && (
                <ReadmeSection
                  scopeId={scope.id}
                  scopePath={scope.path}
                  name={name}
                />
              )}
            </div>

            {/* Footer */}
            {skill && (
              <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirming(true)}
                >
                  <Trash size={15} />
                  Delete
                </Button>
              </footer>
            )}
          </RDialog.Content>
        </RDialog.Portal>
      </RDialog.Root>

      {/* Delete confirmation. */}
      {skill && (
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
      )}
    </>
  );
}
