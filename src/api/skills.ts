import { invoke } from "@tauri-apps/api/core";
import type { DiscoverResult, InstallArgs, Skill } from "../lib/types";

/**
 * Installed skills for a scope, read from the Rust backend. `scopePath` selects
 * the scope root: omit it for the machine-global scope, or pass a project path
 * for a project scope. Tauri maps the camelCase arg to the `scope_path` param.
 */
export function getInstalledSkills(scopePath?: string): Promise<Skill[]> {
  return invoke<Skill[]>("list_skills", { scopePath });
}

/** Removes a skill from disk in a scope. Omit path for the global scope. Tauri
 * maps camelCase args to `scope_path`/`skill_name`. */
export function deleteSkill(
  scopePath: string | undefined,
  skillName: string,
): Promise<void> {
  return invoke("delete_skill", { scopePath, skillName });
}

export async function discoverSkills(sourceUrl: string): Promise<DiscoverResult> {
  return invoke<DiscoverResult>("discover_skills", { sourceUrl });
}

export async function installSkills(args: InstallArgs): Promise<Skill[]> {
  return invoke<Skill[]>("install_skills", {
    scopePath: args.scopePath ?? null,
    tempDir: args.tempDir,
    selections: args.selections,
    agents: args.agents,
    method: args.method,
  });
}
