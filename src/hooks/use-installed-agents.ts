import { useQuery } from "@tanstack/react-query";
import { getInstalledAgents } from "../api/agents";

/**
 * Detects which agents are installed on this machine. Fetched per mount and
 * refetched on window focus (default QueryClient) so newly installed agents
 * appear without a restart — do not pin staleTime to Infinity.
 */
export function useInstalledAgents() {
  return useQuery({
    queryKey: ["installed-agents"],
    queryFn: getInstalledAgents,
    retry: false, // local IPC — no point retrying (e.g. browser dev without Tauri)
  });
}
