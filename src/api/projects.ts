import { load } from "@tauri-apps/plugin-store";
import type { Scope } from "../lib/types";

const FILE = "projects.json";
const KEY = "projects";

/**
 * Reads the persisted project scope list — the read path for useProjects.
 *
 * All errors are swallowed here and [] is returned. This keeps the UI rendering
 * an empty state without crashing in pure browser dev with no Tauri runtime,
 * same intent as installed-agents' retry:false. Treating a read failure as an
 * empty list only makes the view look empty — it never touches the store file,
 * so it's safe.
 */
export async function loadProjects(): Promise<Scope[]> {
  try {
    const store = await load(FILE);
    const projects = await store.get<Scope[]>(KEY);
    return projects ?? [];
  } catch {
    return [];
  }
}

/**
 * Read-modify-write for add/remove.
 *
 * Unlike the read path (loadProjects), read errors are NOT swallowed here.
 * Mistaking a transient read failure for an empty list could let us overwrite
 * the store with just the one entry we're adding, silently deleting previously
 * saved projects. On read failure the exception propagates to the mutation's
 * onError and projects.json is left untouched. (The global scope is not
 * persisted — callers only pass project scopes.)
 */
async function mutateStore(
  update: (current: Scope[]) => Scope[],
): Promise<Scope[]> {
  const store = await load(FILE);
  const next = update((await store.get<Scope[]>(KEY)) ?? []);
  await store.set(KEY, next);
  await store.save();
  return next;
}

/** Adds a project scope and persists it. Returns the new persisted list. */
export async function addProject(scope: Scope): Promise<Scope[]> {
  return mutateStore((current) => [...current, scope]);
}

/** Removes a project scope by id and persists it. Returns the new persisted list. */
export async function removeProject(id: string): Promise<Scope[]> {
  return mutateStore((current) => current.filter((p) => p.id !== id));
}
