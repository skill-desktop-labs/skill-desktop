import { invoke } from "@tauri-apps/api/core";

/** Reads the full contents of an installed skill's SKILL.md from disk. Omit
 *  scopePath for the global scope. Tauri maps camelCase args to
 *  `scope_path`/`skill_name`. Rejects if no matching skill is in the scope. */
export function fetchInstalledSkillReadme(
  scopePath: string | undefined,
  skillName: string,
): Promise<string> {
  return invoke<string>("read_skill_readme", { scopePath, skillName });
}
