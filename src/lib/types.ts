export type AgentId = "claude" | "codex" | "gemini" | "cursor";

export type SourceType = "git";

export type InstallMethod = "symlink" | "copy";

export interface Scope {
  id: string;
  kind: "global" | "project";
  name: string;
  /** Absolute-ish path shown to the user. Undefined for the global scope. */
  path?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Which agents this skill is installed for, within its scope. */
  agents: AgentId[];
  method: InstallMethod;
}

export type InstalledAgents = Record<AgentId, boolean>;

export interface DiscoveredSkill {
  name: string;
  description: string;
  skillPath: string;
}

export interface DiscoverResult {
  tempDir: string;
  ref: string;
  sourceUrl: string;
  sourceType: string; // "git"
  skills: DiscoveredSkill[];
}

export interface InstallArgs {
  scopePath?: string;
  tempDir: string;
  selections: string[];
  agents: AgentId[];
  method: InstallMethod;
}

