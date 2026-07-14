import type { AgentId } from "./types";
import claudeIcon from "../assets/agents/claude.svg";
import codexIcon from "../assets/agents/codex.png";
import geminiIcon from "../assets/agents/gemini.png";
import cursorIcon from "../assets/agents/cursor.svg";

export interface AgentMeta {
  id: AgentId;
  label: string;
  /** Brand icon (official favicon), shown in the identity badge. */
  icon: string;
  /** Directory an installed skill lands in, relative to the scope root. */
  dir: string;
}

export const AGENTS: AgentMeta[] = [
  {
    id: "claude",
    label: "Claude",
    icon: claudeIcon,
    dir: ".claude/skills",
  },
  {
    id: "codex",
    label: "Codex",
    icon: codexIcon,
    dir: ".codex/skills",
  },
  {
    id: "gemini",
    label: "Gemini",
    icon: geminiIcon,
    dir: ".gemini/skills",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: cursorIcon,
    dir: ".cursor/skills",
  },
];

export const AGENT_MAP: Record<AgentId, AgentMeta> = AGENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<AgentId, AgentMeta>,
);
