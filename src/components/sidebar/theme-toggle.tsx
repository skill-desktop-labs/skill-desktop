import { Sun, Moon, Desktop } from "@phosphor-icons/react";
import type { ThemePref } from "../../lib/theme";
import { useTheme } from "../../lib/theme";

const THEME_ICON: Record<ThemePref, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Desktop,
};
const THEME_LABEL: Record<ThemePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { pref, cycle } = useTheme();
  const ThemeIcon = THEME_ICON[pref];

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
      <span className="px-1 text-[12px] text-subtle">Theme</span>
      <button
        type="button"
        onClick={cycle}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-muted transition-colors duration-100 hover:bg-surface-2 hover:text-fg"
      >
        <ThemeIcon size={15} weight="fill" />
        {THEME_LABEL[pref]}
      </button>
    </div>
  );
}
