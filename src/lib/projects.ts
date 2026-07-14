import type { Scope } from "./types";

/** The always-present global scope. Not persisted; synthesized in code. */
export const GLOBAL_SCOPE: Scope = {
  id: "global",
  kind: "global",
  name: "Global",
};

/** Derives a stable, collision-free id from a unique folder path. */
export function makeProjectId(path: string): string {
  return `proj:${path}`;
}

/** Builds a project scope from a chosen/entered folder path. */
export function makeProjectScope(path: string): Scope {
  const name = path.split("/").filter(Boolean).pop() || path;
  return { id: makeProjectId(path), kind: "project", name, path };
}

/** Sidebar scope list: global always first, then projects. */
export function withGlobal(projects: Scope[]): Scope[] {
  return [GLOBAL_SCOPE, ...projects];
}
