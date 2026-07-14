import { invoke } from "@tauri-apps/api/core";
import type { InstalledAgents } from "../lib/types";

/** Machine-global install status per agent, read from the Rust backend. */
export function getInstalledAgents(): Promise<InstalledAgents> {
  return invoke<InstalledAgents>("detect_installed_agents");
}
