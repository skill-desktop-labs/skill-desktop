import { useEffect, useMemo, useState } from "react";
import * as RMenu from "@radix-ui/react-dropdown-menu";
import {
  Globe,
  FolderSimple,
  CaretUpDown,
  Check,
  LinkSimple,
  Copy,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import type { AgentId, InstalledAgents, InstallMethod, Scope } from "../lib/types";
import { AGENTS } from "../lib/agents";
import { Modal } from "./ui/dialog";
import {
  AgentBadge,
  Button,
  CheckTick,
  Field,
  SourceBadge,
  TextInput,
  cn,
} from "./ui/kit";
import { parseInstallSource } from "./install-dialog.parse";
import { useDiscoverSkills, useInstallSkills } from "../hooks/use-skills";
import { useInstalledAgents } from "../hooks/use-installed-agents";
import { useScopeActions } from "../lib/scope-store";
import { useToastActions } from "../lib/toast-store";
import type { DiscoverResult } from "../lib/types";

/** Best-effort extraction of a human message from a rejected mutation. Tauri
 * commands returning `Result<T, String>` reject with the raw string, not a
 * JS `Error`, so this stays defensive rather than assuming `.message`. */
function errorText(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] leading-snug text-danger">
      <WarningCircle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** The active scope's id when it exists in `scopes` (project OR global), else
 * "" (unselected). We deliberately do NOT fall back to an arbitrary scope —
 * silently pre-selecting one reads as "already chosen" to the user. */
function pickDefaultScopeId(scopes: Scope[], defaultScopeId: string): string {
  return scopes.some((s) => s.id === defaultScopeId) ? defaultScopeId : "";
}

/** Default agent selection for a fresh dialog open: every installed agent.
 * The user is in charge after this — they can deselect individually or via
 * "Select all" (which toggles to none). */
function defaultAgentSelection(
  installed: InstalledAgents | undefined,
): Set<AgentId> {
  if (!installed) return new Set();
  return new Set(
    AGENTS.filter((a) => installed[a.id] === true).map((a) => a.id),
  );
}

function ScopeSelect({
  scopes,
  value,
  onChange,
}: {
  scopes: Scope[];
  value: string;
  onChange: (id: string) => void;
}) {
  const current = scopes.find((s) => s.id === value);
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-[14px] text-fg transition-colors duration-100 hover:border-subtle focus:border-accent focus:outline-none"
        >
          {current ? (
            <>
              <span className="text-subtle">
                {current.kind === "global" ? (
                  <Globe size={16} weight="fill" />
                ) : (
                  <FolderSimple size={16} weight="fill" />
                )}
              </span>
              <span className="flex-1 truncate text-left">{current.name}</span>
            </>
          ) : (
            <span className="flex-1 truncate text-left text-subtle">Select install location</span>
          )}
          <CaretUpDown size={15} className="text-subtle" />
        </button>
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] rounded-xl border border-border bg-surface p-1 elevated animate-content-in"
        >
          {scopes.map((s) => (
            <RMenu.Item
              key={s.id}
              onSelect={() => onChange(s.id)}
              className="flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-fg outline-none data-[highlighted]:bg-surface-2"
            >
              <span className="text-subtle">
                {s.kind === "global" ? (
                  <Globe size={15} weight="fill" />
                ) : (
                  <FolderSimple size={15} weight="fill" />
                )}
              </span>
              <span className="flex-1 truncate">{s.name}</span>
              {s.id === value && (
                <Check size={14} weight="bold" className="text-accent-text" />
              )}
            </RMenu.Item>
          ))}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

function MethodCard({
  method,
  selected,
  onSelect,
}: {
  method: InstallMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const isSymlink = method === "symlink";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-1 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors duration-100",
        selected
          ? "border-accent bg-accent-soft"
          : "border-border-strong bg-surface hover:border-subtle",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={selected ? "text-accent-text" : "text-muted"}>
          {isSymlink ? <LinkSimple size={16} /> : <Copy size={16} />}
        </span>
        <span className="text-[13px] font-semibold text-fg">
          {isSymlink ? "Symlink" : "Copy"}
        </span>
        {isSymlink && (
          <span className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
            recommended
          </span>
        )}
      </div>
      <p className="text-[12px] leading-snug text-muted">
        {isSymlink
          ? "References the original; updates are picked up automatically."
          : "Independent copy, isolated per scope."}
      </p>
    </button>
  );
}

export function InstallDialog({
  open,
  onOpenChange,
  scopes,
  defaultScopeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scopes: Scope[];
  defaultScopeId: string;
}) {
  const [phase, setPhase] = useState<"input" | "select">("input");
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [discover, setDiscover] = useState<DiscoverResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scopeId, setScopeId] = useState(() => pickDefaultScopeId(scopes, defaultScopeId));
  const [agents, setAgents] = useState<Set<AgentId>>(new Set());
  const [method, setMethod] = useState<InstallMethod>("symlink");

  const discoverMut = useDiscoverSkills();
  const installMut = useInstallSkills();
  const { data: installedAgents, isPending: agentsLoading } =
    useInstalledAgents();
  const { selectScope } = useScopeActions();
  const { show } = useToastActions();

  const parsed = useMemo(() => parseInstallSource(url), [url]);
  const urlInvalid = touched && url.trim().length > 0 && !parsed;
  const canDiscover = !!parsed && !discoverMut.isPending;
  const visibleAgents = useMemo(
    () => (installedAgents ? AGENTS.filter((a) => installedAgents[a.id] === true) : []),
    [installedAgents],
  );
  const canInstall =
    !!discover &&
    selected.size > 0 &&
    agents.size > 0 &&
    !!scopeId &&
    !installMut.isPending;

  function reset() {
    setPhase("input");
    setUrl("");
    setTouched(false);
    setDiscover(null);
    setSelected(new Set());
    setScopeId(pickDefaultScopeId(scopes, defaultScopeId));
    setAgents(defaultAgentSelection(installedAgents));
    setMethod("symlink");
    discoverMut.reset();
    installMut.reset();
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    else setScopeId(pickDefaultScopeId(scopes, defaultScopeId));
    onOpenChange(v);
  }

  // The dialog is always mounted and `open` is driven programmatically by the
  // parent, so Radix's onOpenChange doesn't fire on open; scopes also load
  // async after first mount. Re-initialize state (incl. scopeId) each time the
  // dialog opens, when scopes is actually populated.
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After reset(), default-select Claude (or the first installed agent) once
  // the install-status query has data. Skips whenever the user has already
  // picked anything, so toggles/clears are not overridden by a refetch.
  useEffect(() => {
    if (!open || !installedAgents) return;
    setAgents((prev) =>
      prev.size > 0 ? prev : defaultAgentSelection(installedAgents),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installedAgents]);

  async function handleDiscover() {
    setTouched(true);
    if (!parsed) return;
    try {
      const result = await discoverMut.mutateAsync(url.trim());
      setDiscover(result);
      setSelected(new Set(result.skills.map((s) => s.skillPath)));
      setPhase("select");
    } catch {
      // discoverMut.error surfaces the message below.
    }
  }

  function handleInstall() {
    if (!discover) return;
    const scope = scopes.find((s) => s.id === scopeId);
    if (!scope) return;
    installMut.mutate(
      {
        scopePath: scope.path,
        tempDir: discover.tempDir,
        selections: [...selected],
        agents: [...agents],
        method,
      },
      {
        onSuccess: () => {
          selectScope(scope.id);
          show(`Installed ${selected.size} skill${selected.size === 1 ? "" : "s"}`);
          handleOpenChange(false);
        },
      },
    );
  }

  function toggleAgent(id: AgentId) {
    setAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allAgentsSelected =
    visibleAgents.length > 0 && agents.size === visibleAgents.length;
  function toggleAllAgents() {
    setAgents(
      allAgentsSelected ? new Set() : new Set(visibleAgents.map((a) => a.id)),
    );
  }

  function toggleSkill(skillPath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skillPath)) next.delete(skillPath);
      else next.add(skillPath);
      return next;
    });
  }

  const allSkillsSelected = discover ? selected.size === discover.skills.length : false;
  function toggleAllSkills() {
    if (!discover) return;
    setSelected(
      allSkillsSelected ? new Set() : new Set(discover.skills.map((s) => s.skillPath)),
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Install skill"
      description="Install a skill from a Git repository URL — GitHub, GitLab, Gitea, or any self-hosted Git."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {phase === "input" ? (
            <Button variant="primary" disabled={!canDiscover} onClick={handleDiscover}>
              {discoverMut.isPending && (
                <CircleNotch size={15} weight="bold" className="animate-spin" />
              )}
              {discoverMut.isPending ? "Discovering" : "Discover"}
            </Button>
          ) : (
            <Button variant="primary" disabled={!canInstall} onClick={handleInstall}>
              {installMut.isPending && (
                <CircleNotch size={15} weight="bold" className="animate-spin" />
              )}
              {installMut.isPending ? "Installing" : "Install"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {phase === "input" ? (
          <>
            {/* Source URL */}
            <Field
              label="Repository URL"
              htmlFor="install-url"
              error={
                urlInvalid
                  ? "Please check the URL. Example: github.com/owner/repo"
                  : undefined
              }
              hint={
                !parsed && !urlInvalid
                  ? "GitHub, GitLab, Gitea, or any Git URL (owner/repo shorthand also works)"
                  : undefined
              }
            >
              <TextInput
                id="install-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                invalid={urlInvalid}
                placeholder="github.com/owner/repo"
                autoFocus
                spellCheck={false}
              />
              {parsed && (
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <SourceBadge type="git" />
                  <span className="truncate font-mono text-[12px] text-muted">
                    {parsed.host ? `${parsed.host}/${parsed.repoLabel}` : parsed.repoLabel}
                  </span>
                </div>
              )}
            </Field>
            {discoverMut.isError && (
              <ErrorNote
                message={errorText(discoverMut.error) ?? "Discovery failed."}
              />
            )}
          </>
        ) : discover ? (
          <>
            {/* Discovered source, read-only recap */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <SourceBadge type="git" />
              <span className="truncate font-mono text-[12px] text-muted">
                {parsed
                  ? parsed.host
                    ? `${parsed.host}/${parsed.repoLabel}`
                    : parsed.repoLabel
                  : discover.sourceUrl}
              </span>
              <span className="ml-auto shrink-0 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-subtle">
                {discover.ref}
              </span>
            </div>

            {/* Discovered skills */}
            <Field label="Skills to install">
              <div className="overflow-hidden rounded-xl border border-border-strong">
                <button
                  type="button"
                  onClick={toggleAllSkills}
                  className="flex w-full items-center gap-2.5 border-b border-border bg-surface-2 px-3 py-1.5 text-left"
                >
                  <CheckTick checked={allSkillsSelected} />
                  <span className="text-[13px] font-medium text-fg">Select all</span>
                  <span className="ml-auto text-[12px] text-subtle">
                    {selected.size} / {discover.skills.length}
                  </span>
                </button>
                <ul className="max-h-[200px] overflow-y-auto">
                  {discover.skills.map((skill) => {
                    const checked = selected.has(skill.skillPath);
                    return (
                      <li key={skill.skillPath}>
                        <button
                          type="button"
                          onClick={() => toggleSkill(skill.skillPath)}
                          className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2"
                        >
                          <span className="mt-0.5">
                            <CheckTick checked={checked} />
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-medium text-fg">
                              {skill.name}
                            </span>
                            {skill.description && (
                              <span className="text-[12px] leading-snug text-muted">
                                {skill.description}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Field>

            {/* Agents */}
            <Field
              label="Agents to install for"
              hint={
                visibleAgents.length === 0
                  ? undefined
                  : "Only agents installed on this machine are listed. codex, gemini, and cursor share a common folder."
              }
            >
              <div className="overflow-hidden rounded-xl border border-border-strong">
                {visibleAgents.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllAgents}
                    className="flex w-full items-center gap-2.5 border-b border-border bg-surface-2 px-3 py-1.5 text-left"
                  >
                    <CheckTick checked={allAgentsSelected} />
                    <span className="text-[13px] font-medium text-fg">Select all</span>
                    <span className="ml-auto text-[12px] text-subtle">
                      {agents.size} / {visibleAgents.length}
                    </span>
                  </button>
                )}
                {visibleAgents.length === 0 ? (
                  <div className="px-3 py-3 text-[12px] leading-snug text-subtle">
                    {agentsLoading
                      ? "Checking which agents are installed…"
                      : "No supported agents are installed. Install Claude, Codex, Cursor, Gemini, GitHub Copilot, or Windsurf and try again."}
                  </div>
                ) : (
                  <ul>
                    {visibleAgents.map((agent) => {
                      const checked = agents.has(agent.id);
                      return (
                        <li key={agent.id}>
                          <button
                            type="button"
                            onClick={() => toggleAgent(agent.id)}
                            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-100 hover:bg-surface-2"
                          >
                            <CheckTick checked={checked} />
                            <AgentBadge id={agent.id} size={22} />
                            <span className="text-[13px] font-medium text-fg">
                              {agent.label}
                            </span>
                            <span className="ml-auto font-mono text-[11px] text-subtle">
                              {agent.dir}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Field>

            {/* Scope + Method */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[168px_1fr]">
              <Field label="Install location">
                <ScopeSelect scopes={scopes} value={scopeId} onChange={setScopeId} />
              </Field>
              <Field label="Install method">
                <div className="flex gap-2.5">
                  <MethodCard
                    method="symlink"
                    selected={method === "symlink"}
                    onSelect={() => setMethod("symlink")}
                  />
                  <MethodCard
                    method="copy"
                    selected={method === "copy"}
                    onSelect={() => setMethod("copy")}
                  />
                </div>
              </Field>
            </div>

            {installMut.isError && (
              <ErrorNote message={errorText(installMut.error) ?? "Installation failed."} />
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
